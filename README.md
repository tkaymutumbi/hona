# hona

> *hona* — Shona for "see".

Local artifacts for agents. When an AI agent produces a plan, design or report, it publishes it
with one command: hona stores the page, serves it on `localhost`, and opens it in your browser so it
gets your attention. Republishing the same page live-reloads the tab you already have open.

```
hona publish plan.html --title "Auth redesign"
```

```
◆ hona · local artifacts · publish
│
├ ✔ (1/3) read page  4,210 bytes
├ ✔ (2/3) stored  new
├ ✔ (3/3) serving  server started
│
│   title    Auth redesign
│   link     http://localhost:4747/a/auth-redesign
│   browser  opened
└ ✔ done · next: hona list
```

## Install

Needs Python 3.9+ (standard library only) and a desktop with `xdg-open`.

```sh
git clone https://github.com/tkaymutumbi/hona ~/hona
ln -s ~/hona/hona ~/.local/bin/hona
```

## Use

| command | what it does |
| --- | --- |
| `hona publish <file\|-> [--title T] [--slug S] [--no-open]` | store, serve and open an `.html` or `.md` page (`-` reads stdin) |
| `hona list` | everything published, with open-comment counts |
| `hona open [slug]` / `hona rm <slug>` | open or delete one |
| `hona comments [slug] [--wait] [--all] [--json]` | read feedback; `--wait` blocks until you write something |
| `hona snap <slug> [id] [--out f.png]` | screenshot of the page with pins and drawings drawn on it |
| `hona reply <slug> <id> <text>` / `hona resolve <slug> <id>` | answer or close a thread (shows live in the page) |
| `hona data <slug> <coll> [get <id>\|set <id> <json>\|del <id>]` | shared data the page can also use |
| `hona lan [on\|off\|status]` | share on your network, protected by a secret token |
| `hona skill [install\|status\|uninstall]` | link the agent skill into Claude Code, OpenCode and Codex |
| `hona decision <slug> [--wait]` | the user's verdict (exit 0 approved, 3 changes requested, 4 none yet) |
| `hona versions <slug>` / `hona diff <slug> [a] [b]` / `hona restore <slug> <n>` | history, text diff, roll back |
| `hona focus [on\|off]` | bring a newly opened page to the front (Hyprland); reloads never steal focus |
| `hona asks <slug>` / `hona answer <slug> <id> <text>` | questions a page asked with `hona.ask`, and your replies |
| `hona choices <slug>` | the user's picks on option blocks |
| `hona delete <slug> <id>` / `hona undelete` | soft-delete a comment thread |
| `hona export <slug>` | one standalone HTML file with comments and marks |
| `hona pin <slug>` / `hona unpin` / `hona trash [restore <name>\|empty]` | favourites on top; manage removed pages |
| `hona check <slug>` | render at desktop and phone, light and dark; list overflow, errors, contrast |
| `hona template` | print a starter page that already follows the design rules |
| `hona mcp-install [status]` | register the MCP tools with Claude Code, OpenCode and Codex |
| `hona mcp` | the MCP server itself (stdio; started by your agent) |
| `hona serve` | run the server in the foreground (it auto-starts otherwise) |

- Pages live in `~/.local/share/hona/artifacts/<slug>/` (override with `HONA_HOME`).
- Server listens on `127.0.0.1:4747` (override with `HONA_PORT`). `http://localhost:4747` is the index.
- If the page is already open in a tab, publishing reloads it instead of opening another. Comments survive republishing.
- Colour only on a terminal; `NO_COLOR` is honoured; piped output is just the URL.

### Comments

Every page gets a ring-and-dot button. Select text and a **comment** pill appears. Comments are quoted, threaded and
resolvable, and you get a desktop notification (`notify-send`). The agent reads them with `hona comments <slug> --wait`,
answers with `hona reply`, and republishes; your tab reloads on its own.

### Annotations

| gesture | what it does |
| --- | --- |
| select text, **Alt+C** (or the blue pill) | comment on text; the text stays highlighted, click it to jump to the thread |
| **Alt+P** (dock: `pin`) | click anywhere (images, mockups, diagrams) to drop a numbered pin |
| **Alt+M** (dock: `draw`) | pen, arrow and box over the page, 3 colours, undo; **done** opens the comment box |
| tools list → **pinned** | every pin, drawing and highlight in one list: **go to** scrolls and flashes it, **unpin** hides its marks (the comment stays), **re-pin** brings them back |
| `Esc` | cancel the current mode or popover |

Click the ring-and-dot button for the tools list (comments, pin, draw); click again, press Esc or click elsewhere to close it. Pins follow the element they were dropped on, text highlights re-find
their quote after the page is republished, and **marks on/off** in the panel header hides everything.

For the agent, `hona comments` prints where a pin or drawing is (element, selector, coordinates) and renders a
screenshot with your marks on it (headless Chromium, saved under `~/.local/share/hona/snaps/`); `--json` includes the
anchor and the screenshot path. `--no-shots` skips rendering.

### Approve, request changes, versions

Every publish with changed content is a new **version** (the last 50 are kept); an identical republish is a no-op.
In the tools list, **approve** or **request changes** (with a note) records a decision on the current version. A newer
version shows the old decision as out of date until you decide again. **history** lists versions with their decisions,
shows a text **diff** against the previous one, opens an old version read-only, and can **restore** it as a new version.
`hona decision <slug> --wait` and the MCP `hona_wait_for_feedback` return as soon as you decide.

### Option blocks

Mark any element as a choice and the user can pick it with a click (or Enter): 

```html
<div class="h-card h-option" data-hona-choice="logo" data-value="A">Option A</div>
<div class="h-card h-option" data-hona-choice="logo" data-value="B">Option B</div>
```

The pick is outlined on the page, shown in the panel, and delivered to the agent (`hona choices <slug>`, `hona comments --wait`,
MCP `hona_wait_for_feedback` / `hona_choices`). Clicking the picked option again clears it.

### Delete, export, index

- **Delete a comment:** `delete` on a thread removes it with an undo bar (`hona delete` / `hona undelete` from the CLI). Deleted threads
  vanish from the page, the pinned list and the agent's feedback.
- **Export:** `hona export <slug> [--out f.html] [--no-comments]` writes one standalone file with the page, its CSS and images inlined, and the
  comments, pins, drawings, picks and decision embedded read-only. It opens in any browser with no hona running.
- **Index:** at `http://localhost:4747`, **pin** keeps a page at the top and **remove** moves it to a trash you can restore from (undo toast,
  `trash` section, `hona trash`). Nothing is deleted for good until you choose **delete forever** or `hona trash empty`.
- **Screenshots follow your theme:** pins and drawings remember whether you were in light or dark mode; `hona snap --theme light|dark` overrides it.

### Ask the agent from a page

A page can put a question to the agent and show the answer, the local equivalent of Claude artifacts' `sample`:

```js
const answer = await hona.ask("Suggest three names for this tool, one per line.");
const data   = await hona.ask('Reply with JSON {"names": [...]}', { json: true });   // parses the reply, fences allowed
```

The question reaches the agent as `ask #N` through `hona comments --wait` or the MCP `hona_wait_for_feedback`; it answers with
`hona answer <slug> <id> "<text>"` or `hona_answer`, and the page's promise resolves. While it waits, the panel shows "Waiting for
the agent". Rejections carry a `code`: `timeout` (default 3 minutes, set `timeoutMs`), `rate_limited` (20 unanswered at once),
`bad_json`, `not_available` (exported copies). The agent has to be listening, so pages that use it should say so and show a waiting state.
`hona asks <slug>` lists questions and answers.

### Quality check

`hona publish` finishes by rendering the page at desktop (1280px) and phone (390px) widths in light and dark, in headless
Chromium, and lists what a reviewer would trip over: sideways scroll (and the widest element), console errors, failed
loads, unreadable colours (WCAG contrast), tiny text, a missing title, viewport meta or page background. Issues are grouped
by where they occur. The agent sees them in the publish result and fixes them before you look. `hona check <slug>` re-runs it;
`--no-check` or `hona` config `check: false` turns it off. `hona template > page.html` gives a starter that passes.

### Republish without losing your place

When the agent republishes a page you have open, it reloads with your scroll position and any form values kept. The tools list
also has a **theme** button (system, light, dark), remembered per browser. Pages can carry a one-line description
(`hona publish --description`, or `<meta name="description">`) that shows under the title on the index.

### MCP

`hona mcp-install` registers a stdio MCP server with Claude Code (user scope), OpenCode (`~/.config/opencode/opencode.json`,
backup kept) and Codex (`~/.codex/config.toml`). The agent then publishes and listens with tool calls, and pin or
drawing screenshots arrive as images it can look at:

`hona_publish` · `hona_wait_for_feedback` · `hona_feedback` · `hona_reply` · `hona_resolve` · `hona_decision` ·
`hona_list` · `hona_versions` · `hona_choices` · `hona_answer` · `hona_check` · `hona_snapshot`

Manual config for any other MCP client: command `python3`, args `["/path/to/hona/hona", "mcp"]`.

### Data

Pages can keep small shared state with `window.hona.db` (`list`, `get`, `set`, `del`), e.g.
`await hona.db.set("todos", "a", {done: true})`. The agent sees the same data with `hona data`.

### LAN

`hona lan on` binds to your network and prints a link with a secret token (`?t=…`), which becomes a cookie. Without the
token everything off this machine gets `401`. Loopback requests are protected against DNS rebinding and cross-site writes.

## For agents

Install the skill once and Claude Code, OpenCode and Codex learn the whole loop (publish, wait for comments, read
pins and screenshots, reply, republish):

```sh
hona skill install     # symlinks skill/hona into ~/.claude/skills, ~/.agents/skills and ~/.codex/skills
hona skill status      # check; `hona skill uninstall` removes the links
```

The skill (which also tells agents to use no emojis in pages) is [`skill/hona/SKILL.md`](skill/hona/SKILL.md), a plain `SKILL.md`, so any agent that reads that format can
use it. Restart the agent session after installing.

Pages can opt into the [design system](DESIGN.md) with `<link rel="stylesheet" href="/_/hona.css">`
and `<body class="h-page">`. Every page automatically gets the hona favicon unless it sets its own.

## License

MIT
