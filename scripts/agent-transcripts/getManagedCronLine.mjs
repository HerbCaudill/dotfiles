import { CRON_LOG_PATH } from "./constants.mjs"

/** Build the managed cron line for transcript syncing. */
export const getManagedCronLine = () =>
  `*/15 * * * * /bin/zsh -lc '~/.local/bin/agent-transcripts-sync >> ${CRON_LOG_PATH} 2>&1'`
