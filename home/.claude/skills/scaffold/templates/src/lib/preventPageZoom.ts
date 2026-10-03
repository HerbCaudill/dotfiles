/** Block Safari page-zoom gestures while keeping single-finger scrolling available. */
export function preventPageZoom() {
  /** Cancel the browser's gesture without changing normal pointer interactions. */
  const preventGesture = (event: Event) => event.preventDefault()
  const events = ["gesturestart", "gesturechange", "gestureend"]
  for (const event of events) document.addEventListener(event, preventGesture, { passive: false })

  /** Release listeners when the entry point is replaced during development. */
  const dispose = () => {
    for (const event of events) document.removeEventListener(event, preventGesture)
  }
  import.meta.hot?.dispose(dispose)
  return dispose
}
