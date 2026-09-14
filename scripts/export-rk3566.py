#!/usr/bin/env python3
"""Export the saved RK3566 service evidence for GitHub Pages without running solvers.

Usage: python3 -B scripts/export-rk3566.py --source /path/to/rev4/simulation
Only the service's explicit public GET endpoints and artifact allowlists are copied.
Source fingerprints are checked by the original service, then frozen in this snapshot.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import re
import sys
from urllib.parse import urlencode

sys.dont_write_bytecode = True


def digest(value):
    return hashlib.sha256(value).hexdigest()


def read_json(path):
    return json.loads(path.read_text())


def encoded_json(value):
    return (json.dumps(value, ensure_ascii=False, allow_nan=False, separators=(",", ":")) + "\n").encode()


def route(path, **query):
    return path + ("?" + urlencode(sorted(query.items())) if query else "")


def hydrate(service):
    """Replicate initialize(resume=True) using reads only; never extract or simulate."""
    data = service.DATA
    board = read_json(data / "board.json")
    board["rails"] = service.engine.build_rails(board["components"])
    service.BOARD_LAYOUT = read_json(data / "board-layout.json")
    if service.BOARD_LAYOUT["source_sha256"] != board["sha256"]:
        raise ValueError("Saved board inventory and geometry have different sources")
    iterations = read_json(data / "iterations.json")
    for record in iterations:
        ident = record["id"]
        if not re.fullmatch(r"run-\d+", ident):
            raise ValueError(f"Unexpected saved run id: {ident}")
        service.RESULTS[ident] = read_json(data / "runs" / (ident + ".json"))
    latest = read_json(data / "latest-result.json")
    if latest.get("id") not in service.RESULTS:
        raise ValueError("Selected saved result is absent from run history")
    spice = read_json(data / "spice-validation.json")
    if spice.get("source_sha256") != board["sha256"]:
        spice = {"engine": "ngspice", "status": "stale", "scope": "The saved source changed. Re-run spice_check.py before using this benchmark."}
    service.STATE.update(
        board=board, result=latest, iterations=iterations,
        audit=read_json(data / "electrical-audit.json"), spice=spice,
        running=False, campaign=read_json(data / "campaign.json"),
        defaults=service.engine.DEFAULT_PARAMETERS,
        parameter_schema=getattr(service.engine, "PARAMETER_SCHEMA", {}),
        score_policy={"target": 8, "hardware_cap": 7,
                      "meaning": "Model checks assess the declared behavioral assumptions. Hardware evidence includes unresolved qualification gates; the two scores are not interchangeable."},
    )
    if service.STATE["campaign"].get("status") in ("running", "stopping"):
        raise ValueError("Wait for the active validation campaign before exporting")
    if not service.source_is_current():
        raise ValueError("Saved source identities changed; regenerate the source evidence before publishing")
    if latest.get("source_sha256") != board["sha256"] or latest.get("engine_sha256") != service.ENGINE_SHA256:
        raise ValueError("Selected result does not match the saved board and current engine")


def request(service, url):
    """Exercise the real GET handler with an in-memory HTTP connection."""
    handler = object.__new__(service.Handler)
    handler.path, handler.command = url, "GET"
    handler.headers = {"Host": "127.0.0.1:8766"}
    handler.rfile, handler.wfile = io.BytesIO(), io.BytesIO()
    result = {"headers": {}}
    handler.send_response = lambda status: result.update(status=status)
    handler.send_header = lambda key, value: result["headers"].update({key: value})
    handler.end_headers = lambda: None
    handler.do_GET()
    result["body"] = handler.wfile.getvalue()
    if result["status"] != 200:
        raise ValueError(f"GET {url} returned {result['status']}: {result['body'][:300]!r}")
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", required=True, type=Path, help="Saved Rev4 simulation directory")
    parser.add_argument("--output", type=Path, default=Path(__file__).resolve().parents[1] / "rk3566")
    args = parser.parse_args()
    source, output = args.source.resolve(), args.output.resolve()
    if output == source or output.is_relative_to(source):
        raise ValueError("The export must be outside the source simulation directory")
    sys.path.insert(0, str(source))
    import server as service
    if service.HERE.resolve() != source:
        raise ValueError("Imported the wrong simulation service")
    hydrate(service)
    model_result = read_json(source / "model-expansion/results.json")
    section_result = read_json(source / "data/section-analysis.json")
    declared_hash_files = set(service.STATE["board"]["source_hashes"])
    for result in (model_result, section_result):
        for field in ("source_hashes", "analysis_input_hashes"):
            declared_hash_files.update(result.get(field, {}))
    input_paths = sorted(set(
        list(source.glob("*.py")) + list(source.glob("*.cpp"))
        + [path for path in (source / "data").rglob("*") if path.is_file()]
        + [source / "model-expansion" / name for name in model_result["artifact_files"]]
        + [source / name for name in service.PROFESSIONAL_FILES | service.SECTION_FILES]
        + [source / "professional/review-status.json", source / "TIME_DOMAIN_EM_ANALYSIS.md", source / "WHOLE_BOARD_MAGNETIC.md"]
        + [service.ROOT / name for name in declared_hash_files]
    ))
    before = {str(path): digest(path.read_bytes()) for path in input_paths}
    manifest = {
        "schema_version": 1,
        "publication_mode": "snapshot",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_sha256": service.STATE["board"]["sha256"],
        "source_hashes": service.STATE["board"]["source_hashes"],
        "engine_sha256": service.ENGINE_SHA256,
        "selected_run": service.STATE["result"]["id"],
        "runs": [record["id"] for record in service.STATE["iterations"]],
        "source_status_scope": "Source and model status flags were checked against the local saved design at export time. This published snapshot does not monitor later source changes.",
        "simulation_scope": "Interactive playback and evidence review of saved studies. New Python/ngspice simulations require the local simulation service.",
        "routes": {}, "responses": {}, "compositions": {}, "files": [],
        "third_party_notice": "Only the local service's explicitly downloadable study evidence is included. Vendor model source archives and runtime files are excluded. The frontend retains its bundled Three.js MIT license.",
    }
    written = {}

    def publish(url, relative):
        response = request(service, url)
        body = response["body"]
        content_type = response["headers"].get("Content-Type", "application/octet-stream")
        if content_type.startswith("application/json") and relative.startswith("data/"):
            body = encoded_json(json.loads(body))
        path = output / relative
        if not path.resolve().is_relative_to(output):
            raise ValueError(f"Output escaped publication directory: {relative}")
        fingerprint = {"path": relative, "bytes": len(body), "sha256": digest(body)}
        if relative in written and written[relative] != fingerprint:
            raise ValueError(f"Two routes disagree about {relative}")
        if relative not in written:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(body)
            written[relative] = fingerprint
        manifest["routes"][url] = relative
        manifest["responses"][url] = {
            "status": response["status"], "content_type": content_type,
            "attachment": response["headers"].get("Content-Disposition"),
        }
        return json.loads(body) if content_type.startswith("application/json") else None

    endpoints = [
        "state", "health", "board-layout", "workbench-layout", "workbench-data", "workbench-status",
        "board-magnetic-field", "board-magnetic-status",
        "section-analysis", "section-status", "model-studies", "model-study-status",
        "professional-review", "simulation-video-manifest", "time-domain", "electric-field", "em-export", "export",
    ]
    payloads = {}
    for endpoint in endpoints:
        payload = publish("/api/" + endpoint, "data/" + endpoint + ".json")
        if endpoint in ("model-studies", "time-domain"):
            payloads[endpoint] = payload
        print(f"Exported /api/{endpoint}", flush=True)
    for ident in manifest["runs"]:
        iteration_url = route("/api/iteration", id=ident)
        publish(iteration_url, "data/iterations/" + ident + ".json")
        manifest["compositions"][route("/api/export", id=ident)] = {"base": "/api/export", "iteration": iteration_url}

    publish("/api/handoff", "artifacts/review/NEXT_AGENT_HANDOFF.md")
    publish("/api/em-report", "artifacts/review/TIME_DOMAIN_EM_ANALYSIS.md")
    publish("/api/board-magnetic-report", "artifacts/review/WHOLE_BOARD_MAGNETIC.md")
    for name in sorted(service.PROFESSIONAL_FILES):
        publish(route("/api/professional-artifact", file=name), "artifacts/review/" + name)
    for name in sorted(service.SECTION_FILES):
        publish(route("/api/section-artifact", file=name), "artifacts/review/" + name)
    for name in sorted(payloads["model-studies"].get("artifact_files", [])):
        # The handler performs its exact-name, suffix, symlink and vendor-model checks.
        publish(route("/api/model-artifact", file=name), "artifacts/models/" + name)
    em_artifacts = sorted({value for case in payloads["time-domain"]["cases"]
                           for value in case.get("artifacts", {}).values() if isinstance(value, str)})
    for name in em_artifacts:
        relative = str(Path(name).relative_to("data/time-domain"))
        publish(route("/api/em-artifact", file=name), "artifacts/time-domain/" + relative)
    for url, (name, _) in sorted(service.VIDEO_FILES.items()):
        publish(url, "artifacts/video/" + name)
        publish(route(url, download="1"), "artifacts/video/" + name)

    for path in input_paths:
        if digest(path.read_bytes()) != before[str(path)]:
            raise ValueError(f"Source changed during export: {path}")
    final_guards = {
        "source": service.source_is_current(),
        "board_magnetic": {key: service.board_magnetic_payload()[key] for key in ("source_current", "model_current", "input_current")},
        "section": service.section_flags(read_json(source / "data/section-analysis.json")),
        "models": {key: service.model_study_payload()[key] for key in ("source_current", "analysis_inputs_current")},
        "workbench": {key: value for key, value in service.workbench_status().items() if key.endswith("current")},
        "electric": {key: service.experiment("electric-field")[key] for key in ("source_current", "model_current")},
        "professional": service.professional_review()["source_current"],
        "video": service.video_manifest()["source_current"],
    }
    if not all(final_guards["board_magnetic"].values()):
        raise ValueError("Whole-board magnetic evidence changed; regenerate it before publication")
    manifest["verified_source_status"] = final_guards
    manifest["files"] = [written[key] for key in sorted(written)]
    manifest["routes"] = dict(sorted(manifest["routes"].items()))
    manifest["responses"] = dict(sorted(manifest["responses"].items()))
    manifest["compositions"] = dict(sorted(manifest["compositions"].items()))
    manifest["total_bytes"] = sum(item["bytes"] for item in manifest["files"])
    manifest["source_inputs_unchanged"] = True
    output.mkdir(parents=True, exist_ok=True)
    (output / "publication.json").write_bytes(encoded_json(manifest))
    print(f"Exported {len(manifest['routes'])} GET routes, {len(manifest['runs'])} runs, {len(written)} files, {manifest['total_bytes'] / 1048576:.1f} MiB to {output}")


if __name__ == "__main__":
    main()
