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
| `hona list` | show everything published |
| `hona open [slug]` | open one (default: latest) |
| `hona rm <slug>` | delete one |
| `hona serve` | run the server in the foreground (it auto-starts otherwise) |

- Pages live in `~/.local/share/hona/artifacts/<slug>/` (override with `HONA_HOME`).
- Server listens on `127.0.0.1:4747` (override with `HONA_PORT`). `http://localhost:4747` is the index.
- If the page is already open in a tab, publishing reloads it instead of opening another.
- Colour only on a terminal; `NO_COLOR` is honoured; piped output is just the URL.

## For agents

Tell your agent (e.g. in `AGENTS.md`):

> Write plans, designs and reports as a self-contained HTML (or Markdown) file and run
> `hona publish <file> --title "<name>"`. Give the user the printed link.

Pages can opt into the [design system](DESIGN.md) with `<link rel="stylesheet" href="/_/hona.css">`
and `<body class="h-page">`. Every page automatically gets the hona favicon unless it sets its own.

## License

MIT
