/* hona runtime — injected into every artifact.
   1. live reload when the page is republished
   2. comments: panel, selection popover (Alt+C), quote pills
   3. annotations: pins (Alt+P), persistent text highlights, drawing (Alt+M)
   4. window.hona.db — a tiny shared document store for the page
   Everything hona draws lives in shadow roots so artifact CSS can't touch it. */
(() => {
  const STATIC = window.__HONA_STATIC__ || null;   // exported file: read-only, data embedded
  const RO = !!STATIC;
  const slug = STATIC ? STATIC.slug : location.pathname.split("/")[2];
  if (!slug) return;
  const SNAP = new URLSearchParams(location.search).get("hona_snap"); // headless screenshot: show marks only
  function staticApi(p, o = {}) {
    const [kind, , x, y] = p.split("/"), m = (o.method || "GET").toUpperCase(), ok = (v) => Promise.resolve(v);
    if (kind === "comments" && m === "GET") return ok(STATIC.comments);
    if (kind === "decision" && m === "GET") return ok(STATIC.decision);
    if (kind === "choices" && m === "GET") return ok(STATIC.choices);
    if (kind === "versions") return ok([]);
    if (kind === "poll") return ok({ v: 1, c: 0, d: 0, h: 0 });
    if (kind === "db") {  // in-memory only: edits last until the file is closed
      const coll = (STATIC.data[decodeURIComponent(x)] = STATIC.data[decodeURIComponent(x)] || {}), id = y && decodeURIComponent(y);
      if (m === "GET" && !id) return ok(Object.entries(coll).map(([k, v]) => (typeof v === "object" && v ? { id: k, ...v } : { id: k, value: v })));
      if (m === "GET") return id in coll ? ok(coll[id]) : Promise.reject({ status: 404 });
      if (m === "PUT") { coll[id] = JSON.parse(o.body); return ok({ ok: true }); }
      if (m === "DELETE") { delete coll[id]; return ok({ ok: true }); }
    }
    return Promise.reject({ status: 405 });
  }
  const api = STATIC ? staticApi : (p, o = {}) =>
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

  // everything below needs document.body, so wait for it (window.hona above is available immediately)
  const boot = () => {
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const safeColor = (c) => (/^#[0-9a-f]{3,8}$/i.test(c) ? c : "#e03131");
  const TOK = `.t{--bg:#faf7f2;--sf:#fff;--tx:#1a1512;--mu:#6f655b;--ln:#e4ddd2;--ac:#e8590c;--ai:#fff;--bl:#2f6fed;--bi:#fff;--ok:#2b8a3e;--wn:#b7791f}
    @media (prefers-color-scheme:dark){.t{--bg:#141110;--sf:#1c1816;--tx:#f3ece3;--mu:#a1968a;--ln:#2e2823;--ac:#ff7a3d;--ai:#1a1512;--bl:#5b9dff;--bi:#0b1220;--ok:#51cf66;--wn:#fcc419}}`;
  const mkHost = (style, css, html) => {
    const h = document.createElement("div");
    h.style.cssText = style;
    const r = h.attachShadow({ mode: "open" });
    r.innerHTML = `<style>:host{all:initial}*{box-sizing:border-box;font:14px/1.5 ui-sans-serif,system-ui,sans-serif}${TOK}${css}</style><div class="t">${html}</div>`;
    document.documentElement.appendChild(h);
    return [h, r];
  };

  // viewing an older version: just a banner, no annotation tools
  const OLD = !STATIC && location.pathname.match(/\/v\/(\d+)\/?$/);
  if (OLD) {
    const [, br] = mkHost("position:fixed;z-index:2147483647;top:12px;left:50%;transform:translateX(-50%)", `
      .b{display:flex;gap:10px;align-items:center;padding:8px 8px 8px 16px;background:var(--bg);color:var(--tx);border:1px solid var(--wn);border-radius:999px;box-shadow:0 8px 30px #0005;font:700 12px ui-monospace,monospace}
      a,button{border:0;border-radius:999px;padding:6px 12px;background:var(--bl);color:var(--bi);font:700 12px ui-monospace,monospace;cursor:pointer;text-decoration:none}
      button{background:none;color:var(--tx);border:1px solid var(--ln)}`, `<div class="b"><span>Viewing v${OLD[1]}, not the latest</span><a href="/a/${slug}">back to latest</a><button id="rs">restore this version</button></div>`);
    br.getElementById("rs").addEventListener("click", () => api(`restore/${slug}/${OLD[1]}`, { method: "POST", body: "{}" }).then(() => (location.href = `/a/${slug}`)));
    return;
  }
  let comments = [];
  let marksOn = true;
  try { marksOn = localStorage.getItem("hona-marks") !== "off"; } catch (e) {}
  let mode = null;                       // null | "pin" | "draw"
  let choices = {};                      // current picks on option blocks, {group: {value, version}}
  let tmpPin = null, draft = [];         // marks not yet sent
  let flashId = null;                    // comment whose mark is briefly emphasised (go to)
  const roots = () => comments.filter((c) => !c.parent);
  const anchorOf = (c) => c.anchor || (c.quote ? { type: "text", raw: c.quote, prefix: "", suffix: "" } : null);

  // ── text index: robust quote anchoring (prefix + quote + suffix) ────────
  function textIndex() {
    const nodes = []; let text = "";
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (!n.parentElement || /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(n.parentElement.tagName) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
    });
    let n; while ((n = w.nextNode())) { nodes.push({ n, s: text.length }); text += n.nodeValue; }
    return { text, nodes };
  }
  const posToIdx = (ix, node, off) => { const e = ix.nodes.find((x) => x.n === node); return e ? e.s + off : -1; };
  function idxToPos(ix, i) {
    let lo = 0, hi = ix.nodes.length - 1;
    if (hi < 0) return null;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (ix.nodes[m].s <= i) lo = m; else hi = m - 1; }
    const e = ix.nodes[lo]; return [e.n, Math.min(i - e.s, e.n.nodeValue.length)];
  }
  function textAnchor(range) {
    const ix = textIndex(), a = posToIdx(ix, range.startContainer, range.startOffset), b = posToIdx(ix, range.endContainer, range.endOffset);
    if (a < 0 || b <= a) return null;
    const raw = ix.text.slice(a, Math.min(b, a + 400));
    return { quote: raw.replace(/\s+/g, " ").trim(), anchor: { type: "text", raw, prefix: ix.text.slice(Math.max(0, a - 24), a), suffix: ix.text.slice(b, b + 24) } };
  }
  function locate(ix, an) {
    if (!an.raw) return null;
    let i = ix.text.indexOf((an.prefix || "") + an.raw + (an.suffix || ""));
    let start = i >= 0 ? i + (an.prefix || "").length : ix.text.indexOf(an.raw);
    if (start < 0) return null;
    const s = idxToPos(ix, start), e = idxToPos(ix, start + an.raw.length);
    if (!s || !e) return null;
    const r = document.createRange(); r.setStart(...s); r.setEnd(...e); return r;
  }

  // ── element anchoring for pins ──────────────────────────────────────────
  function cssPath(el) {
    const parts = [];
    while (el && el.nodeType === 1 && el !== document.documentElement) {
      if (el.id && document.querySelectorAll("#" + CSS.escape(el.id)).length === 1) { parts.unshift("#" + CSS.escape(el.id)); break; }
      let s = el.tagName.toLowerCase(); const p = el.parentElement;
      if (p) { const sib = [...p.children].filter((c) => c.tagName === el.tagName); if (sib.length > 1) s += `:nth-of-type(${sib.indexOf(el) + 1})`; }
      parts.unshift(s); el = el.parentElement;
    }
    return parts.join(" > ");
  }
  const labelOf = (el) => {
    const t = (el.innerText || el.alt || el.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().slice(0, 40);
    return el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (t ? ` “${t}”` : "");
  };
  const docSize = () => {
    const dt = document.documentElement.dataset.theme;
    return { vw: document.documentElement.clientWidth, docH: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
             theme: dt === "light" || dt === "dark" ? dt : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light" };
  };
  function pinPos(an) {
    let el = null; try { el = an.selector && document.querySelector(an.selector); } catch (e) {}
    if (el) { const r = el.getBoundingClientRect(); if (r.width || r.height) return [scrollX + r.left + an.ox * r.width, scrollY + r.top + an.oy * r.height]; }
    return [an.x * (document.documentElement.clientWidth / (an.vw || 1)), an.y];
  }

  // ── drawing → svg ───────────────────────────────────────────────────────
  function strokeSvg(s, sx = 1) {
    const P = s.pts.map(([x, y]) => [Math.round(x * sx * 10) / 10, y]), col = safeColor(s.color);
    const a = `stroke="${col}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"`;
    if (s.tool === "pen") return `<polyline points="${P.map((p) => p.join(",")).join(" ")}" fill="none" ${a}/>`;
    const [x1, y1] = P[0], [x2, y2] = P[P.length - 1];
    if (s.tool === "box") return `<rect x="${Math.min(x1, x2)}" y="${Math.min(y1, y2)}" width="${Math.abs(x2 - x1)}" height="${Math.abs(y2 - y1)}" rx="4" fill="${col}" fill-opacity=".08" ${a}/>`;
    const g = Math.atan2(y2 - y1, x2 - x1), L = 14;
    const p1 = [x2 - L * Math.cos(g - 0.45), y2 - L * Math.sin(g - 0.45)], p2 = [x2 - L * Math.cos(g + 0.45), y2 - L * Math.sin(g + 0.45)];
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" ${a}/><polygon points="${x2},${y2} ${p1.map((n) => n.toFixed(1))} ${p2.map((n) => n.toFixed(1))}" fill="${col}" stroke="none"/>`;
  }

  // ── overlay layer: pins, marks, drawing draft (document coordinates) ────
  const [layer, lr] = mkHost("position:absolute;left:0;top:0;width:0;height:0;overflow:visible;z-index:2147483000;pointer-events:none", `
    svg{position:absolute;left:0;top:0;overflow:visible}
    .pin{position:absolute;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;background:var(--bl);color:var(--bi);
         font:700 11px/20px ui-monospace,monospace;text-align:center;box-shadow:0 2px 8px #0005;cursor:pointer;pointer-events:auto;border:2px solid var(--bi)}
    .pin.done{background:#888;opacity:.45}.pin.tmp{animation:p 1s infinite}.pin.sq{border-radius:6px}
    @keyframes p{50%{transform:scale(1.18)}} g.done{opacity:.3}`, `<svg id="svg" width="1" height="1"><g id="marks"></g><g id="draft"></g></svg><div id="pins"></div>`);
  const L = (id) => lr.getElementById(id);

  function renderMarks() {
    const only = SNAP && SNAP !== "all" ? +SNAP : null;
    const sx = document.documentElement.clientWidth;
    let svg = "", pins = "";
    if (marksOn || SNAP) for (const c of roots()) {
      if (only !== null && c.id !== only) continue;
      if (c.pinned === false && c.id !== flashId) continue;
      const an = c.anchor, cls = (c.resolved && only === null ? " done" : "") + (c.id === flashId ? " tmp" : "");
      if (c.resolved && SNAP && only === null) continue;
      if (an && an.type === "pin") { const [x, y] = pinPos(an); pins += `<div class="pin${cls}" data-t="${c.id}" style="left:${x}px;top:${y}px">${c.id}</div>`; }
      if (an && an.type === "draw" && an.strokes && an.strokes.length) {
        const k = sx / (an.vw || sx);
        svg += `<g class="${cls.replace(" tmp", "").trim()}">${an.strokes.map((s) => strokeSvg(s, k)).join("")}</g>`;
        const [px, py] = an.strokes[0].pts[0]; pins += `<div class="pin sq${cls}" data-t="${c.id}" style="left:${px * k}px;top:${py}px">${c.id}</div>`;
      }
    }
    if (tmpPin) pins += `<div class="pin tmp" style="left:${tmpPin.x}px;top:${tmpPin.y}px">+</div>`;
    L("marks").innerHTML = svg; L("pins").innerHTML = pins;
    renderDraft();
  }
  const renderDraft = () => { L("draft").innerHTML = draft.map((s) => strokeSvg(s)).join(""); };
  lr.addEventListener("click", (e) => { const t = e.target.closest && e.target.closest("[data-t]"); if (t) focusThread(+t.dataset.t); });

  // ── persistent text highlights (CSS Custom Highlight API; no DOM changes) ──
  const hs = document.createElement("style");
  hs.textContent = "::highlight(hona){background:rgba(47,111,237,.3)}::highlight(hona-done){background:rgba(128,128,128,.18)}::highlight(hona-flash){background:rgba(245,159,0,.55)}";
  document.documentElement.appendChild(hs);
  let hlRanges = [];
  function renderHighlights() {
    hlRanges = [];
    if (!(window.CSS && CSS.highlights && window.Highlight)) return;
    const act = [], done = [];
    if (marksOn || SNAP) {
      const ix = textIndex();
      for (const c of roots()) {
        if (SNAP && SNAP !== "all" && c.id !== +SNAP) continue;
        if (c.pinned === false) continue;
        const an = anchorOf(c); if (!an || an.type !== "text") continue;
        const r = locate(ix, an); if (!r) continue;
        hlRanges.push({ id: c.id, r }); (c.resolved ? done : act).push(r);
      }
    }
    CSS.highlights.set("hona", new Highlight(...act)); CSS.highlights.set("hona-done", new Highlight(...done));
  }
  document.addEventListener("click", (e) => {
    if (mode || !getSelection().isCollapsed) return;
    for (const h of hlRanges) for (const q of h.r.getClientRects())
      if (e.clientX >= q.left && e.clientX <= q.right && e.clientY >= q.top && e.clientY <= q.bottom) return focusThread(h.id);
  });

  const renderAll = () => { renderMarks(); renderHighlights(); };
  function goTo(id) {  // scroll to a pinned item and flash it, even if it is currently unpinned
    const c = comments.find((x) => x.id === id), an = c && anchorOf(c); if (!an) return;
    let y = null;
    if (an.type === "pin") y = pinPos(an)[1];
    else if (an.type === "draw") y = an.strokes[0].pts[0][1];
    else { const r = locate(textIndex(), an); if (r) { y = scrollY + r.getBoundingClientRect().top;
      if (window.CSS && CSS.highlights && window.Highlight) { CSS.highlights.set("hona-flash", new Highlight(r)); setTimeout(() => CSS.highlights.delete("hona-flash"), 1600); } } }
    if (y === null) return;
    scrollTo({ top: Math.max(0, y - innerHeight / 3), behavior: "smooth" });
    flashId = id; renderMarks(); setTimeout(() => { flashId = null; renderMarks(); }, 1600);
  }
  let rt = 0; const later = () => { clearTimeout(rt); rt = setTimeout(renderAll, 120); };
  addEventListener("resize", later); addEventListener("load", later);
  if (window.ResizeObserver) new ResizeObserver(later).observe(document.body);

  let focusThread = () => {}, load = () => api(`comments/${slug}`).then((c) => { comments = c; renderAll(); }).catch(() => {});

  // snapshot mode: only the marks, no UI, no polling
  if (SNAP) { load(); return; }

  // ── comment panel ───────────────────────────────────────────────────────
  const [host, root] = mkHost("position:fixed;z-index:2147483647;inset:auto 16px 16px auto", `
    .wrap{position:relative;width:44px;height:44px}
    .fab{width:44px;height:44px;border-radius:50%;border:0;background:var(--ac);cursor:pointer;display:grid;place-items:center;position:relative;box-shadow:0 4px 18px #0004}
    .fab svg{width:24px;height:24px}
    .n{position:absolute;top:-4px;right:-4px;min-width:18px;height:18px;border-radius:9px;background:var(--tx);color:var(--bg);font:700 11px/18px ui-monospace,monospace;text-align:center;padding:0 4px}
    .n:empty{display:none}
    .dock{position:absolute;right:0;bottom:54px;display:none;flex-direction:column;align-items:flex-end;gap:6px}
    .t.tools .dock{display:flex}
    .dk{display:flex;align-items:center;gap:10px;border:1px solid var(--ln);background:var(--bg);color:var(--tx);border-radius:999px;padding:7px 14px;font:700 12px ui-monospace,monospace;cursor:pointer;box-shadow:0 2px 10px #0003;white-space:nowrap}
    .dk kbd{font:11px ui-monospace,monospace;color:var(--mu);font-weight:400}.dk.on kbd{color:inherit;opacity:.8}
    .dk b{background:var(--tx);color:var(--bg);border-radius:9px;min-width:18px;padding:0 5px;font:700 11px/18px ui-monospace,monospace;text-align:center}.dk b:empty{display:none}
    .dk:hover{border-color:var(--bl)}.dk.on{background:var(--bl);color:var(--bi);border-color:var(--bl)}
    .t.ro .xr,.t.ro form,.t.ro button.s[data-r],.t.ro button.s[data-v],.t.ro button.s[data-p],.t.ro button.s[data-del],.t.ro .dsep{display:none!important}
    .undo{display:none;justify-content:space-between;align-items:center;padding:8px 14px;border-top:1px solid var(--ln);background:var(--sf);font:12px ui-monospace,monospace}
    .dk.okb{border-color:var(--ok);color:var(--ok)}.dk.okb.on{background:var(--ok);color:#fff}
    .dk.wnb{border-color:var(--wn);color:var(--wn)}.dk.wnb.on{background:var(--wn);color:#1a1512}
    .dsep{height:1px;width:70%;background:var(--ln);margin:2px 0}
    .dec{position:absolute;z-index:2;left:-3px;bottom:-3px;width:20px;height:20px;border-radius:50%;font:700 10px/16px ui-monospace,monospace;text-align:center;color:#fff;display:none;border:2px solid var(--bg)}
    .dbn{border:1px solid var(--ln);border-left:3px solid var(--ok);border-radius:8px;padding:8px 10px;font:12px ui-monospace,monospace;background:var(--sf)}
    .dbn.wn{border-left-color:var(--wn)}.dbn.stale{opacity:.6}.dbn div{margin-top:4px;font:13px ui-sans-serif,system-ui,sans-serif;white-space:pre-wrap}
    .diff{font:12px/1.5 ui-monospace,monospace;white-space:pre-wrap;word-break:break-word;padding:2px 8px;border-radius:4px}
    .diff.add{background:color-mix(in srgb,var(--ok) 18%,transparent)}.diff.del{background:color-mix(in srgb,#e03131 18%,transparent)}
    .p{position:fixed;right:16px;bottom:72px;width:380px;max-width:calc(100vw - 32px);max-height:70vh;display:none;flex-direction:column;
       background:var(--bg);color:var(--tx);border:1px solid var(--ln);border-radius:12px;box-shadow:0 12px 40px #0005;overflow:hidden}
    .p.open{display:flex}
    h4{margin:0;padding:12px 14px;border-bottom:1px solid var(--ln);font:700 13px ui-monospace,monospace;display:flex;justify-content:space-between;align-items:center;gap:8px}
    h4 .r{font-weight:400;color:var(--mu);display:flex;gap:10px;align-items:center}
    .tabs{display:flex;gap:4px}
    .tab{border:0;background:none;color:var(--mu);font:700 12px ui-monospace,monospace;padding:3px 8px;border-radius:999px;cursor:pointer}
    .tab:hover{color:var(--tx)}.tab.on{background:var(--bl);color:var(--bi)}
    .l{overflow:auto;padding:10px 14px;display:flex;flex-direction:column;gap:12px;flex:1}
    .th{display:flex;flex-direction:column;gap:6px;border-radius:10px}.th.flash{outline:2px solid var(--bl);outline-offset:3px}
    .c{background:var(--sf);border:1px solid var(--ln);border-radius:8px;padding:8px 10px}
    .c.agent{border-left:3px solid var(--ac)}.th.done .c{opacity:.55}
    .m{font:11px ui-monospace,monospace;color:var(--mu);display:flex;gap:8px;justify-content:space-between}
    .q{margin:4px 0;padding-left:8px;border-left:2px solid var(--ln);color:var(--mu);font-size:12px}
    .kind{display:inline-block;margin:4px 0;padding:2px 9px;border-radius:999px;background:var(--bl);color:var(--bi);font:700 11px ui-monospace,monospace;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .txt{white-space:pre-wrap;word-break:break-word}
    button.s{background:none;border:0;color:var(--mu);font:11px ui-monospace,monospace;cursor:pointer;padding:0}
    button.s:hover{color:var(--bl)}
    .m button+button{margin-left:10px}
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
    .empty{color:var(--mu);text-align:center;padding:20px 0}`, `
    <div class="p" id="p">
      <h4><span class="tabs"><button class="tab" id="tc" type="button">comments</button><button class="tab" id="tp" type="button">pinned</button><button class="tab xr" id="th" type="button">history</button></span><span class="r"><span id="st"></span><button class="s" id="mk" type="button"></button></span></h4>
      <div class="l" id="l"></div>
      <div class="undo" id="undo"><span>Comment deleted</span><button class="s" id="undob" type="button">undo</button></div>
      <form id="f">
        <textarea id="x" placeholder="Comment for the agent… (Ctrl+Enter to send)"></textarea>
        <div class="row"><span class="chip" id="chip"></span><button class="go">send</button></div>
      </form>
    </div>
    <div class="wrap">
      <div class="dock">
        <button class="dk okb xr" id="dok" type="button" title="Approve this version">approve</button>
        <button class="dk wnb xr" id="dch" type="button" title="Request changes">request changes</button>
        <span class="dsep"></span>
        <button class="dk" id="dcm" type="button">comments <b id="dn"></b><kbd>Alt+C</kbd></button>
        <button class="dk" id="dpd" type="button" title="See and unpin pinned comments">pinned <b id="dpn"></b></button>
        <button class="dk xr" id="dpin" type="button" title="Drop a pin on the page">pin <kbd>Alt+P</kbd></button>
        <button class="dk xr" id="ddraw" type="button" title="Draw on the page">draw <kbd>Alt+M</kbd></button>
        <span class="dsep"></span>
        <button class="dk xr" id="dhist" type="button" title="Version history and diff">history <b id="dvn"></b></button>
      </div>
      <span class="dec" id="dec"></span>
      <button class="fab" id="fab" title="hona">
        <svg viewBox="0 0 64 64"><circle cx="32" cy="32" r="17" fill="none" stroke="#1a1512" stroke-width="6"/><circle cx="32" cy="32" r="6.5" fill="#1a1512"/></svg>
        <span class="n" id="n"></span>
      </button>
    </div>`);
  const $ = (id) => root.getElementById(id);
  const tEl = root.querySelector(".t"); tEl.classList.toggle("ro", RO);
  let quote = "", replyTo = null;
  const open = (v) => { const on = v ?? !$("p").classList.contains("open"); $("p").classList.toggle("open", on); tEl.classList.toggle("open", on); if (on) $("x").focus(); };
  const setQuote = (q) => { quote = q; $("chip").innerHTML = q ? `<span class="qp"><span>“${esc(q.slice(0, 60))}”</span><button type="button" id="qx" title="remove quote">✕</button></span>` : ""; };
  $("chip").addEventListener("click", (e) => { if (e.target.id === "qx") setQuote(""); });

  let lastDel = null, undoT = 0;
  let view = "comments", decision = null, versions = [], diffView = null, armed = null;
  const loadDecision = () => api(`decision/${slug}`).then((d) => { decision = d; render(); }).catch(() => {});
  const loadVersions = () => api(`versions/${slug}`).then((v) => { versions = v; render(); }).catch(() => {});
  const T = (ts) => new Date(ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const decWord = (d) => (d.decision === "approve" ? "Approved" : "Changes requested");
  const decBanner = () => {
    let out = STATIC ? `<div class="dbn stale">Exported copy of v${STATIC.version}, ${new Date(STATIC.exported * 1000).toLocaleDateString()}. Read-only.</div>` : "";
    const d = decision && decision.current;
    if (d) out += `<div class="dbn ${d.decision === "approve" ? "" : "wn"} ${decision.stale ? "stale" : ""}">${decWord(d)} on v${d.version}${decision.stale ? ` · v${decision.version} awaits review` : ""}${d.note ? `<div>${esc(d.note)}</div>` : ""}</div>`;
    const g = Object.entries(choices);
    if (g.length) out += `<div class="dbn">Picked: ${g.map(([k, x]) => esc(k) + " = " + esc(x.value)).join(" · ")}</div>`;
    return out;
  };
  function renderHistory() {
    if (diffView) {
      $("l").innerHTML = `<div class="m"><button class="s" data-back="1">back to history</button><span>v${diffView.a} to v${diffView.b}</span></div>` +
        (diffView.lines.length ? diffView.lines.map((x) => `<div class="diff ${x.t === "+" ? "add" : "del"}">${x.t} ${esc(x.s)}</div>`).join("") : `<div class="empty">No visible text changes (layout or styling only).</div>`);
      return;
    }
    $("l").innerHTML = decBanner() + (versions.length ? versions.map((v, i) => `<div class="c"><div class="m"><span>v${v.n}${i === 0 ? " · current" : ""} · ${T(v.ts)} · ${Math.round(v.size / 1024 * 10) / 10} KB</span>
      <span><button class="s" data-vv="${v.n}">view</button>${versions[i + 1] ? ` <button class="s" data-vd="${v.n}">diff</button>` : ""}${i ? ` <button class="s" data-vr="${v.n}">${armed === v.n ? "sure?" : "restore"}</button>` : ""}</span></div>
      ${v.decision ? `<span class="kind" style="background:var(--${v.decision.decision === "approve" ? "ok" : "wn"});color:${v.decision.decision === "approve" ? "#fff" : "#1a1512"}">${v.decision.decision === "approve" ? "approved" : "changes requested"}</span>` : ""}
      ${v.decision && v.decision.note ? `<div class="txt">${esc(v.decision.note)}</div>` : ""}</div>`).join("") : `<div class="empty">No history yet.</div>`);
  }
  const pinLabel = (c) => {
    const a = anchorOf(c);
    if (a.type === "pin") return `pin · ${esc(a.label || "")}`;
    if (a.type === "draw") return `drawing · ${(a.strokes || []).length} mark${(a.strokes || []).length === 1 ? "" : "s"}`;
    return `text · “${esc((c.quote || a.raw || "").slice(0, 50))}”`;
  };
  function renderPinned() {
    const rs = roots().filter((c) => anchorOf(c));
    $("l").innerHTML = rs.length ? rs.map((c) => `<div class="th ${c.resolved ? "done" : ""}" data-t="${c.id}"><div class="c">
      <div class="m"><span>#${c.id} ${esc(c.author)} · ${new Date(c.ts * 1000).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
        <span><button class="s" data-g="${c.id}">go to</button> <button class="s" data-p="${c.id}">${c.pinned === false ? "re-pin" : "unpin"}</button></span></div>
      <span class="kind" style="${c.pinned === false ? "background:var(--mu)" : ""}">${pinLabel(c)}</span>
      <div class="txt">${esc(c.text.slice(0, 140))}${c.text.length > 140 ? "…" : ""}</div>
      ${c.pinned === false ? `<div class="q">unpinned · marks hidden on the page</div>` : ""}</div></div>`).join("")
      : `<div class="empty">Nothing pinned yet.<br>Use pin, draw, or comment on selected text.</div>`;
  }
  const kindOf = (c) => {
    const a = c.anchor; if (!a) return "";
    if (a.type === "pin") return `<span class="kind">pin · ${esc(a.label || "")}</span>`;
    if (a.type === "draw") return `<span class="kind">drawing · ${(a.strokes || []).length} mark${(a.strokes || []).length === 1 ? "" : "s"}</span>`;
    return "";
  };
  function render() {
    const rs = roots(), open_ = rs.filter((c) => !c.resolved).length;
    const pinned = rs.filter((c) => anchorOf(c) && c.pinned !== false).length;
    $("n").textContent = open_ || ""; $("dn").textContent = open_ || ""; $("dpn").textContent = pinned || "";
    $("st").textContent = view === "pinned" ? `${pinned} pinned` : comments.length ? `${open_} open` : "";
    $("tc").classList.toggle("on", view === "comments"); $("tp").classList.toggle("on", view === "pinned"); $("th").classList.toggle("on", view === "history");
    $("f").style.display = view === "comments" ? "" : "none";
    const dc = decision && decision.current, fresh = dc && !decision.stale;
    $("dok").classList.toggle("on", !!(fresh && dc.decision === "approve")); $("dch").classList.toggle("on", !!(fresh && dc.decision === "changes"));
    $("dok").textContent = fresh && dc.decision === "approve" ? "approved" : "approve"; $("dch").textContent = fresh && dc.decision === "changes" ? "changes requested" : "request changes";
    const dd = $("dec"); dd.style.display = fresh ? "block" : "none"; if (fresh) { dd.textContent = dc.decision === "approve" ? "ok" : "!"; dd.style.background = dc.decision === "approve" ? "var(--ok)" : "var(--wn)"; dd.style.color = dc.decision === "approve" ? "#fff" : "#1a1512"; }
    $("dvn").textContent = decision && decision.version > 1 ? "v" + decision.version : "";
    if (view === "history") return renderHistory();
    $("mk").textContent = marksOn ? "marks on" : "marks off";
    if (view === "pinned") return renderPinned();
    $("l").innerHTML = decBanner() + (rs.length ? rs.map((r) => {
      const thread = [r, ...comments.filter((c) => c.parent === r.id)];
      return `<div class="th ${r.resolved ? "done" : ""}" data-t="${r.id}">` + thread.map((c, i) => `<div class="c ${c.author === "agent" ? "agent" : ""}">
        <div class="m"><span>#${c.id} ${esc(c.author)} · ${T(c.ts)}${i === 0 && c.version ? " · v" + c.version : ""}</span>
        ${i === 0 ? `<span><button class="s" data-r="${r.id}">reply</button> <button class="s" data-v="${r.id}">${r.resolved ? "reopen" : "resolve"}</button> <button class="s" data-del="${r.id}">delete</button></span>` : ""}</div>
        ${i === 0 ? kindOf(c) : ""}${c.quote ? `<div class="q">${esc(c.quote)}</div>` : ""}<div class="txt">${esc(c.text)}</div></div>`).join("") + `</div>`;
    }).join("") : `<div class="empty">No comments yet.<br>Select text, or use pin / draw.</div>`);
  }
  focusThread = (id) => {
    view = "comments"; render(); open(true); const el = $("l").querySelector(`[data-t="${id}"]`); if (!el) return;
    el.scrollIntoView({ block: "nearest" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1300);
  };
  $("l").addEventListener("click", (e) => {
    const t = e.target;
    if (t.dataset.g) goTo(+t.dataset.g);
    if (t.dataset.del) {
      const id = +t.dataset.del; api(`comments/${slug}/${id}/delete`, { method: "POST", body: "{}" }).then(() => {
        lastDel = id; $("undo").style.display = "flex"; clearTimeout(undoT); undoT = setTimeout(() => ($("undo").style.display = "none"), 8000); load();
      });
    }
    if (t.dataset.back) { diffView = null; render(); }
    if (t.dataset.vv) location.href = +t.dataset.vv === versions[0].n ? `/a/${slug}` : `/a/${slug}/v/${t.dataset.vv}`;
    if (t.dataset.vd) {
      const i = versions.findIndex((v) => v.n === +t.dataset.vd), prev = versions[i + 1]; if (!prev) return;
      api(`diff/${slug}/${prev.n}/${t.dataset.vd}`).then((d) => { diffView = { a: prev.n, b: +t.dataset.vd, lines: d.lines }; render(); });
    }
    if (t.dataset.vr) { const n = +t.dataset.vr; if (armed === n) { armed = null; api(`restore/${slug}/${n}`, { method: "POST", body: "{}" }).then(loadVersions); } else { armed = n; render(); setTimeout(() => { if (armed === n) { armed = null; render(); } }, 3000); } }
    if (t.dataset.p) { const c = comments.find((c) => c.id === +t.dataset.p);
      api(`comments/${slug}/${c.id}/${c.pinned === false ? "pin" : "unpin"}`, { method: "POST", body: "{}" }).then(load); }
    if (t.dataset.r) { replyTo = +t.dataset.r; $("x").placeholder = "Reply…"; $("x").focus(); }
    if (t.dataset.v) { const c = comments.find((c) => c.id === +t.dataset.v);
      api(`comments/${slug}/${c.id}/${c.resolved ? "reopen" : "resolve"}`, { method: "POST", body: "{}" }).then(load); }
  });
  $("mk").addEventListener("click", () => {
    marksOn = !marksOn; try { localStorage.setItem("hona-marks", marksOn ? "on" : "off"); } catch (e) {}
    render(); renderAll();
  });
  async function send() {
    const text = $("x").value.trim(); if (!text) return;
    await api(`comments/${slug}`, { method: "POST", body: JSON.stringify({ text, quote, parent: replyTo }) });
    $("x").value = ""; setQuote(""); replyTo = null; $("x").placeholder = "Comment for the agent…"; load();
  }
  $("f").addEventListener("submit", (e) => { e.preventDefault(); send(); });
  $("x").addEventListener("keydown", (e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); });
  const tools = (v) => tEl.classList.toggle("tools", v ?? !tEl.classList.contains("tools"));
  $("undob").addEventListener("click", () => { api(`comments/${slug}/${lastDel}/undelete`, { method: "POST", body: "{}" }).then(() => { $("undo").style.display = "none"; load(); }); });
  $("fab").addEventListener("click", () => { if ($("p").classList.contains("open")) open(false); else tools(); });
  const show = (v) => { view = v; render(); open(true); };
  $("dcm").addEventListener("click", () => { tools(false); show("comments"); });
  $("dpd").addEventListener("click", () => { tools(false); show("pinned"); });
  $("th").addEventListener("click", () => { view = "history"; diffView = null; loadVersions(); render(); });
  $("dhist").addEventListener("click", () => { tools(false); view = "history"; diffView = null; loadVersions(); render(); open(true); });
  $("dok").addEventListener("click", () => { tools(false); api(`decision/${slug}`, { method: "POST", body: JSON.stringify({ decision: "approve" }) }).then(() => { loadDecision(); toast("approved"); }); });
  $("dch").addEventListener("click", () => { tools(false); compose({ decision: "changes" }, { left: innerWidth - 350, top: innerHeight - 120, bottom: innerHeight - 120 }, "request changes · what should change?"); });
  $("tc").addEventListener("click", () => { view = "comments"; render(); }); $("tp").addEventListener("click", () => { view = "pinned"; render(); });
  document.addEventListener("mousedown", (e) => { if (!e.composedPath().includes(host)) tools(false); });
  const baseLoad = load;
  load = () => baseLoad().then(render);

  // ── composer: inline popover used by text, pin and drawing ──────────────
  const [sel, sr] = mkHost("position:absolute;z-index:2147483647;display:none", `
    .pb{display:none;border:0;border-radius:999px;padding:6px 12px;background:var(--bl);color:var(--bi);font:700 12px ui-monospace,monospace;cursor:pointer;box-shadow:0 4px 14px #0004}
    .pop{display:none;width:320px;flex-direction:column;gap:8px;padding:10px;background:var(--bg);color:var(--tx);border:1px solid var(--ln);border-radius:12px;box-shadow:0 12px 40px #0005}
    .t.m-pill .pb{display:block}.t.m-pop .pop{display:flex}
    .q{display:inline-block;max-width:100%;padding:3px 10px;border-radius:999px;background:var(--sf);border:1px solid var(--ln);color:var(--mu);font:12px ui-monospace,monospace;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;align-self:flex-start}
    textarea{width:100%;min-height:64px;resize:none;background:var(--sf);color:var(--tx);border:1px solid var(--ln);border-radius:8px;padding:8px}
    textarea:focus{outline:2px solid var(--bl);outline-offset:-1px}
    .row{display:flex;justify-content:space-between;align-items:center;gap:8px}
    .hint{font:11px ui-monospace,monospace;color:var(--mu)}
    .go{background:var(--bl);color:var(--bi);border:0;border-radius:999px;padding:6px 14px;font:700 12px ui-monospace,monospace;cursor:pointer}
    .ok{display:none;padding:6px 12px;border-radius:999px;background:var(--tx);color:var(--bg);font:700 12px ui-monospace,monospace}
    .t.m-done .ok{display:block}`, `
    <button class="pb" id="pb" type="button">comment</button>
    <form class="pop" id="pf"><span class="q" id="pq"></span>
      <textarea id="px" placeholder="Comment for the agent…"></textarea>
      <div class="row"><span class="hint">Enter send · Esc cancel</span><button class="go">send</button></div></form>
    <div class="ok" id="ok">sent</div>`);
  const st = sr.querySelector(".t");
  let pending = null, anchorRect = null;
  const cm = (m) => { st.className = "t" + (m ? " m-" + m : ""); sel.style.display = m ? "block" : "none"; };
  const composing = () => st.classList.contains("m-pop");
  function finish() {  // discard unsent marks and close
    tmpPin = null; draft = []; pending = null; cm(""); renderMarks();
  }
  function toast(msg) {
    anchorRect = { left: innerWidth - 180, top: innerHeight - 70, bottom: innerHeight - 70 };
    sr.getElementById("ok").textContent = msg; cm("done"); place(); setTimeout(() => cm(""), 1300);
  }
  function place() {
    if (!anchorRect) return;
    const pop = composing(), w = pop ? 320 : 100, h = pop ? 150 : 34;
    const left = Math.min(Math.max(anchorRect.left, 8), innerWidth - w - 8);
    const top = anchorRect.bottom + 8 + h > innerHeight ? anchorRect.top - h - 8 : anchorRect.bottom + 8;
    sel.style.left = scrollX + left + "px"; sel.style.top = scrollY + Math.max(top, 8) + "px";
  }
  function compose(p, rect, label) {
    pending = p; anchorRect = rect;
    sr.getElementById("pq").textContent = label; cm("pop"); place(); sr.getElementById("px").focus();
  }
  function fromSelection() {
    const s = getSelection();
    if (!s.rangeCount || !s.toString().trim()) return null;
    const r = s.getRangeAt(0), b = r.getBoundingClientRect(), ta = textAnchor(r);
    const q = ta ? ta.quote : s.toString().trim().replace(/\s+/g, " ").slice(0, 400);
    return { p: { quote: q, anchor: ta ? ta.anchor : null }, rect: { left: b.left, top: b.top, bottom: b.bottom } };
  }
  let selPending = null;
  document.addEventListener("mouseup", (e) => {
    if (RO || e.target === sel || mode) return;
    setTimeout(() => {
      const f = fromSelection();
      if (!f) { if (!composing()) cm(""); return; }
      selPending = f; anchorRect = f.rect; cm("pill"); place();
    }, 0);
  });
  document.addEventListener("mousedown", (e) => { if (composing() && !e.composedPath().includes(sel)) finish(); });
  sr.getElementById("pb").addEventListener("mousedown", (e) => e.preventDefault());  // keep the highlight
  sr.getElementById("pb").addEventListener("click", () => selPending && compose(selPending.p, selPending.rect, "“" + selPending.p.quote.slice(0, 80) + "”"));
  async function sendPop() {
    const x = sr.getElementById("px"), text = x.value.trim(); if (!text || !pending) return;
    const isDec = !!pending.decision;
    if (isDec) await api(`decision/${slug}`, { method: "POST", body: JSON.stringify({ decision: pending.decision, note: text }) });
    else await api(`comments/${slug}`, { method: "POST", body: JSON.stringify({ text, quote: pending.quote || "", anchor: pending.anchor || undefined }) });
    sr.getElementById("ok").textContent = isDec ? "changes requested" : "sent";
    x.value = ""; tmpPin = null; draft = []; pending = null; cm("done"); place(); isDec ? loadDecision() : load(); getSelection().removeAllRanges(); setTimeout(() => cm(""), 1100);
  }
  sr.getElementById("pf").addEventListener("submit", (e) => { e.preventDefault(); sendPop(); });
  sr.getElementById("px").addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendPop(); }
    if (e.key === "Escape") finish();
  });

  // ── pin mode ────────────────────────────────────────────────────────────
  const modeStyle = document.createElement("style");
  modeStyle.textContent = "html.hona-pin,html.hona-pin *{cursor:crosshair!important}";
  document.documentElement.appendChild(modeStyle);
  document.addEventListener("click", (e) => {
    if (mode !== "pin" || e.composedPath().some((n) => n === host || n === sel || n === layer)) return;
    e.preventDefault(); e.stopPropagation();
    const el = document.elementFromPoint(e.clientX, e.clientY) || document.body, r = el.getBoundingClientRect();
    const anchor = { type: "pin", selector: cssPath(el), ox: (e.clientX - r.left) / (r.width || 1), oy: (e.clientY - r.top) / (r.height || 1), x: e.pageX, y: e.pageY, label: labelOf(el), ...docSize() };
    setMode(null); tmpPin = { x: e.pageX, y: e.pageY }; renderMarks();
    compose({ quote: "", anchor }, { left: e.clientX, top: e.clientY - 12, bottom: e.clientY + 12 }, "pin · " + anchor.label);
  }, true);

  // ── draw mode ───────────────────────────────────────────────────────────
  const COLORS = ["#e03131", "#2f6fed", "#f59f00"];
  let tool = "pen", color = COLORS[0];
  const [dh, dr] = mkHost("position:fixed;inset:0;z-index:2147483646;display:none;pointer-events:none", `
    .cv{position:fixed;inset:0;pointer-events:auto;cursor:crosshair;touch-action:none}
    .bar{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);pointer-events:auto;display:flex;gap:6px;align-items:center;padding:8px;
         background:var(--bg);color:var(--tx);border:1px solid var(--ln);border-radius:999px;box-shadow:0 8px 30px #0005}
    .b{border:0;background:none;color:var(--tx);border-radius:999px;padding:6px 12px;font:700 12px ui-monospace,monospace;cursor:pointer}
    .b:hover{background:var(--sf)}.b.on{background:var(--bl);color:var(--bi)}.b.go{background:var(--bl);color:var(--bi)}
    .sw{width:18px;height:18px;border-radius:50%;border:2px solid var(--bg);outline:1px solid var(--ln);cursor:pointer;padding:0}.sw.on{outline:2px solid var(--tx)}
    .sep{width:1px;height:20px;background:var(--ln)}`, `
    <div class="cv" id="cv"></div>
    <div class="bar" id="bar">
      <button class="b" data-tool="pen">pen</button><button class="b" data-tool="arrow">arrow</button><button class="b" data-tool="box">box</button>
      <span class="sep"></span>${COLORS.map((c) => `<button class="sw" data-color="${c}" style="background:${c}" title="${c}"></button>`).join("")}
      <span class="sep"></span><button class="b" id="undo">undo</button><button class="b" id="cancel">cancel</button><button class="b go" id="done">done</button>
    </div>`);
  const D = (id) => dr.getElementById(id);
  const paintBar = () => {
    dr.querySelectorAll("[data-tool]").forEach((b) => b.classList.toggle("on", b.dataset.tool === tool));
    dr.querySelectorAll("[data-color]").forEach((b) => b.classList.toggle("on", b.dataset.color === color));
  };
  D("bar").addEventListener("click", (e) => {
    const t = e.target; if (t.dataset.tool) tool = t.dataset.tool; if (t.dataset.color) color = t.dataset.color; paintBar();
  });
  D("undo").addEventListener("click", () => { draft.pop(); renderDraft(); });
  D("cancel").addEventListener("click", () => { finish(); setMode(null); });
  D("done").addEventListener("click", () => {
    if (!draft.length) return;
    const br = D("bar").getBoundingClientRect(), n = draft.length;
    const anchor = { type: "draw", strokes: draft.map((s) => ({ tool: s.tool, color: s.color, pts: s.pts })), ...docSize() };
    dh.style.display = "none"; mode = null; syncDock();
    compose({ quote: "", anchor }, { left: br.left, top: br.top, bottom: br.top }, `drawing · ${n} mark${n === 1 ? "" : "s"}`);
  });
  let cur = null;
  const pt = (e) => [Math.round((e.clientX + scrollX) * 10) / 10, Math.round((e.clientY + scrollY) * 10) / 10];
  D("cv").addEventListener("pointerdown", (e) => { D("cv").setPointerCapture(e.pointerId); cur = { tool, color, pts: [pt(e)] }; draft.push(cur); });
  D("cv").addEventListener("pointermove", (e) => {
    if (!cur) return; const p = pt(e), last = cur.pts[cur.pts.length - 1];
    if (cur.tool === "pen") { if (Math.hypot(p[0] - last[0], p[1] - last[1]) >= 2.5) cur.pts.push(p); }
    else cur.pts[1] = p;
    renderDraft();
  });
  const endStroke = () => {
    if (!cur) return;
    const a = cur.pts[0], b = cur.pts[cur.pts.length - 1];
    if (cur.pts.length < 2 || Math.hypot(b[0] - a[0], b[1] - a[1]) < 6) draft.pop();
    cur = null; renderDraft();
  };
  D("cv").addEventListener("pointerup", endStroke); D("cv").addEventListener("pointercancel", endStroke);

  // ── mode switching + shortcuts ──────────────────────────────────────────
  const syncDock = () => { $("dpin").classList.toggle("on", mode === "pin"); $("ddraw").classList.toggle("on", mode === "draw"); document.documentElement.classList.toggle("hona-pin", mode === "pin"); };
  function setMode(m) {
    if (m) { finish(); getSelection().removeAllRanges(); }
    mode = m; dh.style.display = m === "draw" ? "block" : "none"; if (m === "draw") paintBar(); syncDock();
  }
  const toggle = (m) => setMode(mode === m ? null : m);
  $("dpin").addEventListener("click", () => { tools(false); toggle("pin"); }); $("ddraw").addEventListener("click", () => { tools(false); toggle("draw"); });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (mode || composing()) { finish(); setMode(null); tools(false); return; }
      if (tEl.classList.contains("tools")) { tools(false); return; }
      if ($("p").classList.contains("open")) { open(false); return; }
    }
    if (!e.altKey || e.ctrlKey || e.metaKey || (RO && e.code !== "KeyC")) return;
    if (e.code === "KeyP") { e.preventDefault(); toggle("pin"); }
    else if (e.code === "KeyM") { e.preventDefault(); toggle("draw"); }
    else if (e.code === "KeyC") {  // selection → popover at it; otherwise toggle the panel
      e.preventDefault(); const f = fromSelection();
      if (f && !RO) compose(f.p, f.rect, "“" + f.p.quote.slice(0, 80) + "”"); else if ($("p").classList.contains("open")) open(false); else show("comments");
    }
  });

  // ── option blocks: any element with data-hona-choice="group" data-value="A" becomes pickable ──
  const cs = document.createElement("style");
  cs.textContent = "[data-hona-choice]{cursor:pointer}[data-hona-choice][data-hona-selected]{outline:3px solid #2f6fed;outline-offset:4px}[data-hona-choice]:focus-visible{outline:2px dashed #2f6fed;outline-offset:4px}";
  document.documentElement.appendChild(cs);
  function applyChoices() {
    document.querySelectorAll("[data-hona-choice]").forEach((el) => {
      const on = !!(choices[el.dataset.honaChoice] && choices[el.dataset.honaChoice].value === el.dataset.value);
      el.toggleAttribute("data-hona-selected", on); el.setAttribute("role", "radio"); el.setAttribute("aria-checked", String(on));
      if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
    });
  }
  function loadChoices() { return api(`choices/${slug}`).then((m) => { choices = m; applyChoices(); render(); }).catch(() => {}); }
  function pick(el) {
    if (RO) return;
    const g = el.dataset.honaChoice, v = el.dataset.value, same = !!(choices[g] && choices[g].value === v);
    api(`choices/${slug}`, { method: "POST", body: JSON.stringify({ group: g, value: same ? "" : v }) }).then(() => { loadChoices(); toast(same ? "cleared" : "picked " + v); });
  }
  document.addEventListener("click", (e) => { const el = e.target.closest && e.target.closest("[data-hona-choice]"); if (!el || mode) return; e.preventDefault(); pick(el); });
  document.addEventListener("keydown", (e) => { if ((e.key === "Enter" || e.key === " ") && e.target.matches && e.target.matches("[data-hona-choice]")) { e.preventDefault(); pick(e.target); } });

  // ── live: reload on republish, refresh comments on change ───────────────
  let v = null, c = null, dv = null, hv = null;
  const tick = async () => {
    try {
      const j = await api(`poll/${slug}`);
      if (v && j.v !== v) return location.reload();
      if (c !== null && j.c !== c) load();
      if (dv !== null && j.d !== dv) loadDecision();
      if (hv !== null && j.h !== hv) loadChoices();
      v = j.v; c = j.c; dv = j.d; hv = j.h;
    } catch (e) {}
  };
  load(); loadDecision(); loadChoices();
  if (!RO) { tick(); setInterval(tick, 1500); }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
