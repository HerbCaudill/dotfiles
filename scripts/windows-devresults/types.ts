export type VmStatus = "running" | "stopped"

export type OpenDevresultsWorkspaceOptions = {
  vmName: string
  sshHost: string
  remoteFolderPath: string
  pollIntervalMs: number
  maxWaitMs: number
  getVmStatus: (vmName: string) => Promise<VmStatus>
  startVm: (vmName: string) => Promise<void>
  isSshHostReady: (sshHost: string) => Promise<boolean>
  sleep: (delayMs: number) => Promise<void>
  openRemoteFolder: (options: OpenRemoteFolderOptions) => Promise<void>
}

export type OpenRemoteFolderOptions = {
  sshHost: string
  remoteFolderPath: string
}
