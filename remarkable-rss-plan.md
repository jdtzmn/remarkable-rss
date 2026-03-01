# `remarkable-rss` — Project Plan

A TypeScript/Node.js CLI that fetches RSS feeds, renders richly-formatted multi-page PDFs, and pushes them to the reMarkable cloud on a configurable schedule.

---

## Goals

- Run via system cron at configurable times (e.g. 7am daily)
- Fetch articles from multiple RSS feeds
- Extract full article content via Mozilla Readability
- Render a single multi-page PDF per run: cover → table of contents → articles grouped by feed
- Each feed can have its own visual theme and settings
- Upload the PDF directly to reMarkable cloud via HTTP API
- Zero external binary dependencies (no rmapi, no headless Go tools)

---

## Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| Language | TypeScript (Node.js) | Strong ecosystem, async-first |
| RSS parsing | `rss-parser` | Lightweight, well-maintained |
| Full content extraction | `@mozilla/readability` + `jsdom` | Local, no API keys, MIT licensed |
| PDF rendering | `puppeteer` | HTML/CSS → PDF; theme flexibility |
| Config | `js-yaml` | Human-friendly, widely used |
| CLI | `commander` | Lightweight, ergonomic |
| reMarkable upload | Direct HTTP (fetch) | No binary deps, self-contained |
| Deduplication | `better-sqlite3` | Fast, local, zero-config |

---

## Project Structure

```
remarkable-rss/
├── src/
│   ├── cli.ts                  # Entry point, command definitions
│   ├── config.ts               # Load & validate feeds.yaml
│   ├── fetcher.ts              # RSS fetch + Readability extraction
│   ├── renderer/
│   │   ├── index.ts            # Orchestrate full PDF HTML build
│   │   ├── cover.ts            # Cover page template
│   │   ├── toc.ts              # Table of contents template
│   │   ├── section.ts          # Feed section divider template
│   │   ├── article.ts          # Per-article page template
│   │   └── themes/
│   │       ├── default.css
│   │       ├── minimal.css
│   │       ├── magazine.css
│   │       ├── newspaper.css
│   │       └── academic.css
│   ├── pdf.ts                  # Puppeteer: HTML string → PDF buffer
│   ├── remarkable.ts           # reMarkable cloud auth + upload
│   ├── dedup.ts                # SQLite article GUID cache
│   └── utils.ts                # Date formatting, logging, helpers
├── feeds.yaml                  # User config (gitignored for personal use)
├── feeds.example.yaml          # Committed example config
├── .remarkable-token           # Stored auth token (gitignored)
├── package.json
└── tsconfig.json
```

---

## Configuration: `feeds.yaml`

```yaml
# Cron schedules — multiple named schedules supported
schedules:
  morning:
    cron: "0 7 * * *"
    title: "Morning Digest"
    feeds: [Hacker News, The Verge, arXiv CS.AI]

  evening:
    cron: "0 18 * * *"
    title: "Evening Reads"
    feeds: [Longreads, Stratechery]

# reMarkable destination
output:
  folder: "/RSS Digests"
  filename_pattern: "{schedule_title} – {date}"   # e.g. "Morning Digest – Feb 28 2026"

# Feed definitions
feeds:
  - name: Hacker News
    url: https://news.ycombinator.com/rss
    max_articles: 10
    theme: minimal
    fetch_full_content: true
    include_images: false

  - name: The Verge
    url: https://www.theverge.com/rss/index.xml
    max_articles: 5
    theme: magazine
    fetch_full_content: true
    include_images: true
    accent_color: "#E5121A"

  - name: arXiv CS.AI
    url: https://arxiv.org/rss/cs.AI
    max_articles: 8
    theme: academic
    fetch_full_content: false    # Use RSS summary/abstract only
    include_images: false

  - name: Longreads
    url: https://longreads.com/feed/
    max_articles: 3
    theme: newspaper
    fetch_full_content: true
    include_images: true

  - name: Stratechery
    url: https://stratechery.com/feed/
    max_articles: 5
    theme: default
    fetch_full_content: false    # Paywalled; use excerpt
    include_images: false
```

---

## PDF Structure

Each run produces one PDF uploaded to reMarkable:

```
┌──────────────────────────┐
│  COVER                   │  Digest title, date, list of sources, article count
├──────────────────────────┤
│  TABLE OF CONTENTS       │  Article title | Source | Page #
│                          │  Grouped by feed, with feed headers
├──────────────────────────┤
│  ── Hacker News ──       │  Section divider (feed name, article count)
│  [Article]               │
│  [Article]               │
│  ...                     │
├──────────────────────────┤
│  ── The Verge ──         │
│  [Article]               │
│  ...                     │
└──────────────────────────┘
```

Each article page includes: headline, source + date, estimated read time, full body text, and optionally a hero image. Layout is controlled by the feed's assigned theme.

---

## Theme System

Themes are CSS files loaded alongside a shared HTML article template. The article template renders the same semantic HTML; the theme controls typography, spacing, columns, image handling, and decorative elements.

Since the reMarkable Paper Pro supports full color, themes can use color freely — colored section headers, feed accent colors, pull quote highlights, hero image tints, etc.

| Theme | Character | Best for |
|---|---|---|
| `default` | Single column, comfortable serif, generous margins | General reading |
| `minimal` | Clean, low-distraction, no images, tight spacing | HN / text-heavy feeds |
| `magazine` | Hero image, drop cap, two-column body, bold accent color | The Verge, editorial |
| `newspaper` | Multi-column, bold headline, colored ruled dividers | News feeds |
| `academic` | Monospace abstract block, citation-style metadata | arXiv, research |

Per-feed config can additionally override `accent_color` and `font_size` within a theme. Images are embedded in full color with no greyscale conversion.

---

## PDF Rendering Pipeline

```
feeds.yaml
    ↓
[config.ts]       Validate schema, resolve schedule → feed list
    ↓
[fetcher.ts]      Parallel fetch RSS (rss-parser) → filter seen GUIDs (dedup.ts)
                  → fetch full content per article (Readability + jsdom)
    ↓
[renderer/]       Build one large HTML string:
                    cover.ts     → cover page HTML
                    toc.ts       → ToC HTML (page numbers estimated pre-render)
                    section.ts   → section divider per feed
                    article.ts   → article HTML using feed's theme CSS
    ↓
[pdf.ts]          Launch Puppeteer → load HTML → print to PDF
                  Page size: 1404×1872px (reMarkable native resolution)
                  Margins: ~60px (leaves room for reMarkable UI chrome)
                  Inject page numbers via CSS @page / Puppeteer headerTemplate
    ↓
[dedup.ts]        Mark rendered article GUIDs as seen in SQLite
    ↓
[remarkable.ts]   Upload PDF buffer to reMarkable cloud
```

### Page Number Strategy

Puppeteer's `headerTemplate`/`footerTemplate` injects accurate page numbers at render time. The ToC is built with placeholder page numbers first, then a second lightweight pass updates them after Puppeteer reports the final page layout — or alternatively, the ToC links to named anchors and reMarkable's PDF viewer handles navigation.

---

## reMarkable Cloud Integration

### Auth Flow (`remarkable-rss auth`)

1. Open `https://my.remarkable.com/device/desktop/connect` in browser (print URL to terminal)
2. User enters one-time code
3. Exchange code for a device token via reMarkable's auth API
4. Store token in `.remarkable-token` (gitignored)

### Upload Flow

reMarkable's cloud API accepts PDF uploads as a ZIP archive (`.rmn` format):

1. Generate a UUID for the document
2. Create the metadata JSON + content JSON
3. Zip them together with the PDF
4. `PUT` to `https://document-storage-production-dot-remarkable-production.appspot.com/document-storage/json/2/upload/request`
5. Follow with the blob upload to the returned URL

All done with native `fetch` — no external tools.

---

## CLI Interface

```bash
# First-time setup
remarkable-rss auth

# Run a named schedule (what cron calls)
remarkable-rss run --schedule morning
remarkable-rss run --schedule evening

# Run all schedules immediately
remarkable-rss run --all

# Dry run: generate PDF locally, skip upload
remarkable-rss run --schedule morning --dry-run --output ./preview.pdf

# Force re-fetch articles already seen (ignore dedup cache)
remarkable-rss run --schedule morning --no-dedup

# List configured feeds and schedules
remarkable-rss list

# Test a single feed (fetch + render, no upload)
remarkable-rss test "Hacker News" --output ./test.pdf

# Clear dedup cache (re-send all articles next run)
remarkable-rss cache clear
```

---

## Deduplication

A local SQLite database (`~/.remarkable-rss/seen.db`) stores article GUIDs/URLs with timestamps. On each run, already-seen articles are skipped. Cache entries expire after a configurable number of days (default: 30) so articles can resurface if re-published or if cache is cleared.

---

## System Cron Setup

```cron
# Morning digest
0 7 * * * /usr/local/bin/remarkable-rss run --schedule morning >> ~/.remarkable-rss/logs/morning.log 2>&1

# Evening digest
0 18 * * * /usr/local/bin/remarkable-rss run --schedule evening >> ~/.remarkable-rss/logs/evening.log 2>&1
```

The schedule names (`morning`, `evening`) map to named entries in `feeds.yaml`, controlling which feeds run, how many articles, and what the PDF is titled.

---

## Data Flow Summary

```
feeds.yaml
    ↓ config.ts
RSS URLs → rss-parser → raw items
    ↓ dedup.ts (filter seen)
article URLs → jsdom + Readability → clean content
    ↓ renderer/
HTML string (cover + ToC + articles with theme CSS)
    ↓ pdf.ts (Puppeteer)
PDF buffer (1404×1872px, page-numbered)
    ↓ dedup.ts (mark seen)
    ↓ remarkable.ts
reMarkable cloud → appears in Library
```

---

## Key Dependencies

```json
{
  "dependencies": {
    "@mozilla/readability": "^0.5.0",
    "better-sqlite3": "^9.0.0",
    "commander": "^12.0.0",
    "js-yaml": "^4.1.0",
    "jsdom": "^24.0.0",
    "puppeteer": "^22.0.0",
    "rss-parser": "^3.13.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.0",
    "@types/js-yaml": "^4.0.0",
    "@types/jsdom": "^21.0.0",
    "@types/node": "^20.0.0",
    "typescript": "^5.4.0"
  }
}
```

---

## Stretch Goals

- **Read-later queue**: `remarkable-rss add <url>` appends a one-off article to the next digest
- **Article scoring**: For feeds like HN, filter by minimum score before including
- **Image optimization**: Downscale images to reMarkable Paper Pro resolution pre-PDF for smaller file sizes (color is supported — no greyscale conversion needed)
- **Multiple output formats**: Option to also save PDF locally or to a Dropbox/iCloud folder
- **Web UI**: Simple localhost dashboard to preview the next digest before it runs
- **Notifications**: Post a summary to Slack/Discord after each successful upload
