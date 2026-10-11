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
  `hona_versions`, `hona_choices`, `hona_check`, `hona_snapshot`.
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
`hona restore <slug> <n>`, `hona template`.

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

Start from `hona template > page.html`: it already follows everything below. Treat the page like a small product,
not a text dump.

**Before you publish**
- `hona_publish` / `hona publish` renders the page at desktop and phone width in light and dark and reports sideways
  scroll, console errors, failed loads, unreadable colours, tiny text and missing basics. Fix what it lists and
  republish before telling the user. `hona check <slug>` / `hona_check` re-runs it. Do not skip it with `--no-check`
  except for throwaway revisions.

**Content and structure**
- One page, one job. Lead with the decision you need or the result; put the evidence below it.
- Ground it in the subject: real names, numbers, units, file paths and terms from the actual work. Never lorem ipsum,
  never invented figures presented as real.
- Complete at rest: everything meant to be read is visible on load, with no scroll-triggered reveal and no empty shell.
- Structure encodes meaning: number steps only when the order matters; use eyebrows, dividers and badges only when they
  carry information. Do not number or decorate for rhythm.
- **No emojis**, anywhere: not in the page, the title, the description, or your replies on the thread. Use words, plain
  symbols and the design system's badges.
- Write plainly for the reader, in active voice, naming things the way they would. Prefer specific to clever. Avoid
  mannered devices: asides set off by dashes, "not X but Y" framing, colon-then-reveal sentences, scare quotes around
  invented labels, stock phrases.

**Name it like a product**
- `<title>` is the page's name: a short noun phrase, two to four words, specific enough to pick this page out of a list
  ("Checkout Rollout Plan", not "Plan" or "Plan: how we will roll out checkout"). Use the user's own name for the thing
  if they have one. Keep it stable: a new title makes a new page, the same title makes a new version.
- Put the explanation in `description` (`--description`, or `<meta name="description">`): one sentence, shown under
  the name on the index.

**Design**
- Link the design system: `<link rel="stylesheet" href="/_/hona.css">`, `<body class="h-page">`. Components: `.h-card`,
  `.h-badge` (`ok warn err`), `.h-btn`, `.h-eyebrow`, `.h-option`, `.h-stack`. It carries light, dark and system themes.
- Colours are tokens, defined once on `:root` (light), redefined under
  `@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {...} }` and `:root[data-theme="dark"] {...}`
  with `color-scheme: dark`. The body gets an explicit background from a token. No literal colour that reads in only one
  theme. The viewer can switch theme from the hona button, so both must work; give the dark theme its own care instead of
  inverting.
- Responsive: usable at 400px wide with no sideways page scroll. Side padding of at least 16px, flex and grid rows that
  wrap, `min-width: 0` on children that hold text, and `overflow-x: auto` on a wrapper around any wide table, code block
  or diagram.
- Pair type deliberately and keep running text near 65 characters wide. Use `text-wrap: balance` on headings, a type
  scale, and `font-variant-numeric: tabular-nums` where digits line up. Keep keyboard focus visible and respect
  `prefers-reduced-motion`.
- Repeated elements share edges, baselines and padding. Use cards sparingly: border, fill, radius and shadow mark an
  element as a separate object, so apply them by role, not to every block.
- Avoid the stock AI look unless the user asks for it: warm cream with a serif and terracotta accent, near-black with
  one acid accent, purple-to-blue gradient heroes, Inter as the "safe" face, centred everything, rounded cards with
  an accent rail. When the user specifies a direction, follow it exactly; their words win.
- Self-contained: inline CSS and JS, data URIs for images. External hosts fail offline and in exports. Avoid
  `alert`, `confirm` and `prompt`; build confirmations into the page.
- Plan, memo and report pages get a restrained treatment (clear hierarchy, considered spacing); landing pages, games
  and tools get a stronger point of view. When unsure, a well-composed plain page beats an over-designed one.

**Diagrams** (inline `<svg>`, no libraries)
- Draw a mechanism, not a labelled box: the path a request takes, the boundary being crossed, what one option adds or
  removes. If a sentence says it faster, write the sentence.
- Comparing options: draw the difference side by side, not a separate box per option.
- Label every arrow (`writes`, `polls every 30s`). Use `viewBox` and `max-width: 100%`, `currentColor` for strokes and
  text so both themes work, `<marker>` arrowheads, 11 to 13px labels, a shared grid. One figure makes one claim:
  wrap it in `<figure>` with a `<figcaption>`, and give the svg `role="img"` and an `aria-label`.

**Behaviour**
- Pages can keep small shared state with `window.hona.db` (`list/get/set/del`; same data as `hona data <slug> <coll>`).
- Republishing keeps the viewer's scroll position and form values, so you can iterate while they read.
- Every page gets the hona favicon and the comment, pin, draw, review and theme tools automatically; do not add your own.

## Rules

- Publish only what the user should see; pages are served on localhost (and the LAN only if `hona lan on` was run).
  Never put secrets, tokens or private keys in a page.
- Do not delete pages or resolve threads you did not create or finish.
- Do not run `hona lan on` unless the user asks.
- Focus: a newly opened page is brought to the front. If the user is clearly mid-task elsewhere, publish with
  `open: false` / `--no-open` and just give the link.
