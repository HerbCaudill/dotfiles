/** Read a tweet ID from a bare ID or a tweet URL. */
export const parseTweetId = (
  /** A numeric ID or an x.com or twitter.com status URL. */
  input: string,
) => {
  const id = /^\d+$/.test(input) ? input : input.match(/\/status(?:es)?\/(\d+)/)?.[1]
  if (!id) throw new Error(`Not a tweet ID or URL: ${input}`)
  return id
}
