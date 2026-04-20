/** Get daily note date strings from tomorrow back through the previous 30 days. */
export const getDailyNoteDates = (
  /** The reference date used to calculate note dates. */
  referenceDate = new Date(),
) =>
  Array.from({ length: 32 }, (_, index) => index - 1).map(offset => {
    const targetDate = new Date(referenceDate)
    targetDate.setHours(12, 0, 0, 0)
    targetDate.setDate(targetDate.getDate() - offset)

    const year = String(targetDate.getFullYear())
    const month = String(targetDate.getMonth() + 1).padStart(2, "0")
    const day = String(targetDate.getDate()).padStart(2, "0")

    return `${year}-${month}-${day}`
  })
