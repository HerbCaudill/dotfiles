/** Wait for the requested number of milliseconds. */
export async function sleep(
  /** The delay in milliseconds. */
  delayMs: number,
): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, delayMs))
}
