---
name: scaffold
description: Use when starting a new frontend web app project - scaffolds React + TypeScript + Vite + Tailwind v4 + shadcn/ui + PWA with IBM Plex fonts, clean structure, and "Hello, world" starting point
user_invocation: scaffold <project-name>
---

# Scaffold Web App

## Overview

Scaffold a frontend-only PWA with React, TypeScript, Vite, Tailwind v4, shadcn/ui, and IBM Plex fonts. Creates a clean starting point that just displays "Hello, world".

## Usage

`/scaffold <project-name>` - creates `~/code/herbcaudill/<project-name>`

## Stack

- **Build:** Vite + TypeScript
- **UI:** React + Tailwind CSS v4 + shadcn/ui
- **Fonts:** IBM Plex Sans, Mono, Serif (via Google Fonts)
- **PWA:** Installable + offline-capable
- **Testing:** Vitest + Playwright
- **Package manager:** pnpm

## Process

Run the scaffold script:

```bash
npx tsx ~/.claude/skills/scaffold/scaffold.ts <project-name>
```

The script handles everything:

1. Creates Vite project with React + TypeScript template
2. Installs dependencies (Tailwind, shadcn, Vitest, Playwright, etc.)
3. Configures vite.config.ts with Tailwind, PWA, and path aliases
4. Updates tsconfig.json and tsconfig.app.json with path aliases
5. Initializes shadcn/ui with button component
6. Adds IBM Plex fonts to index.css and index.html
7. Creates App.tsx with "Hello, world"
8. Adds .prettierrc with project settings
9. Cleans up Vite boilerplate (App.css, SVGs, README)
10. Creates vitest.config.ts and playwright.config.ts
11. Adds sample unit test (App.test.tsx) and e2e test (e2e/app.spec.ts)
12. Updates package.json with all scripts
13. Installs Playwright Chromium browser
14. Formats everything with Prettier
15. Initializes git and pushes to GitHub
16. Runs tests to verify everything works

## Result

```
~/code/herbcaudill/<project-name>/
├── src/
│   ├── components/
│   │   └── ui/          # shadcn components
│   ├── lib/
│   │   └── utils.ts     # shadcn utils (cn function)
│   ├── App.tsx          # "Hello, world"
│   ├── App.test.tsx     # Vitest unit test
│   ├── main.tsx
│   ├── index.css        # Tailwind v4 + shadcn theme
│   └── vitest-setup.ts  # Testing library setup
├── e2e/
│   └── app.spec.ts      # Playwright e2e test
├── index.html           # IBM Plex fonts loaded
├── vite.config.ts       # Tailwind + PWA + path alias
├── vitest.config.ts     # Vitest config
├── playwright.config.ts # Playwright config
├── tsconfig.json
├── tsconfig.app.json
├── components.json      # shadcn config
├── .prettierrc
└── package.json
```

## Scripts

| Script           | Description                              |
| ---------------- | ---------------------------------------- |
| `dev`            | Start dev server and open browser        |
| `build`          | Type-check and build for production      |
| `test`           | Run Vitest in watch mode                 |
| `test:pw`        | Run Playwright tests                     |
| `test:pw:ui`     | Run Playwright with UI                   |
| `test:pw:headed` | Run Playwright in headed mode            |
| `test:all`       | Typecheck + unit tests + Playwright      |
| `typecheck`      | Run TypeScript type checking             |
| `format`         | Format code with Prettier                |
| `ralph`          | Run Ralph                                |

## Common Issues

| Issue                        | Fix                                      |
| ---------------------------- | ---------------------------------------- |
| gh repo create fails         | Run `gh auth login` first                |
| Playwright browser not found | Run `pnpm exec playwright install chromium` |

## After Scaffolding

Once the project is verified working, ask the user if they want to deploy it:

> "Project scaffolded successfully. Would you like me to deploy it to `<project-name>.herbcaudill.com`?"

If yes, run `/deploy` (no arguments needed since we're in the project directory).
