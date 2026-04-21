import { describe, expect, test, vi } from "vitest"

import { openDevresultsWorkspace } from "../openDevresultsWorkspace.ts"

describe("openDevresultsWorkspace", () => {
  test("starts the VM, waits for SSH, and opens the remote folder when the VM is stopped", async () => {
    const events: string[] = []
    const sleep = vi.fn(async () => {
      events.push("sleep")
    })

    await openDevresultsWorkspace({
      vmName: "Windows 11",
      sshHost: "devresults-vm",
      remoteFolderPath: "C:/Code/DevResults/",
      pollIntervalMs: 1,
      maxWaitMs: 2,
      getVmStatus: async () => "stopped",
      startVm: async vmName => {
        events.push(`start:${vmName}`)
      },
      isSshHostReady: vi
        .fn()
        .mockImplementationOnce(async () => false)
        .mockImplementationOnce(async () => true),
      sleep,
      openRemoteFolder: async ({ sshHost, remoteFolderPath }) => {
        events.push(`open:${sshHost}:${remoteFolderPath}`)
      },
    })

    expect(events).toEqual(["start:Windows 11", "sleep", "open:devresults-vm:C:/Code/DevResults/"])
  })

  test("opens the remote folder immediately when SSH is already ready", async () => {
    const startVm = vi.fn()
    const sleep = vi.fn()
    const openRemoteFolder = vi.fn()

    await openDevresultsWorkspace({
      vmName: "Windows 11",
      sshHost: "devresults-vm",
      remoteFolderPath: "C:/Code/DevResults/",
      pollIntervalMs: 1,
      maxWaitMs: 5,
      getVmStatus: async () => "running",
      startVm,
      isSshHostReady: async () => true,
      sleep,
      openRemoteFolder,
    })

    expect(startVm).not.toHaveBeenCalled()
    expect(sleep).not.toHaveBeenCalled()
    expect(openRemoteFolder).toHaveBeenCalledWith({
      sshHost: "devresults-vm",
      remoteFolderPath: "C:/Code/DevResults/",
    })
  })

  test("throws when SSH never becomes ready", async () => {
    await expect(
      openDevresultsWorkspace({
        vmName: "Windows 11",
        sshHost: "devresults-vm",
        remoteFolderPath: "C:/Code/DevResults/",
        pollIntervalMs: 1,
        maxWaitMs: 2,
        getVmStatus: async () => "running",
        startVm: async () => undefined,
        isSshHostReady: async () => false,
        sleep: async () => undefined,
        openRemoteFolder: async () => undefined,
      }),
    ).rejects.toThrow("SSH host devresults-vm did not become ready within 2ms")
  })
})
