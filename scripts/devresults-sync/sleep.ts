/** Wait for a number of milliseconds. */
export function sleep(
  /** The number of milliseconds to wait */
  milliseconds: number,
) {
  return new Promise(resolve => setTimeout(resolve, milliseconds))
}
