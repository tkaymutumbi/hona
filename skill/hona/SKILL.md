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
  `hona_versions`, `hona_choices`, `hona_answer`, `hona_check`, `hona_snapshot`.
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

When you want the user to pick between options (logos, layouts, plans), make each option an element of your own design with
`data-hona-choice="<group>" data-value="<A>"` (hona adds the selected state). They click one; the pick arrives as
`choice: <group> = <value>` through `hona_wait_for_feedback` / `hona comments --wait`, or any time via `hona_choices` /
`hona choices <slug>`. One group per question; use clear short values. Prefer this to asking them to type a letter.

## Pages that ask you questions

A page can call `await hona.ask("...")` (or `hona.ask(prompt, {json: true})`) to put a question to you from its own UI,
for example "suggest names", "summarize this selection", "explain this error". It arrives through
`hona_wait_for_feedback` / `hona comments --wait` as `ask #N (from the page): ...`. Answer with `hona_answer` /
`hona answer <slug> <id> "<text>"`, in exactly the format the prompt asked for (plain text, or bare JSON if it said
JSON). The page is showing a spinner until you do, so answer promptly and do not drop it.

If you publish a page that uses `hona.ask`, you must stay in `hona_wait_for_feedback` while the user explores it, and tell
them so ("buttons marked 'ask' need me listening; I'm waiting now"). Design such a page to degrade: show a waiting state,
handle the `timeout` rejection with a plain message, and make every other part of the page work without the agent.
Write prompts that carry everything needed (the selected text, the options) because you answer from what the prompt says.

## Writing good pages

Start from `hona template > page.html`: a blank canvas with only the theme plumbing, no components. Treat the page like
a small product, not a text dump.

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
- **No emojis**, anywhere: not in the page, the title, the description, or your replies on the thread. Use words and plain
  symbols.
- Write plainly for the reader, in active voice, naming things the way they would. Prefer specific to clever. Avoid
  mannered devices: asides set off by dashes, "not X but Y" framing, colon-then-reveal sentences, scare quotes around
  invented labels, stock phrases.

**Name it like a product**
- `<title>` is the page's name: a short noun phrase, two to four words, specific enough to pick this page out of a list
  ("Checkout Rollout Plan", not "Plan" or "Plan: how we will roll out checkout"). Use the user's own name for the thing
  if they have one. Keep it stable: a new title makes a new page, the same title makes a new version.
- Put the explanation in `description` (`--description`, or `<meta name="description">`): one sentence, shown under
  the name on the index.

**Design: hona gives you a blank canvas**
- Hona has no design system for published pages and no built-in components. Do not link `/_/hona.css` and do not use
  `h-*` classes. Every page is designed from scratch for its subject: its own palette, type, layout and components.
  Hona only adds the review tools on top (comments, pins, drawing, approve, theme switch).
- Order of precedence: the user's words, then the project's own design system (tokens, CSS, CLAUDE.md), then your
  own choices. Never impose hona's look on someone's project.
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
- Fonts: Google Fonts may be linked if the page degrades to a real fallback stack offline; everything else is inline.
- Avoid the stock AI look unless the user asks for it: warm cream with a serif and terracotta accent, near-black with
  one acid accent, purple-to-blue gradient heroes, Inter as the "safe" face, centred everything, rounded cards with
  an accent rail. When the user specifies a direction, follow it exactly; their words win.
- Self-contained: inline CSS and JS, data URIs for images. External hosts fail offline and in exports. Avoid
  `alert`, `confirm` and `prompt`; build confirmations into the page.
- The page is yours to design, like an Artifact: a plan can be plain, a design review should be a full designed piece.
  When the deliverable is a design, make the page itself rich and live (see the next section) and let the subject set
  the look. Ordinary boxes, cards and pills are a choice, not a default; do not reach for them out of habit.

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

## Design work and redesigns: use the canvas

When asked to design or redesign something (an app, a screen, a flow, a brand), the page is the canvas and the design
is the deliverable. Build the actual design, not a description of it:
- Make the frames live, not screenshots: phones and windows the user can tap, scroll, filter and switch tabs in, built
  with real HTML and a little script. Add your own Auto / Light / Dark switch when the design has both themes, and
  show a "Picked: X" readout when a choice is made.
- Render each screen or variant at its real size as its own frame (a phone frame at 390px, a desktop frame at 1280px),
  laid out on the page side by side or in a grid so they can be compared and pinned. Use the project's real content,
  names and data.
- Use the product's own tokens and components when redesigning an existing app (read its CSS first). When there is no
  system yet, define one inside the page and show it once (colours, type, spacing).
- Put variants behind `data-hona-choice` so the user can pick, and ask for approval on the one to build.
- Label each frame with a plain name ("Checkout, empty cart") so comments can point at it.
- Write the same code the app would use where possible, so an approved frame can be lifted straight into the project.

## Rules

- Publish only what the user should see; pages are served on localhost (and the LAN only if `hona lan on` was run).
  Never put secrets, tokens or private keys in a page.
- Do not delete pages or resolve threads you did not create or finish.
- Do not run `hona lan on` unless the user asks.
- Focus: a newly opened page is brought to the front. If the user is clearly mid-task elsewhere, publish with
  `open: false` / `--no-open` and just give the link.
