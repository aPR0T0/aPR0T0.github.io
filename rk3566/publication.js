/* GitHub Pages snapshot transport. This page reads only the files in publication.json. */
"use strict";
window.RKSnapshot = (() => {
  const nativeFetch = window.fetch.bind(window);
  const base = new URL("./", document.currentScript.src);
  const bodies = new Map();
  let manifest = null;
  let routes = new Map();
  let responses = new Map();
  let compositions = new Map();

  function key(value) {
    const parsed = new URL(typeof value === "string" ? value : value?.href || value?.url, base);
    if (parsed.origin !== base.origin || !parsed.pathname.startsWith("/api/")) return null;
    parsed.searchParams.sort();
    const query = parsed.searchParams.toString();
    return parsed.pathname + (query ? `?${query}` : "");
  }
  function localFile(file) {
    const result = new URL(file, base);
    if (result.origin !== base.origin || !result.pathname.startsWith(base.pathname)) {
      throw new Error("Snapshot files must stay inside the published RK3566 directory.");
    }
    return result.href;
  }
  const ready = nativeFetch(new URL("publication.json", base), {cache:"no-cache"})
    .then(async response => {
      if (!response.ok) throw new Error(`The publication record could not load (${response.status}).`);
      const record = await response.json();
      if (record.publication_mode !== "snapshot" || !record.routes) throw new Error("The publication record is not a saved snapshot.");
      routes = new Map(Object.entries(record.routes).map(([route,file]) => [key(route),localFile(file)]));
      responses = new Map(Object.entries(record.responses || {}).map(([route,details]) => [key(route),details]));
      compositions = new Map(Object.entries(record.compositions || {}).map(([route,details]) => [key(route),details]));
      manifest = record;
      return record;
    });

  function errorResponse(message, status) {
    return new Response(JSON.stringify({error:message,publication_mode:"snapshot"}), {
      status, headers:{"Content-Type":"application/json", "Allow":"GET, HEAD"}
    });
  }
  function abortable(promise, signal) {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(signal.reason || new DOMException("Aborted", "AbortError"));
    return new Promise((resolve,reject) => {
      const abort = () => reject(signal.reason || new DOMException("Aborted", "AbortError"));
      signal.addEventListener("abort",abort,{once:true});
      promise.then(resolve,reject).finally(() => signal.removeEventListener("abort",abort));
    });
  }
  function readBody(file) {
    if (!bodies.has(file)) {
      const pending = nativeFetch(file, {cache:"force-cache"}).then(async response => {
        if (!response.ok) throw new Error(`A published snapshot file could not load (${response.status}). Reload to retry.`);
        return response.blob();
      }).catch(error => { bodies.delete(file); throw error; });
      bodies.set(file,pending);
    }
    return bodies.get(file);
  }
  async function snapshotFetch(input, options = {}) {
    const route = key(input);
    const method = String(options.method || input?.method || "GET").toUpperCase();
    if (!route) return errorResponse("Only recorded snapshot routes are available through this viewer.",404);
    if (!["GET","HEAD"].includes(method)) return errorResponse("This published snapshot is read-only. New simulations run in the local Python workbench.",405);
    const signal = options.signal || input?.signal;
    await abortable(ready,signal);
    const meta = responses.get(route) || {};
    const headers = {"Content-Type":meta.content_type || "application/json"};
    if (meta.attachment) headers["Content-Disposition"] = meta.attachment;
    if (compositions.has(route)) {
      if (method === "HEAD") return new Response(null,{status:200,headers});
      const recipe = compositions.get(route);
      const [baseResponse,iterationResponse] = await Promise.all([
        snapshotFetch(recipe.base,{signal}), snapshotFetch(recipe.iteration,{signal})
      ]);
      if (!baseResponse.ok || !iterationResponse.ok) return errorResponse("The saved iteration export is unavailable.",404);
      const [baseExport,iteration] = await Promise.all([baseResponse.json(),iterationResponse.json()]);
      return new Response(JSON.stringify({...baseExport,result:iteration.result}),{status:200,headers});
    }
    const file = routes.get(route);
    if (!file) return errorResponse("This item is not included in the published snapshot.",404);
    const body = method === "HEAD" ? null : await abortable(readBody(file),signal);
    return new Response(body,{status:meta.status || 200,headers});
  }
  function url(path) {
    const route = key(path);
    return route && routes.get(route) || "#";
  }
  function dateLabel() {
    const date = new Date(manifest?.generated_at);
    return Number.isNaN(date.getTime()) ? "date unavailable" : date.toLocaleString(undefined,{year:"numeric",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit",timeZone:"UTC",timeZoneName:"short"});
  }
  function saveLink(href, name) {
    const link = document.createElement("a");
    link.href = href;
    if (name) link.download = name;
    document.body.append(link);
    link.click();
    link.remove();
  }
  async function download(path, name) {
    await ready;
    const route = key(path);
    if (routes.has(route)) { saveLink(routes.get(route),name); return; }
    const response = await snapshotFetch(path);
    if (!response.ok) throw new Error((await response.json()).error);
    const blobUrl = URL.createObjectURL(await response.blob());
    saveLink(blobUrl,name);
    setTimeout(() => URL.revokeObjectURL(blobUrl),60000);
  }
  function normalizeLinks(root) {
    const nodes = [...root.querySelectorAll("[data-snapshot-href]")];
    if (root.matches?.("[data-snapshot-href]")) nodes.push(root);
    for (const node of nodes) {
      const route = key(node.dataset.snapshotHref);
      if (routes.has(route)) {
        node.href = routes.get(route);
        node.removeAttribute("aria-disabled");
        const attachment = responses.get(route)?.attachment;
        const filename = attachment?.match(/filename="?([^";]+)"?/i)?.[1];
        if (filename && !node.hasAttribute("download")) node.download = filename;
      } else if (compositions.has(route)) {
        node.href = "#saved-export";
      } else {
        node.removeAttribute("href");
        node.setAttribute("aria-disabled","true");
        node.title = "This artifact is not included in the published snapshot.";
      }
    }
  }
  function mount() {
    const stamp = document.querySelector("#publication-date");
    if (stamp) stamp.textContent = `Exported ${dateLabel()} · Source checks reflect this export.`;
    normalizeLinks(document);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === "attributes") normalizeLinks(record.target);
        for (const node of record.addedNodes || []) if (node.nodeType === 1) normalizeLinks(node);
      }
    });
    observer.observe(document.body,{subtree:true,childList:true,attributes:true,attributeFilter:["data-snapshot-href"]});
    document.addEventListener("click",event => {
      const link = event.target.closest?.("[data-snapshot-href]");
      if (!link) return;
      const route = key(link.dataset.snapshotHref);
      if (!routes.has(route) || compositions.has(route)) {
        event.preventDefault();
        if (compositions.has(route)) void download(link.dataset.snapshotHref,link.download).catch(error => {
          const toast = document.querySelector("#toast");
          if (toast) { toast.textContent = error.message; toast.hidden = false; }
        });
      }
    });
  }
  ready.then(() => {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",mount,{once:true});
    else mount();
  }).catch(error => {
    const stamp = document.querySelector("#publication-date");
    if (stamp) stamp.textContent = error.message;
  });
  return {ready,fetch:snapshotFetch,url,download,dateLabel,get manifest(){return manifest;}};
})();
