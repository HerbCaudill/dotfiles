/** Describe host selection and explicit lifecycle operations without requiring a running controller. */
export function getDrenvHelp() {
  return `drenv [--host mini|devresults-vm] create <id> --source <native checkout> --snapshot <receipt.json> [--revision <ref>] [--preset inl] [--vibe-source <Windows checkout>] [--vibe-revision <ref>]
drenv [--host mini|devresults-vm] sync|watch|start|status|url|open|stop|snapshot|reset|remove|recover|refresh-db <id>
drenv --host mini install-vibe <id>
drenv --host mini request <request UUID>
Native mini work uses one Windows registry and survives SSH disconnection. Set DRENV_HOST to select a default host. Windows source paths and snapshot receipts are native mini paths; existing VM commands use paired Mac worktrees.
Creation requires a coordinated SQL/blob snapshot. Reset restores the original creation snapshot. Commit legacy source changes before sync. Watch publishes frontend edits without restarting IIS. VibeResults has its own editable worktree and limited scheduled server; install-vibe explicitly reinstalls its dependencies.`
}
