/** Render tweets as a self-contained HTML document of static cards, in the requested order. */
export const renderTweetCards = (
  /** Tweets and their expansions, in the X API's response shape. */
  response: TweetResponse,
  /** The IDs to show. IDs with no matching tweet are skipped. */
  ids: string[],
) => {
  const lookups: Lookups = {
    users: new Map(response.includes?.users?.map(user => [user.id, user])),
    media: new Map(response.includes?.media?.map(item => [item.media_key, item])),
    quoted: new Map(response.includes?.tweets?.map(tweet => [tweet.id, tweet])),
  }
  const tweets = new Map(response.data.map(tweet => [tweet.id, tweet]))
  const cards = ids.flatMap(id => {
    const tweet = tweets.get(id)
    return tweet ? [renderCard(tweet, lookups)] : []
  })
  return `<!doctype html><html><head><meta charset="utf-8"><style>${STYLE}</style></head><body><div class="list">${cards.join("")}</div></body></html>`
}

/** Render one top-level tweet. */
const renderCard = (
  /** The tweet. */
  tweet: Tweet,
  /** Expansions from the response. */
  lookups: Lookups,
) => {
  const { reply_count, retweet_count, like_count } = tweet.public_metrics ?? {}
  const stats = [
    stat(reply_count, "replies"),
    stat(retweet_count, "reposts"),
    stat(like_count, "likes"),
  ].join("")
  return `<div class="tweet">${renderBody(tweet, lookups)}${renderQuote(tweet, lookups)}<div class="stats">${stats}<a href="${permalink(tweet)}">Open on X</a></div></div>`
}

/** Render the parts shared by top-level and quoted tweets. */
const renderBody = (
  /** The tweet. */
  tweet: Tweet,
  /** Expansions from the response. */
  lookups: Lookups,
) => {
  const user = lookups.users.get(tweet.author_id)
  const avatar = user?.profile_image_url?.replace("_normal", "_bigger") ?? ""
  const head = `<div class="head"><img src="${escapeHtml(avatar)}" alt=""><div><div class="name">${escapeHtml(user?.name ?? "Unknown")}</div><div class="sub">@${escapeHtml(user?.username ?? "unknown")} · ${formatDate(tweet.created_at)}</div></div></div>`
  return `${head}<div class="text">${renderText(tweet)}</div>${renderArticle(tweet)}${renderMedia(tweet, lookups)}`
}

/** Render a tweet's full text with readable links. */
const renderText = (
  /** The tweet. */
  tweet: Tweet,
) => {
  const urls = [...(tweet.note_tweet?.entities?.urls ?? []), ...(tweet.entities?.urls ?? [])]
  const byShortUrl = new Map(urls.map(url => [url.url, url]))
  const quotedId = tweet.referenced_tweets?.find(ref => ref.type === "quoted")?.id
  return (tweet.note_tweet?.text ?? tweet.text)
    .split(/(https:\/\/t\.co\/\w+)/)
    .map(part => {
      if (!part.startsWith("https://t.co/")) return escapeHtml(part)
      const url = byShortUrl.get(part)
      // The card shows these as media, a quote, or an article, so the link would be a duplicate.
      if (url?.media_key) return ""
      if (quotedId && url?.expanded_url?.match(/\/status\/(\d+)/)?.[1] === quotedId) return ""
      if (tweet.article && url?.expanded_url?.includes("/i/article/")) return ""
      return `<a href="${escapeHtml(url?.expanded_url ?? part)}">${escapeHtml(url?.display_url ?? part)}</a>`
    })
    .join("")
    .trim()
}

/** Render a native X Article's title. The API doesn't provide its body. */
const renderArticle = (
  /** The tweet. */
  tweet: Tweet,
) =>
  tweet.article?.title
    ? `<a class="article" href="${permalink(tweet)}"><span class="sub">Article</span><br><b>${escapeHtml(tweet.article.title)}</b></a>`
    : ""

/** Render photos, and thumbnails for videos and GIFs, which can only play on X. */
const renderMedia = (
  /** The tweet. */
  tweet: Tweet,
  /** Expansions from the response. */
  lookups: Lookups,
) => {
  const items = (tweet.attachments?.media_keys ?? []).flatMap(key => {
    const item = lookups.media.get(key)
    return item ? [item] : []
  })
  if (!items.length) return ""
  const cells = items.map(item => {
    const src = escapeHtml(item.url ?? item.preview_image_url ?? "")
    const play = item.type === "photo" ? "" : `<span class="play">▶ Watch on X</span>`
    return `<a class="cell" href="${permalink(tweet)}"><img src="${src}" alt="${escapeHtml(item.alt_text ?? "")}">${play}</a>`
  })
  return `<div class="media n${Math.min(items.length, 4)}">${cells.join("")}</div>`
}

/** Render the tweet this one quotes, if the response includes it. */
const renderQuote = (
  /** The quoting tweet. */
  tweet: Tweet,
  /** Expansions from the response. */
  lookups: Lookups,
) => {
  const ref = tweet.referenced_tweets?.find(item => item.type === "quoted")
  const quoted = ref && lookups.quoted.get(ref.id)
  return quoted ? `<div class="quote">${renderBody(quoted, lookups)}</div>` : ""
}

/** Render one engagement count. */
const stat = (
  /** The count. */
  count: number | undefined,
  /** What it counts. */
  label: string,
) => `<span><b>${formatCount(count ?? 0)}</b> ${label}</span>`

/** Shorten a count, such as 308621 to 308.6K. */
const formatCount = (
  /** The count. */
  count: number,
) => {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`
  return count >= 1000 ? `${(count / 1000).toFixed(1)}K` : String(count)
}

/** Format a timestamp as a UTC date, such as Mar 21, 2026. */
const formatDate = (
  /** An ISO timestamp. */
  iso: string,
) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })

/** Get a tweet's URL on X. */
const permalink = (
  /** The tweet. */
  tweet: Tweet,
) => `https://x.com/i/status/${tweet.id}`

/** Escape text for HTML content and attributes. Tweets are untrusted input. */
const escapeHtml = (
  /** The text. */
  text: string,
) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

// CONSTANTS

// Colors come from the theme variables T3 Code provides, so cards match light and dark threads.
const STYLE = `.list{display:flex;flex-direction:column;gap:12px;max-width:560px}
.tweet{box-sizing:border-box;padding:16px;border:1px solid var(--border);border-radius:var(--radius);background:var(--card);color:var(--card-foreground);font-family:var(--font-sans)}
.head{display:flex;align-items:center;gap:10px}
.head img{width:40px;height:40px;border-radius:50%}
.name{font-weight:600}
.sub{color:var(--muted-foreground);font-size:13px}
.text{white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.45;margin:10px 0}
.text:empty{display:none}
a{color:var(--primary)}
.media{display:grid;gap:4px;margin:10px 0;border-radius:var(--radius);overflow:hidden}
.media.n2,.media.n3,.media.n4{grid-template-columns:1fr 1fr}
.cell{position:relative;display:block}
.cell img{display:block;width:100%;max-height:340px;object-fit:cover}
.media.n2 img,.media.n3 img,.media.n4 img{height:180px}
.play{position:absolute;left:10px;bottom:10px;padding:4px 10px;border-radius:999px;background:rgba(0,0,0,.75);color:#fff;font-size:13px}
.quote{margin:10px 0;padding:12px;border:1px solid var(--border);border-radius:var(--radius)}
.quote .head img{width:24px;height:24px}
.article{display:block;margin:10px 0;padding:12px;border:1px solid var(--border);border-radius:var(--radius);color:inherit;text-decoration:none}
.stats{display:flex;flex-wrap:wrap;gap:14px;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:13px;color:var(--muted-foreground)}
.stats a{margin-left:auto}`

// TYPES

export type TweetResponse = {
  data: Tweet[]
  includes?: {
    users?: User[]
    media?: Media[]
    tweets?: Tweet[]
  }
  errors?: unknown[]
}

type Tweet = {
  id: string
  author_id: string
  created_at: string
  text: string
  note_tweet?: { text: string; entities?: { urls?: TweetUrl[] } }
  article?: { title?: string }
  entities?: { urls?: TweetUrl[] }
  attachments?: { media_keys?: string[] }
  referenced_tweets?: { type: string; id: string }[]
  public_metrics?: { reply_count?: number; retweet_count?: number; like_count?: number }
}

type TweetUrl = {
  url: string
  expanded_url?: string
  display_url?: string
  media_key?: string
}

type User = {
  id: string
  name: string
  username: string
  profile_image_url?: string
}

type Media = {
  media_key: string
  type: string
  url?: string
  preview_image_url?: string
  alt_text?: string
}

type Lookups = {
  users: Map<string, User>
  media: Map<string, Media>
  quoted: Map<string, Tweet>
}
