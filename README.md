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
| `hona reply <slug> <id> <text>` / `hona resolve <slug> <id>` | answer or close a thread (shows live in the page) |
| `hona data <slug> <coll> [get <id>\|set <id> <json>\|del <id>]` | shared data the page can also use |
| `hona lan [on\|off\|status]` | share on your network, protected by a secret token |
| `hona serve` | run the server in the foreground (it auto-starts otherwise) |

- Pages live in `~/.local/share/hona/artifacts/<slug>/` (override with `HONA_HOME`).
- Server listens on `127.0.0.1:4747` (override with `HONA_PORT`). `http://localhost:4747` is the index.
- If the page is already open in a tab, publishing reloads it instead of opening another. Comments survive republishing.
- Colour only on a terminal; `NO_COLOR` is honoured; piped output is just the URL.

### Comments

Every page gets a ring-and-dot button. Select text and a **comment** pill appears. Comments are quoted, threaded and
resolvable, and you get a desktop notification (`notify-send`). The agent reads them with `hona comments <slug> --wait`,
answers with `hona reply`, and republishes; your tab reloads on its own.

### Data

Pages can keep small shared state with `window.hona.db` (`list`, `get`, `set`, `del`), e.g.
`await hona.db.set("todos", "a", {done: true})`. The agent sees the same data with `hona data`.

### LAN

`hona lan on` binds to your network and prints a link with a secret token (`?t=…`), which becomes a cookie. Without the
token everything off this machine gets `401`. Loopback requests are protected against DNS rebinding and cross-site writes.

## For agents

Tell your agent (e.g. in `AGENTS.md`):

> Write plans, designs and reports as a self-contained HTML (or Markdown) file and run
> `hona publish <file> --title "<name>"`. Give the user the printed link.

Pages can opt into the [design system](DESIGN.md) with `<link rel="stylesheet" href="/_/hona.css">`
and `<body class="h-page">`. Every page automatically gets the hona favicon unless it sets its own.

## License

MIT
