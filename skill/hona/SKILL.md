---
name: hona
description: >
  Show the user a plan, design, mockup, report, diagram or any visual deliverable in their browser with the local
  `hona` tool, then collect their feedback (comments, pins, drawings, approve or request changes) and act on it. Use
  whenever you produce something the user should look at or react to rather than just read in the terminal: a design
  proposal, an architecture diagram, a plan to approve, a prototype, a report, options to pick from. Also use when the
  user says "read comments", "check feedback", "what did I comment", "did I approve", or mentions hona.
---

# hona: show work in the browser, hear back

`hona` publishes a self-contained page to `http://localhost:4747/a/<slug>`, opens it in the user's browser (and brings
it to the front), and lets them comment, pin, draw, and approve or request changes on it. Feedback reaches you through
MCP tools or the CLI; they do the same thing.

## Pick your interface

- **MCP tools, if you have them** (`hona_publish`, `hona_wait_for_feedback`, `hona_reply`, ...): use these. They return
  screenshots as images you can look at directly, and waiting is a single tool call. Tool list: `hona_publish`,
  `hona_wait_for_feedback`, `hona_feedback`, `hona_reply`, `hona_resolve`, `hona_decision`, `hona_list`,
  `hona_versions`, `hona_choices`, `hona_snapshot`.
- **CLI otherwise:** `command -v hona`. If missing, tell the user (install: https://github.com/tkaymutumbi/hona) and
  describe the result in the terminal instead. If the MCP tools are missing but the CLI exists, `hona mcp-install`
  registers them (restart the session to load them).

## The loop

1. **Write** the deliverable as one self-contained `.html` (inline CSS and JS, no build step) or a `.md` file, in a
   scratch location, not the project tree unless asked.
2. **Publish:** `hona_publish` / `hona publish <file> --title "<short name>"`. Give the user the link. Publishing again
   with the same title updates the open tab in place, records a new **version**, and keeps all comments. Use `open:
   false` / `--no-open` for minor revisions so you do not pull focus again.
3. **Listen:** `hona_wait_for_feedback` / `hona comments <slug> --wait` blocks until the user comments or decides (CLI:
   up to 10 minutes, exit code 2 on timeout; MCP: returns "no feedback yet" after the timeout, so call it again).
   Use the non-blocking `hona_feedback` / `hona comments <slug>` for anything new right now.
4. **Act:** change the page, publish again, then answer in the thread: `hona_reply` / `hona reply <slug> <id> "<what
   you did>"`. Do not change things silently. Resolve with `hona_resolve` only when the request is clearly done;
   otherwise leave resolving to the user.

Other commands: `hona export <slug>` (one standalone file with the comments baked in, for sharing), `hona list`, `hona open [slug]`, `hona rm <slug>`, `hona versions <slug>`, `hona diff <slug> [a] [b]`,
`hona restore <slug> <n>`.

## Reading feedback correctly

Each comment says where it points:

- `re: "quoted text"`: the user selected that text. Change that text or the thing it describes.
- `pin on <element> [selector] at (x,y)`: they clicked a spot. Treat the element as the subject.
- `drawing: N mark(s) (box, arrow...) within x..., y...`: they marked up the page.
- `screenshot: <path>` (CLI) or an attached image (MCP): the page with their marks drawn on it. **Look at it** for every
  pin or drawing comment. The marks are the instruction ("make this wider" beside a box means that box).
- `(unpinned by the user...)`: they hid the marks; the comment still stands.
- A comment with no quote or mark is general feedback about the whole page. Do not guess which part: state what you
  assumed in your reply, or ask.

## Decisions: approve and request changes

The user can press **approve** or **request changes** (with a note) on a page. The decision is tied to a version.

- `decision: APPROVED on v2`: the version they approved is final. Proceed with the work the page was asking permission
  for. Do not keep iterating on an approved page.
- `decision: CHANGES REQUESTED on v2` plus a note: address the note and any open comments, publish a new version, then
  wait again. A new version is not approved until the user decides again; `hona_decision` / `hona decision <slug>`
  shows whether the latest decision is out of date.
- When you publish something that needs a go/no-go (a plan, a migration, an approach), say so and wait for a
  decision before acting on it. Comments alone are not approval.

## Letting the user choose

When you want the user to pick between options (logos, layouts, plans), make each option a card with
`data-hona-choice="<group>" data-value="<A>"` (and the `h-option` class). They click one; the pick arrives as
`choice: <group> = <value>` through `hona_wait_for_feedback` / `hona comments --wait`, or any time via `hona_choices` /
`hona choices <slug>`. One group per question; use clear short values. Prefer this to asking them to type a letter.

## Writing good pages

- One page, one purpose; lead with the decision you need or the result.
- **No emojis**, anywhere in the page, the title, or your replies on the thread. Use words, plain symbols, and the
  design system's badges instead.
- Link the design system for a consistent look: `<link rel="stylesheet" href="/_/hona.css">` and
  `<body class="h-page"><main class="h-stack">...</main></body>`. Components: `.h-card`, `.h-badge` (`ok warn err`),
  `.h-btn`, `.h-eyebrow`. Light and dark themes are automatic; do not hard-code colours that fight dark mode.
- Every page gets the hona favicon and the comment, pin, draw and review tools automatically; do not add your own.
- Make it work at phone width, and never rely on colour alone to carry meaning.
- Keep a stable `<title>`: it becomes the slug, so a new title creates a new page instead of a new version.
- Pages can keep small shared state with `window.hona.db` (`list/get/set/del`; same data as `hona data <slug> <coll>`).

## Rules

- Publish only what the user should see; pages are served on localhost (and the LAN only if `hona lan on` was run).
  Never put secrets, tokens or private keys in a page.
- Do not delete pages or resolve threads you did not create or finish.
- Do not run `hona lan on` unless the user asks.
- Focus: a newly opened page is brought to the front. If the user is clearly mid-task elsewhere, publish with
  `open: false` / `--no-open` and just give the link.
