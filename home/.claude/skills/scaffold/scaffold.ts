#!/usr/bin/env npx tsx

import { execSync } from "child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs"
import { join } from "path"

const PROJECT_DIR = "/Users/herbcaudill/Code/HerbCaudill"

function run(cmd: string, cwd?: string) {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { stdio: "inherit", cwd })
}

function toTitleCase(str: string) {
  return str
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

function main() {
  const projectName = process.argv[2]
  if (!projectName) {
    console.error("Usage: scaffold.ts <project-name>")
    process.exit(1)
  }

  const projectPath = join(PROJECT_DIR, projectName)
  const projectTitle = toTitleCase(projectName)

  if (existsSync(projectPath)) {
    console.error(`Error: ${projectPath} already exists`)
    process.exit(1)
  }

  console.log(`\nScaffolding ${projectName} at ${projectPath}...\n`)

  // 1. Create Vite project
  run(`pnpm create vite ${projectName} --template react-ts`, PROJECT_DIR)
  run("pnpm install", projectPath)

  // 2. Install dependencies
  run(
    "pnpm add -D tailwindcss @tailwindcss/vite vite-plugin-pwa prettier prettier-plugin-tailwindcss vitest @testing-library/react @testing-library/dom @testing-library/jest-dom jsdom @playwright/test @types/node",
    projectPath
  )
  run("pnpm add lucide-react", projectPath)

  // 3. Write vite.config.ts
  writeFileSync(
    join(projectPath, "vite.config.ts"),
    `import { defineConfig } from "vite"
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
        name: "${projectTitle}",
        short_name: "${projectName}",
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
`
  )

  // 4. Update tsconfig.json
  const tsconfigPath = join(projectPath, "tsconfig.json")
  const tsconfig = JSON.parse(readFileSync(tsconfigPath, "utf-8"))
  tsconfig.compilerOptions = {
    ...tsconfig.compilerOptions,
    baseUrl: ".",
    paths: { "@/*": ["./src/*"] },
  }
  writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + "\n")

  // 5. Update tsconfig.app.json
  const tsconfigAppPath = join(projectPath, "tsconfig.app.json")
  const tsconfigApp = JSON.parse(readFileSync(tsconfigAppPath, "utf-8"))
  tsconfigApp.compilerOptions = {
    ...tsconfigApp.compilerOptions,
    baseUrl: ".",
    paths: { "@/*": ["./src/*"] },
  }
  writeFileSync(tsconfigAppPath, JSON.stringify(tsconfigApp, null, 2) + "\n")

  // 6. Initialize shadcn/ui
  run("pnpm dlx shadcn@latest init -d", projectPath)
  run("pnpm dlx shadcn@latest add button", projectPath)

  // 7. Update src/index.css - add IBM Plex fonts to @theme block
  const indexCssPath = join(projectPath, "src/index.css")
  let indexCss = readFileSync(indexCssPath, "utf-8")
  indexCss = indexCss.replace(
    /@theme\s*\{/,
    `@theme {
  --font-sans: "IBM Plex Sans", system-ui, sans-serif;
  --font-serif: "IBM Plex Serif", Georgia, serif;
  --font-mono: "IBM Plex Mono", monospace;`
  )
  writeFileSync(indexCssPath, indexCss)

  // 8. Write index.html
  writeFileSync(
    join(projectPath, "index.html"),
    `<!DOCTYPE html>
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
    <title>${projectTitle}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`
  )

  // 9. Write src/App.tsx
  writeFileSync(
    join(projectPath, "src/App.tsx"),
    `export function App() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <h1 className="text-4xl font-bold">Hello, world</h1>
    </div>
  )
}
`
  )

  // 10. Write src/main.tsx
  writeFileSync(
    join(projectPath, "src/main.tsx"),
    `import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./index.css"
import { App } from "./App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
`
  )

  // 11. Write .prettierrc
  writeFileSync(
    join(projectPath, ".prettierrc"),
    JSON.stringify(
      {
        arrowParens: "avoid",
        bracketSpacing: true,
        endOfLine: "auto",
        semi: false,
        singleQuote: false,
        tabWidth: 2,
        trailingComma: "all",
        useTabs: false,
        experimentalTernaries: true,
        printWidth: 100,
        plugins: ["prettier-plugin-tailwindcss"],
      },
      null,
      2
    ) + "\n"
  )

  // 12. Clean up Vite boilerplate
  const filesToRemove = [
    "src/App.css",
    "src/assets/react.svg",
    "public/vite.svg",
    "README.md",
  ]
  for (const file of filesToRemove) {
    const filePath = join(projectPath, file)
    if (existsSync(filePath)) {
      rmSync(filePath)
    }
  }

  // 13. Write vitest.config.ts
  writeFileSync(
    join(projectPath, "vitest.config.ts"),
    `import { defineConfig } from "vitest/config"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/vitest-setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})
`
  )

  // 14. Write playwright.config.ts
  writeFileSync(
    join(projectPath, "playwright.config.ts"),
    `import { defineConfig, devices } from "@playwright/test"

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
`
  )

  // 15. Write src/vitest-setup.ts
  writeFileSync(
    join(projectPath, "src/vitest-setup.ts"),
    `import "@testing-library/jest-dom/vitest"
`
  )

  // 16. Write src/App.test.tsx
  writeFileSync(
    join(projectPath, "src/App.test.tsx"),
    `import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { App } from "./App"

describe("App", () => {
  it("renders hello world", () => {
    render(<App />)
    expect(screen.getByText("Hello, world")).toBeInTheDocument()
  })
})
`
  )

  // 17. Create e2e directory and write e2e/app.spec.ts
  mkdirSync(join(projectPath, "e2e"), { recursive: true })
  writeFileSync(
    join(projectPath, "e2e/app.spec.ts"),
    `import { test, expect } from "@playwright/test"

test("displays hello world", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Hello, world" })).toBeVisible()
})
`
  )

  // 18. Update package.json scripts
  const packageJsonPath = join(projectPath, "package.json")
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"))
  packageJson.scripts = {
    dev: "vite --open",
    build: "tsc -b && vite build",
    lint: "eslint .",
    preview: "vite preview",
    test: "vitest",
    "test:pw": "playwright test",
    "test:pw:ui": "playwright test --ui",
    "test:pw:headed": "playwright test --headed",
    "test:all": "pnpm typecheck && pnpm test run && pnpm test:pw --max-failures=1",
    typecheck: "tsc --noEmit",
    format: "prettier --write .",
    ralph: "ralph",
  }
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n")

  // 19. Install Playwright browsers
  run("pnpm exec playwright install chromium", projectPath)

  // 20. Format everything
  run("pnpm format", projectPath)

  // 21. Initialize git and push to GitHub
  run("git init", projectPath)
  run("git add .", projectPath)
  run('git commit -m "Initial commit"', projectPath)
  run(`gh repo create ${projectName} --public --source=. --push`, projectPath)

  // 22. Run tests to verify
  console.log("\n--- Running tests ---")
  run("pnpm test run", projectPath)
  run("pnpm test:pw", projectPath)

  console.log(`\n✓ Project ${projectName} scaffolded successfully!`)
  console.log(`  cd ${projectPath}`)
  console.log(`  pnpm dev`)
}

main()
