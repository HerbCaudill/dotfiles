#!/usr/bin/env npx tsx

import { execSync } from "child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const PROJECT_DIR = "/Users/herbcaudill/Code/HerbCaudill"
const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = join(__dirname, "templates")

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

function copyTemplate(templatePath: string, destPath: string, vars?: Record<string, string>) {
  let content = readFileSync(join(TEMPLATES_DIR, templatePath), "utf-8")
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      content = content.replaceAll(`{{${key}}}`, value)
    }
  }
  mkdirSync(dirname(destPath), { recursive: true })
  writeFileSync(destPath, content)
}

function main() {
  const projectName = process.argv[2]
  if (!projectName) {
    console.error("Usage: scaffold.ts <project-name>")
    process.exit(1)
  }

  const projectPath = join(PROJECT_DIR, projectName)
  const projectTitle = toTitleCase(projectName)
  const vars = { PROJECT_NAME: projectName, PROJECT_TITLE: projectTitle }

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
  run("pnpm add @tabler/icons-react", projectPath)

  // 3. Copy config files
  copyTemplate("vite.config.ts", join(projectPath, "vite.config.ts"), vars)
  copyTemplate("vitest.config.ts", join(projectPath, "vitest.config.ts"))
  copyTemplate("playwright.config.ts", join(projectPath, "playwright.config.ts"))
  copyTemplate(".prettierrc", join(projectPath, ".prettierrc"))

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

  // 8. Copy source files
  copyTemplate("index.html", join(projectPath, "index.html"), vars)
  copyTemplate("src/App.tsx", join(projectPath, "src/App.tsx"))
  copyTemplate("src/main.tsx", join(projectPath, "src/main.tsx"))
  copyTemplate("src/vitest-setup.ts", join(projectPath, "src/vitest-setup.ts"))
  copyTemplate("src/App.test.tsx", join(projectPath, "src/App.test.tsx"))
  copyTemplate("e2e/app.spec.ts", join(projectPath, "e2e/app.spec.ts"))

  // 9. Clean up Vite boilerplate
  const filesToRemove = ["src/App.css", "src/assets/react.svg", "public/vite.svg", "README.md"]
  for (const file of filesToRemove) {
    const filePath = join(projectPath, file)
    if (existsSync(filePath)) {
      rmSync(filePath)
    }
  }

  // 10. Update package.json scripts
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

  // 11. Install Playwright browsers
  run("pnpm exec playwright install chromium", projectPath)

  // 12. Format everything
  run("pnpm format", projectPath)

  // 13. Initialize git and push to GitHub
  run("git init", projectPath)
  run("git add .", projectPath)
  run('git commit -m "Initial commit"', projectPath)
  run(`gh repo create ${projectName} --public --source=. --push`, projectPath)

  // 14. Run tests to verify
  console.log("\n--- Running tests ---")
  run("pnpm test run", projectPath)
  run("pnpm test:pw", projectPath)

  console.log(`\n✓ Project ${projectName} scaffolded successfully!`)
  console.log(`  cd ${projectPath}`)
  console.log(`  pnpm dev`)
}

main()
