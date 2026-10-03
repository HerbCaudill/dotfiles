import { expect, it } from "vitest"
import { preventPageZoom } from "../preventPageZoom"

it("cancels Safari page zoom while preserving ordinary touch movement", () => {
  const dispose = preventPageZoom()
  try {
    const pinch = new Event("gesturestart", { cancelable: true })
    document.dispatchEvent(pinch)
    expect(pinch.defaultPrevented).toBe(true)
    const scroll = new Event("touchmove", { cancelable: true })
    document.dispatchEvent(scroll)
    expect(scroll.defaultPrevented).toBe(false)
  } finally {
    dispose()
  }
  const released = new Event("gesturestart", { cancelable: true })
  document.dispatchEvent(released)
  expect(released.defaultPrevented).toBe(false)
})
