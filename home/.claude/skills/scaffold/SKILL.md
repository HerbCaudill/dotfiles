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

The project name is provided as an argument (e.g., `/scaffold foo` creates `~/code/herbcaudill/foo`).

1. **Create project:**

   ```bash
   cd ~/code/herbcaudill
   pnpm create vite <project-name> --template react-ts
   cd <project-name>
   pnpm install
   ```

2. **Install dependencies:**

   ```bash
   pnpm add -D tailwindcss @tailwindcss/vite vite-plugin-pwa prettier prettier-plugin-tailwindcss vitest @testing-library/react @testing-library/dom jsdom @playwright/test @types/node
   pnpm add lucide-react
   ```

3. **Configure vite.config.ts:**

   ```ts
   import { defineConfig } from "vite"
   import react from "@vitejs/plugin-react"
   import tailwindcss from "@tailwindcss/vite"
   import { VitePWA } from "vite-plugin-pwa"
   import path from "path"

   export default defineConfig({
     plugins: [
       react(),
       tailwindcss(),
       VitePWA({
         registerType: "autoUpdate",
         manifest: {
           name: "<Project Name>",
           short_name: "<project-name>",
           start_url: "/",
           display: "standalone",
           background_color: "#ffffff",
           theme_color: "#000000",
         },
         workbox: {
           globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
         },
       }),
     ],
     resolve: {
       alias: {
         "@": path.resolve(__dirname, "./src"),
       },
     },
   })
   ```

4. **Update tsconfig.json** - add path alias to compilerOptions:

   ```json
   {
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```

5. **Update tsconfig.app.json** - add path alias to compilerOptions:

   ```json
   {
     "compilerOptions": {
       "baseUrl": ".",
       "paths": {
         "@/*": ["./src/*"]
       }
     }
   }
   ```

6. **Initialize shadcn/ui** (this sets up index.css with Tailwind v4 syntax):

   ```bash
   pnpm dlx shadcn@latest init -d
   pnpm dlx shadcn@latest add button
   ```

7. **Add IBM Plex fonts to src/index.css** - add to the existing @theme block:

   ```css
   @theme {
     --font-sans: "IBM Plex Sans", system-ui, sans-serif;
     --font-serif: "IBM Plex Serif", Georgia, serif;
     --font-mono: "IBM Plex Mono", monospace;
   }
   ```

8. **Update index.html** - add IBM Plex fonts:

   ```html
   <!DOCTYPE html>
   <html lang="en">
     <head>
       <meta charset="UTF-8" />
       <link rel="icon" href="data:," />
       <meta name="viewport" content="width=device-width, initial-scale=1.0" />
       <link rel="preconnect" href="https://fonts.googleapis.com" />
       <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
       <link
         href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&family=IBM+Plex+Serif:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
         rel="stylesheet"
       />
       <title><Project Name></title>
     </head>
     <body>
       <div id="root"></div>
       <script type="module" src="/src/main.tsx"></script>
     </body>
   </html>
   ```

9. **Replace src/App.tsx:**

   ```tsx
   export default function App() {
     return (
       <div className="flex min-h-screen items-center justify-center">
         <h1 className="text-4xl font-bold">Hello, world</h1>
       </div>
     )
   }
   ```

10. **Update src/main.tsx** (remove App.css import if present):

    ```tsx
    import { StrictMode } from "react"
    import { createRoot } from "react-dom/client"
    import "./index.css"
    import App from "./App.tsx"

    createRoot(document.getElementById("root")!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    ```

11. **Add .prettierrc:**

    ```json
    {
      "arrowParens": "avoid",
      "bracketSpacing": true,
      "endOfLine": "auto",
      "semi": false,
      "singleQuote": false,
      "tabWidth": 2,
      "trailingComma": "all",
      "useTabs": false,
      "experimentalTernaries": true,
      "printWidth": 100,
      "plugins": ["prettier-plugin-tailwindcss"]
    }
    ```

12. **Clean up Vite boilerplate:**

    ```bash
    rm -f src/App.css src/assets/react.svg public/vite.svg README.md
    ```

13. **Add vitest.config.ts:**

    ```ts
    import { defineConfig } from "vitest/config"
    import react from "@vitejs/plugin-react"
    import path from "path"

    export default defineConfig({
      plugins: [react()],
      test: {
        environment: "jsdom",
        globals: true,
      },
      resolve: {
        alias: {
          "@": path.resolve(__dirname, "./src"),
        },
      },
    })
    ```

14. **Add playwright.config.ts:**

    ```ts
    import { defineConfig, devices } from "@playwright/test"

    export default defineConfig({
      testDir: "./e2e",
      fullyParallel: true,
      forbidOnly: !!process.env.CI,
      retries: process.env.CI ? 2 : 0,
      workers: process.env.CI ? 1 : undefined,
      reporter: "html",
      use: {
        baseURL: "http://localhost:5173",
        trace: "on-first-retry",
      },
      projects: [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
      ],
      webServer: {
        command: "pnpm dev",
        url: "http://localhost:5173",
        reuseExistingServer: !process.env.CI,
      },
    })
    ```

15. **Add src/App.test.tsx:**

    ```tsx
    import { render, screen } from "@testing-library/react"
    import { describe, it, expect } from "vitest"
    import App from "./App"

    describe("App", () => {
      it("renders hello world", () => {
        render(<App />)
        expect(screen.getByText("Hello, world")).toBeInTheDocument()
      })
    })
    ```

16. **Add src/vitest-setup.ts:**

    ```ts
    import "@testing-library/jest-dom/vitest"
    ```

17. **Update vitest.config.ts to include setup file** - add to test config:

    ```ts
    test: {
      environment: "jsdom",
      globals: true,
      setupFiles: ["./src/vitest-setup.ts"],
    },
    ```

18. **Create e2e directory and add e2e/app.spec.ts:**

    ```ts
    import { test, expect } from "@playwright/test"

    test("displays hello world", async ({ page }) => {
      await page.goto("/")
      await expect(page.getByRole("heading", { name: "Hello, world" })).toBeVisible()
    })
    ```

19. **Update package.json scripts:**

    ```json
    {
      "scripts": {
        "dev": "vite --open",
        "build": "tsc -b && vite build",
        "lint": "eslint .",
        "preview": "vite preview",
        "test": "vitest",
        "test:pw": "playwright test",
        "test:pw:ui": "playwright test --ui",
        "test:pw:headed": "playwright test --headed",
        "test:all": "pnpm typecheck && pnpm test run && pnpm test:pw --max-failures=1",
        "typecheck": "tsc --noEmit",
        "format": "prettier --write .",
        "ralph": "ralph"
      }
    }
    ```

20. **Install Playwright browsers:**

    ```bash
    pnpm exec playwright install chromium
    ```

21. **Initialize git and push to GitHub:**

    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    gh repo create <project-name> --public --source=. --push
    ```

22. **Verify:**

    ```bash
    pnpm dev
    ```

    Should display "Hello, world" centered on screen with IBM Plex Sans font.

23. **Run tests:**

    ```bash
    pnpm test run
    pnpm test:pw
    ```

    Both should pass.

24. **Open in VS Code:**
    ```bash
    code .
    ```

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

## Common Issues

| Issue                        | Fix                                                                    |
| ---------------------------- | ---------------------------------------------------------------------- |
| Path alias not working       | Ensure both tsconfig.json and tsconfig.app.json have baseUrl and paths |
| Fonts not loading            | Check Google Fonts link in index.html, verify network tab              |
| PWA not installing           | Run `pnpm build && pnpm preview` - PWA only works in production        |
| shadcn init fails            | Ensure @tailwindcss/vite is installed and in vite.config.ts            |
| Vitest toBeInTheDocument     | Ensure vitest-setup.ts imports @testing-library/jest-dom/vitest        |
| Playwright browser not found | Run `pnpm exec playwright install chromium`                            |
| gh repo create fails         | Ensure you're logged in with `gh auth login`                           |

## Tailwind v4 Notes

- No `tailwind.config.js` needed - configuration is in CSS via `@theme`
- Use `@import "tailwindcss"` instead of `@tailwind` directives
- shadcn/ui automatically configures Tailwind v4 CSS variables

## After Scaffolding

Once the project is verified working, ask the user if they want to deploy it:

> "Project scaffolded successfully. Would you like me to deploy it to `<project-name>.herbcaudill.com`?"

If yes, run `/deploy` (no arguments needed since we're in the project directory).
