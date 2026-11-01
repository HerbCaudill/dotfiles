/*
 * Print HTML cards for tweets. Run on the mini, where xurl is signed in.
 *
 *   node tweet-cards.ts <id or URL>...             Fetch fresh data from the X API
 *   node tweet-cards.ts --bookmarks <id or URL>... Read the bookmarks export, with no API call
 */
import { execFileSync } from "node:child_process"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

import { parseTweetId } from "./parseTweetId.ts"
import { renderTweetCards, type TweetResponse } from "./renderTweetCards.ts"

/** Print cards for the tweets named on the command line. */
function main() {
  const args = process.argv.slice(2)
  const ids = args.filter(arg => arg !== "--bookmarks").map(parseTweetId)
  if (!ids.length) throw new Error("Usage: tweet-cards [--bookmarks] <id or URL>...")

  const response = args.includes("--bookmarks") ? readBookmarks() : fetchTweets(ids)
  const found = new Set(response.data?.map(tweet => tweet.id))
  const missing = ids.filter(id => !found.has(id))
  if (missing.length) console.error(`Not found: ${missing.join(", ")}`)
  if (missing.length === ids.length) process.exit(1)

  console.log(renderTweetCards(response, ids))
}

/** Read the maintained bookmarks export from the notes vault. */
function readBookmarks(): TweetResponse {
  return JSON.parse(readFileSync(BOOKMARKS_PATH, "utf8"))
}

/** Fetch tweets and their expansions from the X API. */
function fetchTweets(
  /** Up to 100 tweet IDs, the API's limit for one request. */
  tweetIds: string[],
): TweetResponse {
  if (tweetIds.length > 100) throw new Error("The X API accepts at most 100 tweets per request")
  const query = new URLSearchParams({ ...API_FIELDS, ids: tweetIds.join(",") })
  const output = execFileSync("xurl", ["--app", "bookmarks", `/2/tweets?${query}`], {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  })
  return JSON.parse(output)
}

// CONSTANTS

const BOOKMARKS_PATH = join(
  homedir(),
  "Code/herbcaudill/notes/documents/x-bookmarks/bookmarks.json",
)

const API_FIELDS = {
  "tweet.fields":
    "created_at,author_id,entities,public_metrics,note_tweet,article,referenced_tweets,attachments",
  expansions:
    "author_id,attachments.media_keys,referenced_tweets.id,referenced_tweets.id.author_id",
  "user.fields": "name,username,profile_image_url",
  "media.fields": "type,url,preview_image_url,alt_text",
}

main()
