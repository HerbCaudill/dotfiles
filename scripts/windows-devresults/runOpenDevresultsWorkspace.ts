import {
  DEFAULT_MAX_WAIT_MS,
  DEFAULT_POLL_INTERVAL_MS,
  DEFAULT_REMOTE_FOLDER_PATH,
  DEFAULT_SSH_HOST,
  DEFAULT_VM_NAME,
} from "./constants.ts"
import { getVmStatus } from "./getVmStatus.ts"
import { isSshHostReady } from "./isSshHostReady.ts"
import { openDevresultsWorkspace } from "./openDevresultsWorkspace.ts"
import { openRemoteFolder } from "./openRemoteFolder.ts"
import { sleep } from "./sleep.ts"
import { startVm } from "./startVm.ts"

/** Run the end-to-end DevResults Windows VM workspace opener. */
export async function runOpenDevresultsWorkspace(): Promise<void> {
  const vmName = process.env.DEVRESULTS_VM_NAME ?? DEFAULT_VM_NAME
  const sshHost = process.env.DEVRESULTS_SSH_HOST ?? DEFAULT_SSH_HOST
  const remoteFolderPath = process.env.DEVRESULTS_REMOTE_FOLDER_PATH ?? DEFAULT_REMOTE_FOLDER_PATH

  await openDevresultsWorkspace({
    vmName,
    sshHost,
    remoteFolderPath,
    pollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
    maxWaitMs: DEFAULT_MAX_WAIT_MS,
    getVmStatus,
    startVm,
    isSshHostReady,
    sleep,
    openRemoteFolder,
  })
}
