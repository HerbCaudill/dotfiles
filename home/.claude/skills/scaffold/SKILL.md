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

- Creates Vite project with React + TypeScript template
- Installs dependencies (Tailwind, shadcn, Vitest, Playwright, etc.)
- Configures vite.config.ts with Tailwind, PWA, and path aliases
- Updates tsconfig.json and tsconfig.app.json with path aliases
- Sets up Tailwind CSS v4 in index.css (required before shadcn init)
- Initializes shadcn/ui with button component
- Adds IBM Plex fonts to index.css and index.html
- Creates App.tsx with "Hello, world"
- Adds .prettierrc with project settings
- Cleans up Vite boilerplate (App.css, SVGs, README)
- Creates vitest.config.ts (excludes e2e/ to avoid Playwright conflicts) and playwright.config.ts
- Adds sample unit test (App.test.tsx) and e2e test (e2e/app.spec.ts)
- Updates package.json with all scripts
- Installs Playwright Chromium browser
- Formats everything with Prettier
- Initializes git and pushes to GitHub
- Runs tests to verify everything works
- Opens the project in VS Code

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

| Issue                        | Fix                                         |
| ---------------------------- | ------------------------------------------- |
| gh repo create fails         | Run `gh auth login` first                   |
| Playwright browser not found | Run `pnpm exec playwright install chromium` |
| Vercel CLI not found         | Run `pnpm add -g vercel`                    |

## After Scaffolding

Once the project is verified working, ask the user if they want to deploy it:

> "Project scaffolded successfully. Would you like me to deploy it to `<project-name>.herbcaudill.com`?"

If yes, run `/deploy` (no arguments needed since we're in the project directory).
