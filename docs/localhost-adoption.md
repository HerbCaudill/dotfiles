# Localhost adoption

Updated 6 October 2026. The rollout covers 29 local web app repositories with authored activity since 6 October 2025. Tasks was already integrated. DevResults (including the separate marketing site), VibeResults, and Screen Time Bank are excluded. CLI tools, libraries, reference clones, duplicate worktrees, and static data projects without an interactive app are excluded. The localhost-router prototype retains its private HTTP sandbox for lifecycle tests.

Run `pnpm dev` in an adopted checkout. Run `pnpm dev:url` to print its address. Linked worktree folders prefix the hostname; a folder named `tofu` gives `https://tofu.<repo>.localhost`. Required backends start and stop through the same app command. Per-repo details live in `docs/local-development.md`.

## Addresses and commits

The changes are committed in each active checkout. Commits with available remotes are published on `codex/shared-localhost-adoption`; the older Scorable clone uses `codex/shared-localhost-adoption-legacy`. Existing working changes and unrelated staged files were kept separate from these commits.

| Repository | Main address | Commit | Routing check |
| --- | --- | --- | --- |
| art-test | [https://art-test.localhost](https://art-test.localhost) | [abe6fa0](https://github.com/HerbCaudill/art-test/commit/abe6fa05b9078dc6c92957adb7f476e26a5d3b3c) | HTTPS and secure hot-reload connection |
| auth | [https://auth.localhost](https://auth.localhost) | [7f4eb04](https://github.com/local-first-web/auth/commit/7f4eb043a8671541832091a7da4556637ce4cbb5) | HTTPS and secure hot-reload connection |
| auth-presentation | [https://auth-presentation.localhost](https://auth-presentation.localhost) | [22ccb78](https://github.com/HerbCaudill/auth-presentation/commit/22ccb787097941c644018758e93ecdf63727589b) | HTTPS and secure hot-reload connection |
| beads-ui | [https://beads-ui.localhost](https://beads-ui.localhost) | [d3cd990](https://github.com/HerbCaudill/beads-ui/commit/d3cd990daf95ff0992227e35870a2d634e4d446b) | HTTPS and secure hot-reload connection |
| briefings | [https://briefings.localhost](https://briefings.localhost) | [4638c97](https://github.com/HerbCaudill/briefings/commit/4638c97822a4285e792f1f1024e9a3c5339fac46) | HTTPS and secure hot-reload connection |
| cervantes | [https://cervantes.localhost](https://cervantes.localhost) | [d2a5974](https://github.com/HerbCaudill/cervantes/commit/d2a59744814b90d038f6b0970397803eec608747) | HTTPS and secure hot-reload connection |
| corpus-audit | [https://corpus-audit.localhost](https://corpus-audit.localhost) | [62c7b94](https://github.com/HerbCaudill/corpus-audit/commit/62c7b94d2c4710faf3c195fab65bc13ce771418e) | HTTPS with synthetic audit data |
| crm | [https://crm.localhost](https://crm.localhost) | [9acaa9c](https://github.com/HerbCaudill/crm/commit/9acaa9cbbb4ccb9d200a5e3ab314cb23d572e7f4) | HTTPS and secure hot-reload connection |
| dream-journal | [https://dream-journal.localhost](https://dream-journal.localhost) | [45d4ed3](https://github.com/HerbCaudill/dream-journal/commit/45d4ed30e120292ee69c5d4e686657b7d825df41) | HTTPS and secure hot-reload connection |
| dreams | [https://dreams.localhost](https://dreams.localhost) | `809ba81` (local) | HTTPS static preview |
| icons | [https://icons.localhost](https://icons.localhost) | [f9a89de](https://github.com/HerbCaudill/icons/commit/f9a89dedc90875655791b5f9d20dd016bc16eb79) | HTTPS and secure hot-reload connection |
| journal | [https://journal.localhost](https://journal.localhost) | [72128a8](https://github.com/HerbCaudill/journal/commit/72128a87e1d7320b272cf55337704a2f7872a324) | HTTPS and secure hot-reload connection |
| journal-old | [https://journal-old.localhost](https://journal-old.localhost) | [2703dd8](https://github.com/HerbCaudill/journal-old/commit/2703dd8cdfe21c395d8940e4eb1e1719ae98a758) | HTTPS and secure hot-reload connection |
| marvin | [https://marvin.localhost](https://marvin.localhost) | [2125f24](https://github.com/HerbCaudill/marvin/commit/2125f24a67ba4e2a5470d2df5c5e5b5926f3dc50) | HTTPS and secure hot-reload connection |
| notebox | [https://notebox.localhost](https://notebox.localhost) | [c9ce357](https://github.com/HerbCaudill/notebox/commit/c9ce35701722317775776e559903209b61a968a2) | HTTPS and secure hot-reload connection |
| ralph | [https://ralph.localhost](https://ralph.localhost) | [20686c0](https://github.com/HerbCaudill/ralph/commit/20686c0e6883fe269549ffe5e28a9bd4c761d39f) | HTTPS and secure hot-reload connection |
| report-templates-prototype | [https://report-templates-prototype.localhost](https://report-templates-prototype.localhost) | [7e559b4](https://github.com/HerbCaudill/report-templates-prototype/commit/7e559b40b363ffacb0f72608d16bd140ac39e962) | HTTPS and HMR connect; existing source syntax error |
| scorable | [https://scorable.localhost](https://scorable.localhost) | [ea337bd](https://github.com/HerbCaudill/scorable/commit/ea337bd66b15a03dde10a6c587cc0fa373c98d53) | HTTPS and secure hot-reload connection |
| scorable-old | [https://legacy.scorable.localhost](https://legacy.scorable.localhost) | [2da3fe8](https://github.com/HerbCaudill/scorable/commit/2da3fe89150e1acb139c75c736c747a4b9a6d2ef) | HTTPS and secure hot-reload connection |
| scrabble | [https://scrabble.localhost](https://scrabble.localhost) | [9c27a9f](https://github.com/HerbCaudill/scrabble/commit/9c27a9f250e4aadbcb859a0196a22455e786fc5c) | HTTPS and secure hot-reload connection |
| spelling-bee-buddy | [https://spelling-bee-buddy.localhost](https://spelling-bee-buddy.localhost) | [30a8bda](https://github.com/HerbCaudill/spelling-bee-buddy/commit/30a8bda96d350b41fc50e6c9a5a6aeadcb3b0886) | HTTPS and secure hot-reload connection |
| tic-tac-toe-game | [https://tic-tac-toe-game.localhost](https://tic-tac-toe-game.localhost) | `d8fd6f2` (local) | HTTPS and secure hot-reload connection |
| timeline | [https://timeline.localhost](https://timeline.localhost) | [0e9c9ea](https://github.com/HerbCaudill/timeline/commit/0e9c9ea7f47b65b1a82366d67625fed5a52173ff) | HTTPS and secure hot-reload connection |
| tourist | [https://tourist.localhost](https://tourist.localhost) | [0fe68f1](https://github.com/HerbCaudill/tourist/commit/0fe68f18f66c230a3fa8bdb3bb4e53e55dc4019d) | HTTPS and secure hot-reload connection |
| translate | [https://translate.localhost](https://translate.localhost) | [4ca5f24](https://github.com/HerbCaudill/translate/commit/4ca5f24af39674f4f4bb802ccaac7e76c274514a) | HTTPS and secure hot-reload connection |
| vose-flix | [https://vose-flix.localhost](https://vose-flix.localhost) | [b90a7aa](https://github.com/HerbCaudill/vose-flix/commit/b90a7aaf46d7472a821afe62dc44d36e2bed5bbb) | HTTPS and secure hot-reload connection |
| watchlist | [https://watchlist.localhost](https://watchlist.localhost) | [5ff1239](https://github.com/HerbCaudill/watchlist/commit/5ff12399f43bf6d2d4e68c0210a371efe96f529b) | HTTPS and secure hot-reload connection |
| word-finder | [https://word-finder.localhost](https://word-finder.localhost) | [de0c083](https://github.com/HerbCaudill/word-finder/commit/de0c083e1377aa09b84c4f0da149f9f5b28c286d) | HTTPS and secure hot-reload connection |
| xword-stats | [https://xword-stats.localhost](https://xword-stats.localhost) | [53d4c46](https://github.com/HerbCaudill/xword-stats/commit/53d4c46a3c166aa9ebf99fe6a99b4df0971b95f8) | HTTPS and secure hot-reload connection |

Tasks remains at [https://tasks.localhost](https://tasks.localhost).

## Additional services

| App | Command or service | Address |
| --- | --- | --- |
| Auth Todos | Sync service started by `pnpm dev` | https://sync.auth.localhost |
| Auth Taco chat | `pnpm dev:taco` | https://chat.auth.localhost |
| Auth Taco chat | Relay started with Taco chat | https://relay.auth.localhost |
| Ralph | `pnpm demo:agent` | https://agent-demo.ralph.localhost |
| Ralph | `pnpm demo:beads` | https://beads-demo.ralph.localhost |
| Spelling Bee Buddy | Worker started by `pnpm dev` | https://api.spelling-bee-buddy.localhost |

Worktree prefixes apply to every service. Older Scorable uses a separate `legacy` service because both Scorable clones have the same Git origin.

## Verification and remaining limits

Trusted Chrome HTTPS responses and secure hot-reload WebSocket connections passed for every adopted Vite and Next.js app. Dreams serves its dated interactive HTML artifacts through HTTPS. The audit viewer passed with a temporary synthetic fixture; no live audit data was inspected or changed. The app launchers stopped their owned processes and registrations after each check. The shared proxy remains running, with no active app registrations left by the checks.

Focused behavioral tests passed for named HTTPS origins in Marvin and the audit viewer, the Spelling Bee Buddy API URL, assigned frontend ports in Beads UI, backend port allocation in Ralph, the Auth Todos sync URL, and the Dreams preview’s file boundaries. Existing Icons and Tic Tac Toe type, unit, and browser suites passed; Icons lint and build passed. Auth demo typechecks, Beads UI typechecks, and the audit viewer typecheck passed. The shared naming tests passed. Tasks’ existing routing suite passed, including a detached worktree and a real hot update that preserves page state.

Report Templates’ current working copy has a pre-existing syntax error at `src/mockData.ts:48` (`{ w`). Its routing and secure HMR connection work, but that local edit prevents the app from compiling. The edit was preserved. Routing checks do not exercise every application feature or migrate browser data. Existing remote services, credentials, and data-linking flows still apply.

Dreams has no origin remote. Tic Tac Toe’s configured GitHub repository is unavailable. Their changes are committed locally; all other app commits were pushed successfully. No replacement GitHub repositories were created.

Next.js uses a stable `.next-localhost` directory separate from the direct server’s `.next`, with its generated type path included explicitly. A startup check confirmed that Next.js leaves `tsconfig.json` unchanged. Vite caches are separated by assigned port so isolated test servers do not share the routed server’s optimizer output.

The shared proxy initially had an exited launchd job. Reloading its installed LaunchDaemon restored service. `localhost-dev doctor` then reported zero failures and zero warnings, including trusted OS certificates and the HTTPS listener. No Nix configuration changes were needed.
