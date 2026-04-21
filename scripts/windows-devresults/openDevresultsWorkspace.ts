import type { OpenDevresultsWorkspaceOptions } from "./types.ts"

/** Start the Windows VM if needed, wait for SSH, and open the remote folder in VS Code. */
export async function openDevresultsWorkspace({
  vmName,
  sshHost,
  remoteFolderPath,
  pollIntervalMs,
  maxWaitMs,
  getVmStatus,
  startVm,
  isSshHostReady,
  sleep,
  openRemoteFolder,
}: OpenDevresultsWorkspaceOptions): Promise<void> {
  const vmStatus = await getVmStatus(vmName)

  if (vmStatus !== "running") {
    await startVm(vmName)
  }

  let elapsedMs = 0

  while (!(await isSshHostReady(sshHost))) {
    if (elapsedMs >= maxWaitMs) {
      throw new Error(`SSH host ${sshHost} did not become ready within ${maxWaitMs}ms`)
    }

    await sleep(pollIntervalMs)
    elapsedMs += pollIntervalMs
  }

  await openRemoteFolder({ sshHost, remoteFolderPath })
}
