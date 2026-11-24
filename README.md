# alphaXiv Scroll

> Repository: `alphaxiv-doomscroll`. App name in the UI: **alphaXiv Scroll**.

A mobile-first, TikTok-style vertical feed of the **video explainers** for papers trending on
[alphaXiv](https://www.alphaxiv.org/?sort=Hot). Swipe up for the next paper. Each video autoplays
muted, and you tap it to turn the sound on. Every slide links back to the paper, its authors and its
discussion on alphaXiv.

- **Hot feed only.** Papers come from alphaXiv's Hot ranking, in Hot order.
- **Explainers only.** A trending paper with no alphaXiv video explainer is skipped.
- **Horizontal videos in a vertical frame.** The 16:9 player sits in the middle of the frame. A
  blurred, zoomed copy of the same video fills the space behind it, so nothing gets cropped.
- **TikTok-style overlay.** Hot rank, title, clickable author tags, an explainer badge and a two-line
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
| Data       | alphaXiv MCP (`get_hot_feed`) through `@modelcontextprotocol/sdk`, plus the JSON-LD alphaXiv renders into its pages |
| Validation | zod, for environment variables and upstream payloads                     |
| Tests      | Vitest, run against fixtures captured from real alphaXiv pages            |

## How the data works (and why it runs on the server)

The alphaXiv MCP endpoint (`https://api.alphaxiv.org/mcp/v1`) does not accept cross-origin requests
from browsers. The alphaXiv pages don't send CORS headers either. Because of that, **every request
to alphaXiv goes through this app's server**, and the browser only ever calls `/api/feed`.

```
Browser ──► /api/feed?cursor=N ──► src/lib/alphaxiv/feed.ts
                                     │
                                     ├─ 1. Trending list (cached)
                                     │     • MCP get_hot_feed  (when ALPHAXIV_API_KEY is set)
                                     │     • else the Hot page's JSON-LD "Trending Papers" ItemList
                                     │
                                     └─ 2. For each paper, /abs/<id> (cached, 6 at a time)
                                           • JSON-LD ScholarlyArticle: title, abstract, authors
                                             with /@slug profile URLs, view and upvote counts
                                           • <video aria-label="Video explainer">: mp4, poster, captions
                                           • no explainer → the paper is skipped
```

- MCP `get_hot_feed` returns only paper IDs. None of the alphaXiv MCP tools return video data.
  That's why the app reads each paper's page, where alphaXiv embeds the explainer player along with
  structured schema.org metadata.
- The videos stream straight from `explainers.assets.alphaxiv.org` to the browser. This app never
  proxies them.
- Responses are kept in an in-memory cache for `CACHE_TTL_SECONDS`, and also use Next's fetch
  revalidation. If one paper fails to load, that paper is skipped and the rest of the feed still
  loads.
- Parsing relies on JSON-LD and ARIA labels, not CSS classes, because those change less often. If
  alphaXiv changes its markup, the parser tests in `tests/` show exactly what broke.

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
│           ├── feed.ts          # puts it together: trending list → papers → feed pages
│           ├── mcp.ts           # MCP client for get_hot_feed
│           ├── hot-page.ts      # Hot page JSON-LD parser
│           ├── paper-page.ts    # /abs/<id> parser (metadata and explainer)
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
| `ALPHAXIV_API_KEY`  | none                              | alphaXiv MCP key. When set, the trending list comes from MCP `get_hot_feed`. **Server-only.** |
| `ALPHAXIV_MCP_URL`  | `https://api.alphaxiv.org/mcp/v1` | MCP endpoint (streamable HTTP) |
| `ALPHAXIV_BASE_URL` | `https://www.alphaxiv.org`        | Where the Hot page and paper pages are read from |
| `FEED_SOURCE`       | `auto`                            | `auto` uses MCP if a key is set and falls back to the Hot page. `mcp` uses MCP only. `hot-page` uses the Hot page only |
| `HOT_FEED_LIMIT`    | `60`                              | How many trending papers to scan for explainers (1 to 200) |
| `CACHE_TTL_SECONDS` | `600`                             | How long server-side caches keep results |

### MCP configuration

1. Sign in to alphaXiv and open **Settings → MCP/API**. Create an API key there.
2. Put it in `.env.local` (or in your host's secret store):
   ```bash
   ALPHAXIV_API_KEY=axk_...
   ```
3. Restart the server. When the trending list loads, `/api/feed` responses show `"source": "mcp"`.

The app sends the key as `Authorization: Bearer <key>` over MCP streamable HTTP. The key never
reaches the browser. If MCP fails and `FEED_SOURCE=auto`, the app logs a warning and falls back to
the public Hot page.

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
      "hotRank": 3,
      "explainer": { "src": "https://explainers.assets.alphaxiv.org/….mp4", "poster": "….jpg", "captions": "….vtt" }
    }
  ],
  "nextCursor": 6,      // pass back to get the next page; null means you've reached the end
  "scanned": 21,
  "source": "hot-page"
}
```

`comments` is `null` when alphaXiv doesn't render a count. In that case the UI shows **Discuss**.

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

The server's network needs outbound HTTPS access to `www.alphaxiv.org`, and to
`api.alphaxiv.org` if you use MCP.

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
