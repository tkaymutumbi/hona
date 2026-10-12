# hona design system

**Scope: this system styles hona's own screens only (the index, markdown pages, exports). Pages that agents publish do not use
it; they are designed from scratch for their subject, and hona only adds its review tools on top.**

Calm, warm ink, one ember accent, monospace chrome, readable prose. Source of truth: [`assets/hona.css`](assets/hona.css),
served at `/_/hona.css`.

```html
<link rel="stylesheet" href="/_/hona.css">
<body class="h-page"><main class="h-stack"> … </main></body>
```

## Mark

`assets/favicon.svg` — a ring and a dot in an ember circle: the "o" of hona as an eye (hona = "see"). Served at `/_/favicon.svg` and injected into
every artifact that has no icon of its own.

## Tokens

| token | light | dark | use |
| --- | --- | --- | --- |
| `--h-bg` | `#faf7f2` | `#141110` | page |
| `--h-surface` | `#ffffff` | `#1c1816` | cards |
| `--h-sunken` | `#f1ece4` | `#0f0d0c` | code, badges |
| `--h-text` / `--h-muted` | `#1a1512` / `#6f655b` | `#f3ece3` / `#a1968a` | text |
| `--h-line` | `#e4ddd2` | `#2e2823` | borders |
| `--h-accent` | `#e8590c` | `#ff7a3d` | the one accent |
| `--h-ok` `--h-warn` `--h-err` | deep green / amber / red (4.5:1 on the sunken tint) | lighter variants | status — always pair with a word or symbol |

Dark mode follows `prefers-color-scheme`; force with `data-theme="light|dark"` on `<html>`.

Type: system sans for prose, monospace (`--h-mono`) for chrome — eyebrows, table heads, buttons, badges, lowercase.
Scale: 13 / 16 / 20 / 28 / 40 px. Space: 4px base (`--h-1` … `--h-12`). Radius: 10px (cards), 6px (controls).

## Components

`.h-page` · `.h-wrap` · `.h-stack` · `.h-card` (`a.h-card` is a link card) · `.h-badge` (`.ok .warn .err`) ·
`.h-btn` (`.ghost`) · `.h-option` (pair with `data-hona-choice`) · `.h-eyebrow` · `.h-brand`

## Rules

- One accent, used for links, focus and the primary action only.
- Never rely on colour alone for status.
- Prose measure stays at 46rem.
