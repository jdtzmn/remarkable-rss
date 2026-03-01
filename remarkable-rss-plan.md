# `remarkable-rss` — Project Plan

A Next.js web app that fetches RSS feeds, renders richly-formatted digest PDFs with per-feed themes, and pushes them to the reMarkable cloud on a user-configurable cron schedule.

---

## Goals

- Web UI for managing feeds, themes, and sync schedule
- Per-user cron scheduling (configurable via the web app)
- Fetch articles from multiple RSS feeds
- Extract full article content via Mozilla Readability
- Render a single multi-page digest PDF per sync: cover → table of contents → articles grouped by feed
- Each feed can have its own visual theme and settings
- Upload the PDF to reMarkable cloud via `rmapi-js` (v1.5 protocol)
- Run as a Docker Compose stack (Next.js + MongoDB)

---

## Tech Stack

| Concern | Choice | Rationale |
|---|---|---|
| Framework | Next.js 12 (Pages Router) | Existing app, web UI + API routes |
| Language | TypeScript | Strong ecosystem, async-first |
| Database | MongoDB via Mongoose | Existing, stores users/feeds/schedules |
| Auth | JWT + bcrypt | Existing, cookie-based |
| RSS parsing | `rss-parser` | Lightweight, well-maintained |
| Full content extraction | `@mozilla/readability` + `jsdom` | Local, no API keys, MIT licensed |
| PDF rendering | `puppeteer-core` + system Chromium | HTML/CSS → PDF; theme flexibility |
| Scheduling | `node-cron` | In-process, per-user dynamic schedules |
| reMarkable upload | `rmapi-js` | Active, implements v1.5 sync protocol |
| Containerization | Docker Compose | MongoDB + web app with Chromium |

---

## Project Structure

```
remarkable-rss/
├── components/
│   ├── AuthForm.tsx
│   ├── Button.tsx
│   ├── CreateFeedForm.tsx        # Updated: theme dropdown, maxArticles, options
│   ├── FeedList.tsx              # Updated: show theme badge, feed options
│   ├── Layout.tsx
│   ├── RemarkableConnectForm.tsx
│   ├── ScheduleForm.tsx          # New: cron expression + enable/disable
│   └── TextInput.tsx
├── lib/
│   ├── config.ts                 # Env validation (envalid)
│   ├── crypto-shim.ts            # Node.js crypto polyfill for rmapi-js
│   ├── mongoose.ts               # DB connection
│   ├── readability.ts            # New: article extraction via Readability
│   ├── pdf.ts                    # New: Puppeteer HTML → PDF rendering
│   ├── scheduler.ts              # New: node-cron per-user schedule manager
│   └── renderer/
│       ├── index.ts              # Orchestrate full digest HTML build
│       ├── cover.ts              # Cover page template
│       ├── toc.ts                # Table of contents template
│       ├── section.ts            # Feed section divider template
│       ├── article.ts            # Per-article page template
│       └── themes/
│           ├── default.css       # Single column, serif, generous margins
│           ├── minimal.css       # Clean, no images, tight spacing
│           ├── magazine.css      # Drop cap, bold accent color
│           ├── newspaper.css     # Multi-column, bold headline, ruled dividers
│           └── academic.css      # Monospace abstract, citation-style metadata
├── models/
│   ├── feed.ts                   # Updated: theme, maxArticles, fetchFullContent, etc.
│   └── user.ts                   # Updated: cronSchedule, cronEnabled
├── pages/
│   ├── api/
│   │   ├── fetch/index.ts        # Rewritten: digest pipeline
│   │   └── user/
│   │       ├── index.ts
│   │       ├── login/index.ts
│   │       ├── logout/index.ts
│   │       ├── device_token/index.ts
│   │       ├── feed/index.ts     # Updated: accept new feed fields
│   │       ├── feed/[id].ts
│   │       └── schedule/index.ts # New: GET/PUT cron schedule
│   ├── account/index.tsx         # Updated: schedule section
│   └── index.tsx
├── server.ts                     # New: custom server with scheduler init
├── Dockerfile                    # New: node:18-slim + Chromium
├── docker-compose.yml
├── .env                          # MONGO_URL, JWT_SECRET (gitignored)
├── package.json
└── tsconfig.json
```

---

## Data Models

### Feed (embedded subdocument in User)

```ts
{
  url: string;              // RSS feed URL
  title: string;            // Feed display name (auto-detected from RSS)
  lastParsed: Date;         // Last sync timestamp for dedup
  theme: string;            // "default" | "minimal" | "magazine" | "newspaper" | "academic"
  maxArticles: number;      // Max articles per sync (default: 10)
  fetchFullContent: boolean;// Use Readability for full extraction (default: true)
  includeImages: boolean;   // Include inline images in PDF (default: true)
  accentColor: string;      // Optional CSS color override, e.g. "#E5121A"
}
```

### User

```ts
{
  username: string;
  password: string;         // bcrypt hashed
  deviceToken: string;      // reMarkable cloud device token
  feeds: Feed[];            // Embedded subdocuments
  cronSchedule: string;     // Cron expression (default: "0 7 * * *")
  cronEnabled: boolean;     // Whether auto-sync is active (default: false)
}
```

---

## PDF Structure

Each sync produces one digest PDF uploaded to reMarkable:

```
┌──────────────────────────┐
│  COVER                   │  "RSS Digest – Mar 1 2026"
│                          │  List of sources, total article count
├──────────────────────────┤
│  TABLE OF CONTENTS       │  Article title | Source
│                          │  Grouped by feed, with feed headers
├──────────────────────────┤
│  ── Hacker News ──       │  Section divider (feed name, article count)
│  [Article]               │  theme: minimal
│  [Article]               │
│  ...                     │
├──────────────────────────┤
│  ── The Verge ──         │  theme: magazine, accent: #E5121A
│  [Article]               │
│  ...                     │
└──────────────────────────┘
```

Each article includes: headline, source + date, estimated read time, full body text, and inline images (if enabled for that feed). Layout is controlled by the feed's assigned theme.

If no new articles exist across all feeds, no digest is generated.

---

## Theme System

Themes are CSS files scoped by a `.theme-{name}` wrapper class. All theme CSS is concatenated into the digest HTML's `<style>` tag so articles from different feeds can use different themes in the same PDF.

The article template renders the same semantic HTML; the theme controls typography, spacing, columns, image handling, and decorative elements.

Since the reMarkable Paper Pro supports full color, themes use color freely — colored section headers, feed accent colors, pull quote highlights, etc.

| Theme | Character | Best for |
|---|---|---|
| `default` | Single column, comfortable serif, generous margins | General reading |
| `minimal` | Clean, low-distraction, tight spacing | HN / text-heavy feeds |
| `magazine` | Drop cap, bold accent color | The Verge, editorial |
| `newspaper` | Multi-column, bold headline, colored ruled dividers | News feeds |
| `academic` | Monospace abstract block, citation-style metadata | arXiv, research |

Per-feed config can additionally override `accent_color` within a theme. Images from the article content are embedded in full color.

---

## PDF Rendering Pipeline

```
User triggers sync (cron or manual GET /api/fetch)
    ↓
[fetch/index.ts]  For each user with a device token:
    ↓
[rss-parser]      Fetch RSS for each feed → filter by lastParsed date
    ↓
[readability.ts]  For each new article: fetch URL → extract with Readability + jsdom
                  Respects per-feed fetchFullContent and maxArticles settings
    ↓
[renderer/]       Build one HTML string:
                    cover.ts     → cover page (title, date, sources)
                    toc.ts       → table of contents
                    section.ts   → section divider per feed
                    article.ts   → article HTML wrapped in theme class
                    themes/*.css → all theme CSS concatenated
    ↓
[pdf.ts]          Launch Puppeteer (system Chromium) → render HTML → PDF buffer
                  Page size: 1404×1872px (reMarkable native resolution)
                  Margins: 60px
    ↓
[rmapi-js]        Upload digest PDF to reMarkable cloud
                  Folder: "remarkable-rss/{username}"
                  File: "RSS Digest – {date}"
    ↓
[mongoose]        Update lastParsed dates for all feeds
```

---

## Cron Scheduling

### Architecture

- `lib/scheduler.ts` uses `node-cron` to maintain a `Map<userId, ScheduledTask>`
- `server.ts` (custom Next.js server) calls `initScheduler()` on startup
- On init, loads all users with `cronEnabled: true` and schedules their jobs
- Each job triggers the fetch/digest pipeline for that specific user
- `updateSchedule(userId, cron, enabled)` allows dynamic add/remove/update

### API

- `GET /api/user/schedule` — returns `{ cronSchedule, cronEnabled }`
- `PUT /api/user/schedule` — update schedule, syncs in-memory scheduler

### Web UI

- `ScheduleForm` component: cron expression text input + enable/disable toggle
- Displayed on the account page below feed management

---

## reMarkable Cloud Integration

### Auth Flow (via web UI)

1. User visits account page
2. Goes to `https://my.remarkable.com/device/browser/connect` for a one-time code
3. Enters code in the web UI
4. `POST /api/user/device_token` calls `rmapi-js` `register(code)` → stores device token in MongoDB

### Upload Flow (via `rmapi-js`)

1. `await remarkable(deviceToken)` — authenticates with v1.5 protocol
2. `await api.listItems()` — find or create folder structure
3. `await api.putFolder(name, { parent })` — create feed folders
4. `await api.putPdf(name, buffer, { parent })` — upload digest PDF

---

## Docker Setup

### Dockerfile

```dockerfile
FROM node:18-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium fonts-liberation fonts-noto \
    libatk-bridge2.0-0 libdrm2 libgbm1 libnss3 libxss1 \
    && rm -rf /var/lib/apt/lists/*
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
WORKDIR /app
```

### docker-compose.yml

```yaml
services:
  web:
    build: .
    volumes:
      - .:/app
      - node_modules:/app/node_modules
    ports:
      - "3000:3000"
    environment:
      - MONGO_URL=mongodb://mongo:27017/remarkable-rss
    env_file:
      - .env
    command: sh -c "npm install && npx ts-node server.ts"
    depends_on:
      mongo:
        condition: service_healthy

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo-data:/data/db
    healthcheck:
      test: mongosh --eval "db.runCommand('ping').ok" --quiet
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mongo-data:
  node_modules:
```

---

## Implementation Phases

| # | Phase | Description |
|---|---|---|
| 1 | Bug fixes | Fix `NOVE_ENV` → `NODE_ENV` typo |
| 2 | Infrastructure | Dockerfile, docker-compose update, dependency swap |
| 3 | Data model | Feed + User schema changes, feed API update |
| 4 | Content extraction | `lib/readability.ts`, remove cheerio |
| 5 | PDF rendering | `lib/renderer/`, `lib/pdf.ts`, all 5 themes |
| 6 | Fetch rewrite | New digest pipeline in fetch endpoint |
| 7 | Cron scheduling | `lib/scheduler.ts`, custom server, schedule API |
| 8 | Web UI | Schedule form, theme selector in feed form, feed list updates |

---

## Key Dependencies

```json
{
  "dependencies": {
    "@mozilla/readability": "^0.5.0",
    "bcrypt": "^5.0.1",
    "cookie": "^0.4.1",
    "envalid": "^7.2.2",
    "jsonwebtoken": "^8.5.1",
    "jsdom": "^24.0.0",
    "mongoose": "^6.1.5",
    "next": "12.0.7",
    "node-cron": "^3.0.0",
    "puppeteer-core": "^22.0.0",
    "react": "17.0.2",
    "react-dom": "17.0.2",
    "rmapi-js": "^8.1.0",
    "rss-parser": "^3.12.0",
    "yup": "^0.32.11"
  }
}
```

---

## Stretch Goals

- **Read-later queue**: Add one-off URLs to the next digest via the web UI
- **Article scoring**: For feeds like HN, filter by minimum score before including
- **Image optimization**: Downscale images to reMarkable Paper Pro resolution for smaller files
- **Digest preview**: Preview the next digest in the web UI before it syncs
- **Notifications**: Post a summary to Slack/Discord after each successful upload
- **Multiple schedules**: Named schedules with feed groups (morning/evening)
