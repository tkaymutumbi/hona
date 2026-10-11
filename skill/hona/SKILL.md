---
name: hona
description: >
  Show the user a plan, design, mockup, report, diagram or any visual deliverable in their browser with the local
  `hona` tool, then collect their feedback (comments, pins, drawings) and act on it. Use whenever you produce
  something the user should look at or react to rather than just read in the terminal: a design proposal, an
  architecture diagram, a plan to approve, a prototype, a report, options to pick from. Also use when the user says
  "read comments", "check feedback", "what did I comment", or mentions hona.
---

# hona: show work in the browser, hear back

`hona` publishes a self-contained page to `http://localhost:4747/a/<slug>`, opens it in the user's browser, and
lets them comment on it. Comments, pins and drawings reach you through the CLI. Check it is installed with
`command -v hona`; if it is missing, tell the user (install: https://github.com/tkaymutumbi/hona) and fall back to
describing the result in the terminal.

## The loop

1. **Write** the deliverable as one self-contained `.html` (inline CSS and JS, no build step) or a `.md` file, in a
   scratch location (not the project tree unless asked).
2. **Publish:** `hona publish <file> --title "<short name>"`. The page opens in the browser. Give the user the printed
   link in your reply. Publishing again with the same title updates the open tab in place and keeps its comments.
   Use `--no-open` for minor revisions so you do not steal focus again.
3. **Listen:** `hona comments <slug> --wait` blocks until the user writes something (up to 10 minutes; exit code 2 on
   timeout). Run it when you are waiting on their feedback, or `hona comments <slug>` for anything new right now.
4. **Act:** change the page, publish again, then answer: `hona reply <slug> <comment-id> "<what you did>"`.
   Reply in the thread, do not just silently change things. Resolve with `hona resolve <slug> <id>` only when the
   user's request is clearly done; otherwise leave that to them.

Other commands: `hona list` (everything, with open-comment counts), `hona open [slug]`, `hona rm <slug>`.

## Reading feedback correctly

`hona comments` prints each comment with where it points:

- `re: "quoted text"`: the user selected that text. Change that text or the thing it describes.
- `pin on <element> [selector] at (x,y)`: they clicked a spot. Treat the element as the subject.
- `drawing: N mark(s) (box, arrow…) within x…, y…`: they marked up the page.
- `screenshot: <path>`: a render of the page with their marks drawn on it. **Open that image** (view/read the file)
  for every pin or drawing comment. The marks are the instruction ("make this wider" next to a box means that box).
- `(unpinned by the user…)`: they hid the marks; the comment still stands.

A comment with no quote or mark is general feedback about the whole page, so do not guess which part. If a request
is ambiguous, say what you assumed in your reply, or ask. `--json` gives the same data for scripting, including the
anchor and screenshot path; `hona snap <slug> [id]` renders a screenshot on demand.

## Writing good pages

- One page, one purpose; lead with the decision or the result.
- Link the design system for a consistent look: `<link rel="stylesheet" href="/_/hona.css">` and
  `<body class="h-page"><main class="h-stack">…</main></body>`. Components: `.h-card`, `.h-badge` (`ok warn err`),
  `.h-btn`, `.h-eyebrow`. Light and dark themes are automatic. Do not hard-code colours that fight dark mode.
- Every page gets the hona favicon and the comment tools automatically; do not add your own comment UI.
- Make it work at phone width, and never rely on colour alone to carry meaning.
- Keep a stable `<title>`: it becomes the slug, so a new title creates a new page instead of updating.
- Pages can keep small shared state with `window.hona.db` (`list/get/set/del`, same data as `hona data <slug> <coll>`).

## Rules

- Publish only what the user should see; pages are served on localhost (and the LAN only if `hona lan on` was run).
  Never put secrets, tokens or private keys in a page.
- Do not delete pages or resolve threads you did not create or finish.
- Do not run `hona lan on` unless the user asks.
