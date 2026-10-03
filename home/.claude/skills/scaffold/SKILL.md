---
name: scaffold
description: Use when starting a new frontend web app project. Scaffold React, TypeScript, Vite, Tailwind v4, shadcn/ui, an app-specific icon, safe PWA updates, an immobile mobile shell, IBM Plex fonts, and desktop/mobile checks.
user_invocation: scaffold <project-name>
---

# Scaffold web app

## Overview

Scaffold a frontend-only PWA with React, TypeScript, Vite, Tailwind v4, shadcn/ui, and IBM Plex fonts. Start with a small working app that has its own placeholder icon, explicit update notice, immobile header, and scrolling content. Apply the [mobile-pwa skill](../mobile-pwa/SKILL.md) for the defaults and verification requirements.

## Usage

`/scaffold <project-name>` - creates `~/code/herbcaudill/<project-name>`

## Stack

- **Build:** Vite + TypeScript
- **UI:** React + Tailwind CSS v4 + shadcn/ui
- **Fonts:** IBM Plex Sans, Mono, Serif (via Google Fonts)
- **PWA:** Installable + offline-capable
- **Testing:** Vitest + Playwright
- **Formatting:** Oxfmt
- **Package manager:** pnpm

## Process

First create an app-specific placeholder icon. Infer the app's purpose from the request and project name, choose a recognizable motif and a fitting palette, and draw a simple SVG. A book, checklist, route marker, or other relevant shape is enough; one generic icon reused across projects is not. If only the name is known, derive a distinct symbol or monogram from it without blocking scaffolding for a branding discussion.

Use a square SVG with an opaque full-canvas background. Keep the important shape within the central circle whose radius is 40% of the canvas width so the same master is safe for maskable icons. Save the master to a temporary path, then pass it to the script. The agent owns the visual choice; the script only generates the required sizes. Inspect the result at favicon and Home Screen sizes.

Run the scaffold script with that artwork:

```bash
npx tsx ~/.claude/skills/scaffold/scaffold.ts <project-name> --icon /absolute/path/to/app-specific.svg
```

When Codex runs the script, set `GIT_AUTHOR_NAME=Codex GIT_AUTHOR_EMAIL=codex@localhost` on that invocation so the script's initial commit inherits the required author identity. Preserve the configured committer identity.

The script handles everything:

- Creates Vite project with React + TypeScript template
- Installs dependencies (Tailwind, shadcn, Vitest, Playwright, etc.)
- Configures vite.config.ts with Tailwind, PWA, and path aliases
- Updates tsconfig.json and tsconfig.app.json with path aliases
- Sets up Tailwind CSS v4 in index.css (required before shadcn init)
- Initializes shadcn/ui with button component
- Adds IBM Plex fonts to index.css and index.html
- Creates App.tsx with a solid, full-width sticky header and independently scrolling "Hello" content
- Uses the supplied app-specific SVG as the favicon and generates Apple touch, 192px, 512px, and maskable PNG icons
- Adds `pnpm icons:generate` so later icon changes update every size together
- Configures prompt-based PWA updates and mounts the Tasks-style lower-left "Update now" notice with save guards and per-window reload consent
- Locks the document and prevents input-focus zoom and page pinch zoom, including Safari gestures
- Uses the default iOS status bar and avoids extra blur-workaround padding
- Adds `.oxfmtrc.json` with project settings
- Cleans up Vite boilerplate (App.css, SVGs, README)
- Creates vitest.config.ts (excludes e2e/ to avoid Playwright conflicts) and playwright.config.ts
- Adds sample unit test (App.test.tsx) and e2e test (e2e/app.spec.ts)
- Updates package.json with all scripts
- Installs Playwright Chromium and WebKit browsers, with desktop, Android, and iPhone profiles
- Formats everything with Oxfmt
- Runs tests and the production build before the initial commit and GitHub push
- Verifies real service-worker updates with two windows on an isolated production preview origin
- Initializes beads with the minimal agents profile
- Opens the project in VS Code

## Result

```
~/code/herbcaudill/<project-name>/
├── src/
│   ├── components/
│   │   ├── UpdateNotice.tsx # Explicit PWA update flow
│   │   ├── tests/         # Update notice behavior tests
│   │   └── ui/          # shadcn components
│   ├── lib/
│   │   └── utils.ts     # shadcn utils (cn function)
│   ├── App.tsx          # Immobile header + scrolling content
│   ├── App.test.tsx     # Vitest unit test
│   ├── main.tsx
│   ├── index.css        # Tailwind v4 + shadcn theme
│   ├── mobile.css       # Bounded shell, scrolling, input and gesture defaults
│   ├── pwa.d.ts         # PWA virtual module types
│   └── vitest-setup.ts  # Testing library setup
├── e2e/
│   └── app.spec.ts      # Playwright e2e test
├── public/              # App-specific SVG + generated PNG icon sizes
├── scripts/
│   └── generate-icons.ts
├── index.html           # IBM Plex fonts loaded
├── vite.config.ts       # Tailwind + PWA + path alias
├── vitest.config.ts     # Vitest config
├── playwright.config.ts # Playwright config
├── playwright.pwa.config.ts # Real production worker update check
├── tsconfig.json
├── tsconfig.app.json
├── components.json      # shadcn config
├── .oxfmtrc.json
└── package.json
```

## Scripts

| Script           | Description                                  |
| ---------------- | -------------------------------------------- |
| `dev`            | Start dev server and open browser            |
| `build`          | Type-check and build for production          |
| `test`           | Run Vitest in watch mode                     |
| `test:pw`        | Run Playwright tests                         |
| `test:pw:ui`     | Run Playwright with UI                       |
| `test:pw:headed` | Run Playwright in headed mode                |
| `test:pw:pwa`    | Build and verify real service-worker updates |
| `test:all`       | Typecheck + unit tests + Playwright          |
| `typecheck`      | Run TypeScript type checking                 |
| `format`         | Format code with Oxfmt                       |
| `icons:generate` | Regenerate PNG icons from `public/icon.svg`  |

## Shared lint setup

The scaffold script does not install linting yet. After scaffolding, add the shared warning-only Oxlint rules:

```bash
pnpm add -D @herbcaudill/eslint-plugin oxlint eslint
```

Create `oxlint.config.mts` and extend the shared preset with Oxlint's `defineConfig`. New scaffolded apps use root `e2e/` Playwright tests, so add that exception through the preset factory:

```ts
import { createRecommendedOxlintConfig } from "@herbcaudill/eslint-plugin"
import { defineConfig } from "oxlint"

export default defineConfig({
  extends: [
    createRecommendedOxlintConfig({
      testStoryFileExceptions: {
        frameworkFilePatterns: ["e2e/**"],
      },
    }),
  ],
})
```

Projects without exceptions can import `recommendedOxlintConfig` instead. Add `"lint": "oxlint ."` to `package.json`; Oxlint auto-discovers `oxlint.config.mts`. Use the package README for other generated or framework-owned file exceptions.

## Mobile verification

Run the desktop and touch browser checks, then capture and inspect the actual page at desktop, narrow-phone, and typical-phone widths. Confirm the header stays still while the content scrolls, menus remain above content, dialogs fit, text is readable, and controls remain reachable. Adapting the chosen desktop layout and visually confirming the phone version are required in the same work; automated layout assertions do not replace screenshot inspection.

Test real production service-worker updates as described in the mobile-pwa skill, including a second window with unsaved work. Native iPhone top blur, keyboard movement, focus zoom, and pinch behavior need a physical device check. State clearly when only emulated checks are available.

## Common issues

| Issue                        | Fix                                         |
| ---------------------------- | ------------------------------------------- |
| gh repo create fails         | Run `gh auth login` first                   |
| Playwright browser not found | Run `pnpm exec playwright install chromium` |
| Vercel CLI not found         | Run `pnpm add -g vercel`                    |

## After scaffolding

Once the project is verified working, ask the user if they want to deploy it:

> "Project scaffolded successfully. Would you like me to deploy it to `<project-name>.herbcaudill.com`?"

If yes, run `/deploy` (no arguments needed since we're in the project directory).
