/** List AMD Adrenalin versions (year.month.n) that could follow a known release, oldest first. */
export function amdReleaseCandidates(
  /** The newest release already seen, such as "26.10.2". */
  known: string,
): string[] {
  const [year, month, n] = known.split(".").map(Number)
  const following = (offset: number) => {
    const index = year * 12 + (month - 1) + offset
    return `${Math.floor(index / 12)}.${(index % 12) + 1}`
  }
  return [
    `${year}.${month}.${n + 1}`,
    `${year}.${month}.${n + 2}`,
    `${following(1)}.1`,
    `${following(1)}.2`,
    `${following(1)}.3`,
    `${following(2)}.1`,
    `${following(2)}.2`,
  ]
}
