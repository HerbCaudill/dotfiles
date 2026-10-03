import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import type { RegisterSWOptions } from "vite-plugin-pwa/types"

const { registerSW, update } = vi.hoisted(() => ({ registerSW: vi.fn(), update: vi.fn() }))
vi.mock("virtual:pwa-register", () => ({ registerSW }))
import { UpdateNotice } from "../UpdateNotice"

let options: RegisterSWOptions

beforeEach(() => {
  vi.stubGlobal("location", { reload: vi.fn() })
  update.mockReset().mockResolvedValue(undefined)
  registerSW.mockReset().mockImplementation((next: RegisterSWOptions) => {
    options = next
    return update
  })
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

it("offers the update only when ready and activates it with one click", async () => {
  render(<UpdateNotice />)
  expect(screen.queryByRole("button", { name: "Update now" })).not.toBeInTheDocument()
  act(() => options.onNeedRefresh?.())
  expect(screen.getByRole("status")).toHaveTextContent("An update is ready.")
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Update now" })))
  expect(update).toHaveBeenCalledOnce()
  expect(screen.getByRole("button", { name: "Updating…" })).toBeDisabled()
  act(() => options.onNeedReload?.())
  expect(location.reload).toHaveBeenCalledOnce()
})

it("keeps unsaved work open until the existing leave guard clears", async () => {
  render(<UpdateNotice />)
  act(() => options.onNeedRefresh?.())
  const guard = (event: Event) => event.preventDefault()
  window.addEventListener("beforeunload", guard)
  try {
    fireEvent.click(screen.getByRole("button", { name: "Update now" }))
    expect(update).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Finish saving your changes, then try again.",
    )
  } finally {
    window.removeEventListener("beforeunload", guard)
  }
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Update now" })))
  expect(update).toHaveBeenCalledOnce()
})

it("leaves this window open when another window activates an update", async () => {
  render(<UpdateNotice />)
  act(() => options.onNeedReload?.())
  expect(screen.getByRole("button", { name: "Update now" })).toBeEnabled()
  expect(update).not.toHaveBeenCalled()
  expect(location.reload).not.toHaveBeenCalled()
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Update now" })))
  expect(location.reload).toHaveBeenCalledOnce()
})

it("keeps new unsaved work open if it appears while the worker activates", async () => {
  render(<UpdateNotice />)
  act(() => options.onNeedRefresh?.())
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Update now" })))
  const guard = (event: Event) => event.preventDefault()
  window.addEventListener("beforeunload", guard)
  try {
    act(() => options.onNeedReload?.())
    expect(location.reload).not.toHaveBeenCalled()
    expect(screen.getByRole("alert")).toHaveTextContent("Finish saving your changes")
  } finally {
    window.removeEventListener("beforeunload", guard)
  }
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Update now" })))
  expect(location.reload).toHaveBeenCalledOnce()
  expect(update).toHaveBeenCalledOnce()
})

it("offers a retry when activating the update fails", async () => {
  update.mockRejectedValueOnce(new Error("Update unavailable"))
  render(<UpdateNotice />)
  act(() => options.onNeedRefresh?.())
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Update now" })))
  expect(screen.getByRole("alert")).toHaveTextContent("Could not install the update. Try again.")
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Update now" })))
  expect(update).toHaveBeenCalledTimes(2)
})
