# alphaXiv Scroll

> Repository: `alphaxiv-doomscroll`. App name in the UI: **alphaXiv Scroll**.

A mobile-first, TikTok-style vertical feed of the **video explainers** for papers on
[alphaXiv](https://www.alphaxiv.org). Swipe up for the next paper. Each video autoplays
muted, and you tap it to turn the sound on. Every slide links back to the paper, its authors and its
discussion on alphaXiv.

- **Hot first, then Most liked.** Papers come from alphaXiv's Hot list (30 days) in Hot order, then
  from its all-time Most liked list. Both lists are configurable.
- **Explainers only.** Papers without an alphaXiv video explainer are skipped. Explainers are rare
  (on 2026-11-24, 14 of the top 121 Hot papers and 5 of the top 550 liked papers had one), so the
  app scans several pages of each list.
- **Horizontal videos in a vertical frame.** The 16:9 player sits in the middle of the frame. A
  blurred, zoomed copy of the same video fills the space behind it, so nothing gets cropped.
- **TikTok-style overlay.** Rank (e.g. "#3 on Hot"), title, clickable author tags, an explainer badge and a two-line
  summary you can expand. The right-hand rail has upvotes, discussion, share, captions and **Read**.
- **Fast as the feed gets long.** Only the slides near the current one mount a `<video>`. The slide
  right after the current one preloads its metadata, and new pages are fetched before you reach the
  end of the list.
- **Works on phones.** Sized with `100dvh` and safe-area insets, uses `playsinline`, and has been
  tested at iPhone and Pixel viewport sizes.

## Tech stack

| Layer      | Choice                                                                   |
| ---------- | ------------------------------------------------------------------------ |
| Framework  | Next.js 16 (App Router, React 19, TypeScript, strict mode)               |
| Styling    | Tailwind CSS v4                                                          |
| Data       | alphaXiv's public feed API (`api.alphaxiv.org/papers/v3/feed`), with alphaXiv MCP (`get_hot_feed`) as a fallback |
| Validation | zod, for environment variables and upstream payloads                     |
| Tests      | Vitest, run against fixtures modelled on real alphaXiv responses           |

## How the data works (and why it runs on the server)

alphaXiv's own website loads its home feed from a public JSON endpoint,
`https://api.alphaxiv.org/papers/v3/feed`. Every paper in it includes a `video_explainer` field
(`videoUrl`, `videoThumbnailUrl`, `videoCaptionUrl`, `durationSeconds`, or `null`), so one request
returns a whole page of papers along with their explainers. That endpoint only allows CORS for
`https://www.alphaxiv.org`, and the MCP endpoint refuses browsers entirely. Because of that,
**every request to alphaXiv goes through this app's server**, and the browser only ever calls
`/api/feed`.

```
Browser ──► /api/feed?cursor=N ──► src/lib/alphaxiv/feed.ts  (cached for CACHE_TTL_SECONDS)
                                     │
                                     ├─ For each list in FEED_LISTS (default Hot:30 Days, Likes:All time)
                                     │     GET /papers/v3/feed?sort=…&interval=…&pageNum=0..N&pageSize=100
                                     │     (pages fetched 4 at a time; a failed page is skipped)
                                     │
                                     ├─ Keep papers whose video_explainer is set, de-duplicated across lists
                                     │
                                     └─ Fallback when the feed API fails and ALPHAXIV_API_KEY is set:
                                           MCP get_hot_feed → each paper's /abs/<id> page
                                           (JSON-LD metadata + <video aria-label="Video explainer">)
```

- **The feed API is undocumented.** alphaXiv could change it without notice. The parser is lenient:
  it ignores unknown fields, skips papers that don't fit, and fails loudly (with a test to show what
  changed) only if the paper list itself disappears. The documented MCP route is the fallback.
- **No `/?sort=` scraping.** alphaXiv's robots.txt disallows `/?` URLs, so the app never reads the
  home page. `api.alphaxiv.org` has no robots.txt, and `/abs/<id>` pages are allowed.
- The videos stream straight from `explainers.assets.alphaxiv.org` to the browser. This app never
  proxies them.
- Authors link to their alphaXiv profiles (`/@slug`) when alphaXiv has a researcher profile for them.
  Upvotes come from `public_total_votes` and views from `visits_count.all`, the same numbers the site
  shows. The feed has no comment count, so the comment button reads **Discuss**.

**About model attribution:** alphaXiv doesn't publish which model generated an explainer. The badge
on each slide therefore just says "alphaXiv Video Explainer" and makes no claim about the model.

## Directory structure

```
.
├── .github/workflows/ci.yml     # lint, typecheck, tests and build on every push and PR
├── src/
│   ├── app/
│   │   ├── api/feed/route.ts    # GET /api/feed?cursor=&limit=  (JSON, validated params)
│   │   ├── globals.css          # Tailwind, scroll-snap, dvh, safe-area helpers
│   │   ├── layout.tsx           # viewport-fit=cover, theme color, metadata
│   │   └── page.tsx             # server-renders the first page of the feed
│   ├── components/
│   │   ├── Feed.tsx             # snap scroller, windowed rendering, paging, keyboard, toasts
│   │   ├── Slide.tsx            # one full-screen entry
│   │   ├── VideoStage.tsx       # blurred backdrop, centered 16:9 player, tap-to-mute, progress
│   │   ├── Overlay.tsx          # rank, title, author tags, badge, summary
│   │   ├── ActionBar.tsx        # upvotes, discussion, share, CC, read paper
│   │   ├── ExpandableText.tsx   # two-line clamp with more/less
│   │   └── icons.tsx
│   ├── hooks/useActiveIndex.ts  # IntersectionObserver for the slide in view
│   └── lib/
│       ├── config.ts            # zod-validated environment variables
│       ├── format.ts            # compact counts, LaTeX-to-plain-text
│       └── alphaxiv/
│           ├── feed.ts          # puts it together: lists → explainers → feed pages
│           ├── feed-api.ts      # papers/v3/feed client and lenient parser
│           ├── mcp.ts           # MCP client for get_hot_feed
│           ├── paper-page.ts    # /abs/<id> parser (MCP fallback)
│           ├── html.ts, schema.ts, ids.ts, http.ts, cache.ts, types.ts
└── tests/                       # Vitest and fixtures captured from alphaxiv.org
```

## Getting started

Requirements: Node.js 20.9 or newer (22 recommended) and npm.

```bash
git clone https://github.com/m3ghajoshi/alphaxiv-doomscroll.git
cd alphaxiv-doomscroll
npm install
cp .env.example .env.local    # optional, since everything has a default
npm run dev                   # http://localhost:3000
```

To try it on your phone, run `npm run dev -- -H 0.0.0.0` and open `http://<your-computer-ip>:3000`
from a phone on the same Wi-Fi network.

### Scripts

| Command             | What it does                        |
| ------------------- | ----------------------------------- |
| `npm run dev`       | Dev server with hot reload          |
| `npm run build`     | Production build                    |
| `npm start`         | Serve the production build          |
| `npm test`          | Unit and integration tests (Vitest) |
| `npm run lint`      | ESLint (Next.js core-web-vitals)    |
| `npm run typecheck` | `tsc --noEmit`                      |

## Configuration

Every variable is optional. See [`.env.example`](.env.example).

| Variable            | Default                           | Purpose |
| ------------------- | --------------------------------- | ------- |
| `FEED_LISTS`        | `Hot:30 Days,Likes:All time`      | Lists to read, in order. Sorts: Hot, Likes, Views, Comments, GitHub, Recent. Intervals: 3 Days, 7 Days, 30 Days, 90 Days, All time |
| `FEED_PAGE_SIZE`    | `100`                             | Papers per feed request (5 to 100) |
| `FEED_MAX_PAGES`    | `4`                               | Pages read per list (1 to 20) |
| `FEED_SOURCE`       | `auto`                            | `auto` uses the feed API, falling back to MCP if a key is set. `feed-api` or `mcp` forces one source |
| `ALPHAXIV_API_URL`  | `https://api.alphaxiv.org`        | Feed API base URL |
| `ALPHAXIV_API_KEY`  | none                              | alphaXiv MCP key, only needed for the MCP fallback. **Server-only.** |
| `ALPHAXIV_MCP_URL`  | `https://api.alphaxiv.org/mcp/v1` | MCP endpoint (streamable HTTP) |
| `ALPHAXIV_BASE_URL` | `https://www.alphaxiv.org`        | Where `/abs/<id>` pages are read from (MCP fallback) |
| `HOT_FEED_LIMIT`    | `60`                              | Papers the MCP fallback scans (1 to 200) |
| `CACHE_TTL_SECONDS` | `600`                             | How long server-side caches keep results |

### MCP configuration (optional fallback)

The feed works without any key. Add one only if you want the documented MCP route as a fallback
for when the feed API is unavailable.

1. Sign in to alphaXiv and open **Settings → MCP/API**. Create an API key there.
2. Put it in `.env.local` (or in your host's secret store):
   ```bash
   ALPHAXIV_API_KEY=axk_...
   ```
3. Restart the server. To force the MCP route, also set `FEED_SOURCE=mcp`; `/api/feed` then shows
   `"source": "mcp"`.

The app sends the key as `Authorization: Bearer <key>` over MCP streamable HTTP. The key never
reaches the browser.

If you'd like to look at the same server from Claude Code, use:

```bash
claude mcp add --transport http alphaxiv https://api.alphaxiv.org/mcp/v1 \
  --header "Authorization: Bearer <key>"
```

## API

`GET /api/feed?cursor=0&limit=5`

```jsonc
{
  "items": [
    {
      "id": "2611.24778",
      "title": "Counterfactual World Models: JEPAs That Reason About \"What If\"",
      "summary": "World models operate in a world they cannot fully observe…",
      "authors": [{ "name": "Yann LeCun", "profileUrl": "https://www.alphaxiv.org/@yann-lecun", "affiliation": "…" }],
      "views": 7696, "likes": 414, "comments": null,
      "paperUrl": "https://www.alphaxiv.org/abs/2611.24778",
      "discussionUrl": "https://www.alphaxiv.org/abs/2611.24778#discussion",
      "collection": { "sort": "Hot", "interval": "30 Days", "label": "Hot" },
      "rank": 3,
      "explainer": { "src": "https://explainers.assets.alphaxiv.org/….mp4", "poster": "….jpg", "captions": "….vtt" }
    }
  ],
  "nextCursor": 5,      // pass back to get the next page; null means you've reached the end
  "scanned": 780,       // unique papers scanned across all lists
  "total": 19,          // explainers found
  "source": "feed-api"
}
```

`comments` is `null` when alphaXiv doesn't provide a count, which is always the case for the feed
API. In that case the UI shows **Discuss**.

## Controls

| Gesture or key           | Action                                   |
| ------------------------ | ---------------------------------------- |
| Swipe / scroll, `↑` `↓` `j` `k` | Previous or next video            |
| Tap the video, `m`       | Mute or unmute (applies to the whole feed) |
| Tap the progress bar     | Seek                                     |
| CC                       | Captions on or off (alphaXiv provides WebVTT) |
| more / less              | Expand the summary                       |

On iOS Safari, sound only plays after you tap. If the browser blocks sound, the feed switches back
to muted autoplay rather than stopping.

## Deployment

### Vercel (recommended)

```bash
npm i -g vercel
vercel                      # link the project
vercel env add ALPHAXIV_API_KEY   # optional
vercel --prod
```

You can also import the GitHub repo at <https://vercel.com/new>. The defaults work without changes.
The feed is rendered at request time, so builds never need to reach alphaXiv.

### Any Node host or Docker

```bash
npm ci && npm run build
PORT=3000 npm start
```

The server's network needs outbound HTTPS access to `api.alphaxiv.org`, and to
`www.alphaxiv.org` if you use the MCP fallback.

## Creating the GitHub repository

With the [GitHub CLI](https://cli.github.com/):

```bash
gh auth login
gh repo create m3ghajoshi/alphaxiv-doomscroll --public \
  --description "TikTok-style vertical feed of alphaXiv video explainers for trending papers" \
  --source . --remote origin --push
```

With the REST API (needs a token that has the `repo` scope):

```bash
curl -X POST https://api.github.com/user/repos \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -d '{"name":"alphaxiv-doomscroll","private":false,"description":"TikTok-style vertical feed of alphaXiv video explainers for trending papers"}'
git remote add origin https://github.com/m3ghajoshi/alphaxiv-doomscroll.git
git push -u origin main
```

## Notes

- Videos, abstracts, author names and counts belong to alphaXiv and the paper authors. This app
  links back to the source for every one of them and doesn't copy any of them.
- The caches live in memory. On serverless hosts each instance warms its own cache, which is fine at
  this scale.

## License

[MIT](LICENSE)
