/* hona runtime — injected into every artifact.
   1. live reload when the page is republished
   2. comment panel (comments reach the agent through `hona comments`)
   3. window.hona.db — a tiny shared document store for the page */
(() => {
  const slug = location.pathname.split("/")[2];
  if (!slug) return;
  const api = (p, o = {}) =>
    fetch("/api/" + p, { headers: { "Content-Type": "application/json" }, ...o }).then((r) => (r.ok ? r.json() : Promise.reject(r)));

  // ── data store ──────────────────────────────────────────────────────────
  const base = (c) => `db/${slug}/${encodeURIComponent(c)}`;
  window.hona = {
    slug,
    db: {
      list: (c) => api(base(c)),
      get: (c, id) => api(`${base(c)}/${encodeURIComponent(id)}`),
      set: (c, id, doc) => api(`${base(c)}/${encodeURIComponent(id)}`, { method: "PUT", body: JSON.stringify(doc) }),
      del: (c, id) => api(`${base(c)}/${encodeURIComponent(id)}`, { method: "DELETE" }),
    },
  };

  // ── comment panel (shadow DOM so artifact CSS can't touch it) ───────────
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;z-index:2147483647;inset:auto 16px 16px auto;";
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `
  <style>
    :host{all:initial}
    *{box-sizing:border-box;font:14px/1.5 ui-sans-serif,system-ui,sans-serif}
    .t{--bg:#faf7f2;--sf:#fff;--tx:#1a1512;--mu:#6f655b;--ln:#e4ddd2;--ac:#e8590c;--ai:#fff}
    @media (prefers-color-scheme:dark){.t{--bg:#141110;--sf:#1c1816;--tx:#f3ece3;--mu:#a1968a;--ln:#2e2823;--ac:#ff7a3d;--ai:#1a1512}}
    .fab{width:44px;height:44px;border-radius:50%;border:0;background:var(--ac);cursor:pointer;display:grid;place-items:center;position:relative;box-shadow:0 4px 18px #0004}
    .fab svg{width:24px;height:24px}
    .n{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;background:var(--tx);color:var(--bg);font:700 11px/18px ui-monospace,monospace;text-align:center;padding:0 4px}
    .n:empty{display:none}
    .p{position:fixed;right:16px;bottom:72px;width:360px;max-width:calc(100vw - 32px);max-height:70vh;display:none;flex-direction:column;
       background:var(--bg);color:var(--tx);border:1px solid var(--ln);border-radius:12px;box-shadow:0 12px 40px #0005;overflow:hidden}
    .p.open{display:flex}
    h4{margin:0;padding:12px 14px;border-bottom:1px solid var(--ln);font:700 13px ui-monospace,monospace;display:flex;justify-content:space-between}
    .l{overflow:auto;padding:10px 14px;display:flex;flex-direction:column;gap:12px;flex:1}
    .c{background:var(--sf);border:1px solid var(--ln);border-radius:8px;padding:8px 10px}
    .c.agent{border-left:3px solid var(--ac)}.c.done{opacity:.55}
    .m{font:11px ui-monospace,monospace;color:var(--mu);display:flex;gap:8px;justify-content:space-between}
    .q{margin:4px 0;padding-left:8px;border-left:2px solid var(--ln);color:var(--mu);font-size:12px}
    .txt{white-space:pre-wrap;word-break:break-word}
    button.s{background:none;border:0;color:var(--mu);font:11px ui-monospace,monospace;cursor:pointer;padding:0}
    button.s:hover{color:var(--ac)}
    form{border-top:1px solid var(--ln);padding:10px 14px;display:flex;flex-direction:column;gap:8px}
    textarea{width:100%;resize:vertical;min-height:56px;background:var(--sf);color:var(--tx);border:1px solid var(--ln);border-radius:8px;padding:8px}
    textarea:focus{outline:2px solid var(--ac);outline-offset:-1px}
    .row{display:flex;justify-content:space-between;align-items:center;gap:8px}
    .go{background:var(--ac);color:var(--ai);border:0;border-radius:6px;padding:7px 12px;font:700 12px ui-monospace,monospace;cursor:pointer}
    .chip{flex:1;min-width:0}
    .qp{display:inline-flex;align-items:center;gap:6px;max-width:100%;padding:3px 4px 3px 10px;border-radius:999px;background:var(--sf);border:1px solid var(--ln);color:var(--mu);font:12px ui-monospace,monospace}
    .qp span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .qp button{all:unset;cursor:pointer;width:18px;height:18px;border-radius:50%;text-align:center;line-height:18px;flex:none}
    .qp button:hover{background:var(--ln);color:var(--tx)}
    .empty{color:var(--mu);text-align:center;padding:20px 0}
  </style>
  <div class="t">
    <div class="p" id="p">
      <h4><span>hona · comments</span><span id="st" style="color:var(--mu);font-weight:400"></span></h4>
      <div class="l" id="l"></div>
      <form id="f">
        <textarea id="x" placeholder="Comment for the agent… (⌘/Ctrl+Enter to send)"></textarea>
        <div class="row"><span class="chip" id="chip"></span><button class="go">send</button></div>
      </form>
    </div>
    <button class="fab" id="fab" title="hona comments">
      <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="17" fill="none" stroke="#1a1512" stroke-width="6"/><circle cx="32" cy="32" r="6.5" fill="#1a1512"/></svg>
      <span class="n" id="n"></span>
    </button>
  </div>`;
  const $ = (id) => root.getElementById(id);
  document.documentElement.appendChild(host);

  let comments = [], quote = "";
  const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const open = (v) => { $("p").classList.toggle("open", v ?? !$("p").classList.contains("open")); if ($("p").classList.contains("open")) $("x").focus(); };
  const setQuote = (q) => { quote = q; $("chip").innerHTML = q ? `<span class="qp"><span>“${esc(q.slice(0, 60))}”</span><button type="button" id="qx" title="remove quote">✕</button></span>` : ""; };
  $("chip").addEventListener("click", (e) => { if (e.target.id === "qx") setQuote(""); });

  function render() {
    const open_ = comments.filter((c) => !c.parent && !c.resolved).length;
    $("n").textContent = open_ || "";
    $("st").textContent = comments.length ? `${open_} open` : "";
    const roots = comments.filter((c) => !c.parent);
    $("l").innerHTML = roots.length ? roots.map((r) => {
      const thread = [r, ...comments.filter((c) => c.parent === r.id)];
      return thread.map((c, i) => `<div class="c ${c.author === "agent" ? "agent" : ""} ${r.resolved ? "done" : ""}">
        <div class="m"><span>${esc(c.author)} · ${new Date(c.ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        ${i === 0 ? `<span><button class="s" data-r="${r.id}">reply</button> <button class="s" data-v="${r.id}">${r.resolved ? "reopen" : "resolve"}</button></span>` : ""}</div>
        ${c.quote ? `<div class="q">${esc(c.quote)}</div>` : ""}<div class="txt">${esc(c.text)}</div></div>`).join("");
    }).join("") : `<div class="empty">No comments yet.<br>Select text on the page to comment on it.</div>`;
  }
  let replyTo = null;
  $("l").addEventListener("click", (e) => {
    const t = e.target;
    if (t.dataset.r) { replyTo = +t.dataset.r; $("x").placeholder = "Reply…"; $("x").focus(); }
    if (t.dataset.v) { const c = comments.find((c) => c.id === +t.dataset.v);
      api(`comments/${slug}/${c.id}/${c.resolved ? "reopen" : "resolve"}`, { method: "POST", body: "{}" }).then(load); }
  });
  async function send() {
    const text = $("x").value.trim(); if (!text) return;
    await api(`comments/${slug}`, { method: "POST", body: JSON.stringify({ text, quote, parent: replyTo }) });
    $("x").value = ""; setQuote(""); replyTo = null; $("x").placeholder = "Comment for the agent…"; load();
  }
  $("f").addEventListener("submit", (e) => { e.preventDefault(); send(); });
  $("x").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); });
  $("fab").addEventListener("click", () => open());
  const load = () => api(`comments/${slug}`).then((c) => { comments = c; render(); }).catch(() => {});

  // select text → “comment” pill → inline popover: type, Enter, done (mouse never moves)
  const sel = document.createElement("div");
  sel.style.cssText = "position:absolute;z-index:2147483647;display:none";
  const sr = sel.attachShadow({ mode: "open" });
  sr.innerHTML = `
  <style>
    *{box-sizing:border-box;font:14px/1.5 ui-sans-serif,system-ui,sans-serif}
    .t{--bg:#faf7f2;--sf:#fff;--tx:#1a1512;--mu:#6f655b;--ln:#e4ddd2;--ac:#e8590c;--ai:#fff}
    @media (prefers-color-scheme:dark){.t{--bg:#141110;--sf:#1c1816;--tx:#f3ece3;--mu:#a1968a;--ln:#2e2823;--ac:#ff7a3d;--ai:#1a1512}}
    .pb{display:none;border:0;border-radius:999px;padding:6px 12px;background:var(--ac);color:var(--ai);font:700 12px ui-monospace,monospace;cursor:pointer;box-shadow:0 4px 14px #0004}
    .pop{display:none;width:320px;flex-direction:column;gap:8px;padding:10px;background:var(--bg);color:var(--tx);border:1px solid var(--ln);border-radius:12px;box-shadow:0 12px 40px #0005}
    .t.pill .pb{display:block}.t.pop .pop{display:flex}
    .q{display:inline-block;max-width:100%;padding:3px 10px;border-radius:999px;background:var(--sf);border:1px solid var(--ln);color:var(--mu);font:12px ui-monospace,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;align-self:flex-start}
    textarea{width:100%;min-height:64px;resize:none;background:var(--sf);color:var(--tx);border:1px solid var(--ln);border-radius:8px;padding:8px}
    textarea:focus{outline:2px solid var(--ac);outline-offset:-1px}
    .row{display:flex;justify-content:space-between;align-items:center;gap:8px}
    .hint{font:11px ui-monospace,monospace;color:var(--mu)}
    .go{background:var(--ac);color:var(--ai);border:0;border-radius:999px;padding:6px 14px;font:700 12px ui-monospace,monospace;cursor:pointer}
    .ok{display:none;padding:6px 12px;border-radius:999px;background:var(--tx);color:var(--bg);font:700 12px ui-monospace,monospace}
    .t.done .ok{display:block}
  </style>
  <div class="t">
    <button class="pb" id="pb" type="button">comment</button>
    <form class="pop" id="pf"><span class="q" id="pq"></span>
      <textarea id="px" placeholder="Comment for the agent…"></textarea>
      <div class="row"><span class="hint">Enter send · Esc cancel</span><button class="go">send</button></div></form>
    <div class="ok" id="ok">✔ sent</div>
  </div>`;
  document.documentElement.appendChild(sel);
  const st = sr.querySelector(".t"), mode = (m) => { st.className = "t " + (m || ""); sel.style.display = m ? "block" : "none"; };
  let selQuote = "", anchor = null;
  function place() {  // keep the popover on screen, below the selection or above it
    if (!anchor) return;
    const w = st.classList.contains("pop") ? 320 : 100, h = st.classList.contains("pop") ? 150 : 34;
    const left = Math.min(Math.max(anchor.left, 8), innerWidth - w - 8);
    const top = anchor.bottom + 8 + h > innerHeight ? anchor.top - h - 8 : anchor.bottom + 8;
    sel.style.left = scrollX + left + "px"; sel.style.top = scrollY + Math.max(top, 8) + "px";
  }
  document.addEventListener("mouseup", (e) => {
    if (e.target === sel) return;
    setTimeout(() => {
      const s = getSelection(), t = s.toString().trim();
      if (!t || s.rangeCount === 0) { if (!st.classList.contains("pop")) mode(""); return; }
      const r = s.getRangeAt(0).getBoundingClientRect();
      anchor = { left: r.left, top: r.top, bottom: r.bottom }; selQuote = t.slice(0, 400);
      mode("pill"); place();
    }, 0);
  });
  document.addEventListener("mousedown", (e) => { if (e.target !== sel && st.classList.contains("pop")) mode(""); });
  const openPop = () => {
    sr.getElementById("pq").textContent = "“" + selQuote.slice(0, 80) + "”";
    mode("pop"); place(); sr.getElementById("px").focus();
  };
  sr.getElementById("pb").addEventListener("mousedown", (e) => e.preventDefault());  // keep the highlight
  sr.getElementById("pb").addEventListener("click", openPop);
  async function sendPop() {
    const x = sr.getElementById("px"), text = x.value.trim(); if (!text) return;
    await api(`comments/${slug}`, { method: "POST", body: JSON.stringify({ text, quote: selQuote }) });
    x.value = ""; mode("done"); place(); load(); getSelection().removeAllRanges(); setTimeout(() => mode(""), 1100);
  }
  sr.getElementById("pf").addEventListener("submit", (e) => { e.preventDefault(); sendPop(); });
  sr.getElementById("px").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendPop(); }
    if (e.key === "Escape") mode("");
  });

  // ── live: reload on republish, refresh comments on change ───────────────
  let v = null, c = null;
  const tick = async () => {
    try {
      const j = await api(`poll/${slug}`);
      if (v && j.v !== v) return location.reload();
      if (c !== null && j.c !== c) load();
      v = j.v; c = j.c;
    } catch (e) {}
  };
  load(); tick(); setInterval(tick, 1500);
})();
