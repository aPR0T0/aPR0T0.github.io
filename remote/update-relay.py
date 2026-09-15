#!/usr/bin/env python3
"""Update one existing systemd relay; preserve all non-release configuration/data."""
import argparse
import fcntl
import hashlib
import io
import json
import os
from pathlib import Path, PurePosixPath
import pwd
import re
import shutil
import signal
import stat
import subprocess
import tempfile
import time
import urllib.request
import zipfile

BASE = "https://apr0t0.github.io/remote/"
PRIVATE = {".env", ".local", ".git", "data", "node_modules", "connector.json"}


def digest(data):
    return hashlib.sha256(data).hexdigest()


def path_name(value):
    if not isinstance(value, str) or "\\" in value:
        raise ValueError("Invalid release path.")
    path = PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or not path.parts or any(part in PRIVATE for part in path.parts):
        raise ValueError("Release contains a private or unsafe path: " + value)
    if str(path) != value:
        raise ValueError("Release path is not canonical: " + value)
    return value


def fetch(name, limit):
    req = urllib.request.Request(BASE + name + "?update=" + str(time.time_ns()), headers={"Cache-Control": "no-cache"})
    with urllib.request.urlopen(req, timeout=30) as response:
        data = response.read(limit + 1)
    if len(data) > limit:
        raise ValueError("Release download exceeds its size limit.")
    return data


def unpack(data, release, directory):
    if digest(data) != release["sha256"] or len(data) != release["bytes"]:
        raise ValueError("The laptop ZIP does not match the published checksum.")
    with zipfile.ZipFile(io.BytesIO(data)) as archive:
        entries = archive.infolist()
        if len(entries) > 1000 or sum(item.file_size for item in entries) > 64 * 1024 * 1024:
            raise ValueError("Release archive exceeds its limits.")
        names = set()
        for item in entries:
            if not item.filename.startswith("agent-remote/") or item.is_dir() or stat.S_ISLNK(item.external_attr >> 16):
                raise ValueError("Unexpected archive entry.")
            name = path_name(item.filename[len("agent-remote/"):])
            if name in names:
                raise ValueError("Duplicate release path.")
            names.add(name)
        manifest = json.loads(archive.read("agent-remote/package-manifest.json"))
        if manifest.get("application") != "agent-remote-laptop" or manifest.get("version") != release["version"]:
            raise ValueError("Release and package manifest versions differ.")
        files = manifest["files"]
        expected = {path_name(item["path"]) for item in files}
        if len(expected) != len(files) or names != expected | {"package-manifest.json"}:
            raise ValueError("The release inventory is incomplete or duplicated.")
        for item in files:
            content = archive.read("agent-remote/" + item["path"])
            if len(content) != item["bytes"] or digest(content) != item["sha256"]:
                raise ValueError("Package file checksum mismatch: " + item["path"])
        for item in entries:
            name = item.filename[len("agent-remote/"):]
            target = directory / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(archive.read(item))
            target.chmod(0o755 if (item.external_attr >> 16) & 0o111 else 0o644)
    return sorted(names)


def check_target(target, paths):
    package = json.loads((target / "package.json").read_text())
    if package.get("name") != "agent-remote" or not (target / "server/index.ts").is_file():
        raise ValueError("Target is not an Agent Remote relay installation.")
    for name in paths + ["node_modules"]:
        path = target / name
        for candidate in [path, *path.parents]:
            if candidate == target.parent:
                break
            if candidate.is_symlink():
                raise ValueError("Review this installation symlink before updating: " + str(candidate))
        existing = path.parent
        while not existing.exists():
            existing = existing.parent
        if not os.access(existing, os.W_OK):
            raise ValueError("The installation is not writable by this user: " + str(existing))
    inventory = target / "package-manifest.json"
    if inventory.is_file():
        old = json.loads(inventory.read_text())
        for item in old.get("files", []):
            name = path_name(item["path"])
            file = target / name
            if name in paths and file.is_file() and digest(file.read_bytes()) != item["sha256"]:
                raise ValueError("A program file was edited locally; review it before updating: " + name)
    return package.get("version", "unknown")


def service_action(action, service):
    subprocess.run(["sudo", "systemctl", action, service], check=True)


def healthy(port, version):
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for _ in range(30):
        try:
            with opener.open("http://127.0.0.1:%d/api/health" % port, timeout=2) as response:
                value = json.loads(response.read(4096))
            if value.get("ok") is True and value.get("version") == version:
                return True
        except Exception:
            pass
        time.sleep(1)
    return False


def deploy(target, stage, paths, service, port, version, backup):
    """Called only after download, runtime checks, and npm installation succeed."""
    changed = []
    old_modules = False
    new_modules = False
    stopped = False
    protected = {name: digest((target / name).read_bytes()) for name in (".env", "data/state.json", ".local/setup/settings.json") if (target / name).is_file()}
    try:
        service_action("stop", service)
        stopped = True
        # Data may legitimately change before the service finishes stopping.
        protected = {name: digest((target / name).read_bytes()) for name in protected}
        backup.mkdir(mode=0o700)
        records = []
        for name in paths:
            destination = target / name
            prior = backup / "program-files" / name
            exists = destination.exists()
            if exists:
                if not destination.is_file():
                    raise ValueError("Expected a program file at " + str(destination))
                prior.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(destination, prior)
            records.append({"path": name, "existed": exists})
        (backup / "restore-files.json").write_text(json.dumps(records, indent=2))
        if (target / "node_modules").exists():
            (target / "node_modules").rename(backup / "node_modules")
            old_modules = True
        (stage / "node_modules").rename(target / "node_modules")
        new_modules = True
        for record in records:
            name = record["path"]
            destination = target / name
            destination.parent.mkdir(parents=True, exist_ok=True)
            changed.append(record)
            os.replace(stage / name, destination)
        for name, previous in protected.items():
            if digest((target / name).read_bytes()) != previous:
                raise ValueError("A protected configuration/data file changed during the update: " + name)
        service_action("start", service)
        if not healthy(port, version):
            raise RuntimeError("The updated relay did not report the expected version.")
    except BaseException as failure:
        if stopped:
            try:
                service_action("stop", service)
                for record in reversed(changed):
                    destination = target / record["path"]
                    if record["existed"]:
                        shutil.copy2(backup / "program-files" / record["path"], destination)
                    else:
                        destination.unlink(missing_ok=True)
                if new_modules:
                    shutil.rmtree(target / "node_modules")
                if old_modules:
                    (backup / "node_modules").rename(target / "node_modules")
                service_action("reset-failed", service)
                service_action("start", service)
            except Exception as rollback:
                raise RuntimeError("Update and automatic rollback need attention. Backups: %s. Service: %s" % (backup, service)) from rollback
        detail = "Update failed; the previous service was restarted. " if stopped else "No application files were changed; check the service status. "
        raise RuntimeError(detail + str(failure)) from failure


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--target", required=True)
    parser.add_argument("--service", required=True)
    parser.add_argument("--port", type=int, default=4317)
    parser.add_argument("--apply", action="store_true", help="Stop and update the verified relay service after staging the release")
    args = parser.parse_args()
    if os.geteuid() == 0:
        raise ValueError("Run as the installation owner, not with sudo. The script asks sudo only for service stop/start.")
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_.@-]*\.service", args.service) or not 1024 <= args.port <= 65535:
        raise ValueError("Invalid systemd service or port.")
    target = Path(args.target).resolve(strict=True)
    lock = os.open(target.parent / (".agent-remote-update-" + digest(str(target).encode())[:16] + ".lock"), os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW, 0o600)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        raise ValueError("Another update is already running for this relay.") from None
    info = subprocess.check_output(["systemctl", "show", args.service, "-p", "MainPID", "-p", "User"], text=True)
    properties = dict(line.split("=", 1) for line in info.splitlines() if "=" in line)
    pid = int(properties.get("MainPID", "0"))
    if pid <= 0 or Path("/proc/%d/cwd" % pid).resolve() != target:
        raise ValueError("This service is not currently running from the target folder. No files changed.")
    listener = subprocess.check_output(["ss", "-H", "-ltnp", "( sport = :%d )" % args.port], text=True)
    if "pid=%d," % pid not in listener:
        raise ValueError("The service's main process does not own the selected relay port. No files changed.")
    if properties.get("User") not in ("", "root", pwd.getpwuid(os.getuid()).pw_name):
        raise ValueError("This service uses a different OS account; its file permissions need a tailored update.")
    node = os.readlink("/proc/%d/exe" % pid)
    version = subprocess.check_output([node, "-p", "process.versions.node"], text=True).strip()
    major, minor = map(int, version.split(".")[:2])
    if major < 22 or (major == 22 and minor < 13):
        raise ValueError("The service uses Node %s. Update its Node runtime to 24 first; the relay has not been stopped." % version)
    release = json.loads(fetch("release.json", 65536))
    if not re.fullmatch(r"\d+\.\d+\.\d+", release.get("version", "")):
        raise ValueError("Invalid release metadata.")
    with tempfile.TemporaryDirectory(prefix=".agent-remote-update-", dir=target.parent) as temporary:
        stage = Path(temporary)
        paths = unpack(fetch("agent-remote-laptop.zip", 16 * 1024 * 1024), release, stage)
        staged_hashes = {name: digest((stage / name).read_bytes()) for name in paths}
        previous = check_target(target, paths)
        print("Relay: %s\nService: %s\nUpdate: %s -> %s\nNode: %s" % (target, args.service, previous, release["version"], version), flush=True)
        print("Configuration, relay data, and pairings stay in this folder. Only this relay service is restarted.", flush=True)
        if not args.apply:
            print("Preflight passed. Run again with --apply to install.")
            return
        env = {**os.environ, "PATH": str(Path(node).parent) + os.pathsep + os.environ.get("PATH", "")}
        subprocess.run(["npm", "ci", "--omit=dev", "--no-audit", "--no-fund"], cwd=stage, env=env, check=True)
        subprocess.run([node, "--import", "tsx", "--input-type=module", "-e", 'await import("./server/app.ts"); console.log("Relay runtime check passed.")'], cwd=stage, env=env, check=True)
        if any(digest((stage / name).read_bytes()) != expected for name, expected in staged_hashes.items()):
            raise ValueError("A release file changed during dependency installation. The running relay was not changed.")
        # Revalidate just before the brief service interruption.
        check_target(target, paths)
        backup = target.with_name(target.name + ".backup-" + time.strftime("%Y%m%d-%H%M%S"))
        deploy(target, stage, paths, args.service, args.port, release["version"], backup)
        print("SUCCESS: live relay reports %s. Program/dependency backup: %s" % (release["version"], backup))
        print("Create a NEW device-link code now, then switch apps and finish linking within five minutes.")


if __name__ == "__main__":
    def interrupted(_signal, _frame):
        raise KeyboardInterrupt("Update interrupted")
    signal.signal(signal.SIGTERM, interrupted)
    try:
        main()
    except (Exception, KeyboardInterrupt) as error:
        raise SystemExit("ERROR: " + str(error))
