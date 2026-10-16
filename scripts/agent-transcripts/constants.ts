import { homedir } from "node:os"
import { join } from "node:path"

/** Working clone of the private shared transcript archive. */
export const AGENT_TRANSCRIPTS_REPO_PATH =
  process.env.AGENT_TRANSCRIPTS_REPO_PATH ?? join(homedir(), "Code/HerbCaudill/agent-transcripts")
