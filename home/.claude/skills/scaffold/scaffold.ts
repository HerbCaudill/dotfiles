#!/usr/bin/env npx tsx

import { execSync } from "child_process"
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs"
import { dirname, join, resolve } from "path"
import { fileURLToPath } from "url"

const PROJECT_DIR = "/Users/herbcaudill/Code/HerbCaudill"
const __dirname = dirname(fileURLToPath(import.meta.url))
const TEMPLATES_DIR = join(__dirname, "templates")

/** Run a scaffold step with visible output. */
function run(
  /** Shell command for the step. */
  cmd: string,
  /** Directory in which the command runs. */
  cwd?: string,
) {
  console.log(`\n$ ${cmd}`)
  execSync(cmd, { stdio: "inherit", cwd })
}

/** Derive an initial display name from the project slug. */
function toTitleCase(
  /** Hyphen-separated project name. */
  str: string,
) {
  return str
    .split("-")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ")
}

/** Render a text template with project-specific substitutions. */
function copyTemplate(
  /** Source path relative to the template directory. */
  templatePath: string,
  /** Destination path in the new project. */
  destPath: string,
  /** Text substitutions for project-specific templates. */
  vars?: Record<string, string>,
) {
  mkdirSync(dirname(destPath), { recursive: true })
  let content = readFileSync(join(TEMPLATES_DIR, templatePath), "utf-8")
  if (vars) {
    for (const [key, value] of Object.entries(vars)) {
      content = content.replaceAll(`{{${key}}}`, value)
    }
  }
  writeFileSync(destPath, content)
}

/** Read Vite's commented JSON configuration. */
function parseJsonWithComments(
  /** Configuration source. */
  content: string,
): unknown {
  // Strip single-line comments (// ...) and multi-line comments (/* ... */)
  const stripped = content
    .replace(/\/\*[\s\S]*?\*\//g, "") // multi-line comments
    .replace(/\/\/.*$/gm, "") // single-line comments
  return JSON.parse(stripped)
}

/** Create, verify, and publish the initial app. */
function main() {
  const projectName = process.argv[2]
  const iconFlag = process.argv.indexOf("--icon")
  const iconPath = iconFlag > 2 ? process.argv[iconFlag + 1] : undefined
  if (!projectName || !iconPath) {
    console.error("Usage: scaffold.ts <project-name> --icon <app-specific.svg>")
    process.exit(1)
  }
  if (!iconPath.endsWith(".svg") || !existsSync(resolve(iconPath))) {
    console.error("Error: --icon must name an existing app-specific SVG file")
    process.exit(1)
  }
  const icon = readFileSync(resolve(iconPath), "utf-8")

  const projectPath = join(PROJECT_DIR, projectName)
  const projectTitle = toTitleCase(projectName)
  const vars = { PROJECT_NAME: projectName, PROJECT_TITLE: projectTitle }

  if (existsSync(projectPath)) {
    console.error(`Error: ${projectPath} already exists`)
    process.exit(1)
  }

  console.log(`\nScaffolding ${projectName} at ${projectPath}...\n`)

  // Create Vite project
  run(`pnpm create vite ${projectName} --template react-ts`, PROJECT_DIR)
  run("pnpm install", projectPath)

  // Install dependencies
  run(
    "pnpm add -D tailwindcss @tailwindcss/vite vite-plugin-pwa@^1.3.0 sharp tsx oxfmt vitest @testing-library/react @testing-library/dom @testing-library/jest-dom jsdom @playwright/test @types/node",
    projectPath,
  )
  run("pnpm add @tabler/icons-react workbox-window", projectPath)

  // Copy config files
  copyTemplate("vite.config.ts", join(projectPath, "vite.config.ts"), vars)
  copyTemplate("vitest.config.ts", join(projectPath, "vitest.config.ts"))
  copyTemplate("playwright.config.ts", join(projectPath, "playwright.config.ts"))
  copyTemplate("playwright.pwa.config.ts", join(projectPath, "playwright.pwa.config.ts"))
  copyTemplate(".oxfmtrc.json", join(projectPath, ".oxfmtrc.json"))

  // Update tsconfig.json
  const tsconfigPath = join(projectPath, "tsconfig.json")
  const tsconfig = parseJsonWithComments(readFileSync(tsconfigPath, "utf-8")) as {
    compilerOptions?: Record<string, unknown>
  }
  tsconfig.compilerOptions = {
    ...tsconfig.compilerOptions,
    paths: { "@/*": ["./src/*"] },
  }
  writeFileSync(tsconfigPath, JSON.stringify(tsconfig, null, 2) + "\n")

  // Update tsconfig.app.json
  const tsconfigAppPath = join(projectPath, "tsconfig.app.json")
  const tsconfigApp = parseJsonWithComments(readFileSync(tsconfigAppPath, "utf-8")) as {
    compilerOptions?: Record<string, unknown>
  }
  tsconfigApp.compilerOptions = {
    ...tsconfigApp.compilerOptions,
    paths: { "@/*": ["./src/*"] },
  }
  writeFileSync(tsconfigAppPath, JSON.stringify(tsconfigApp, null, 2) + "\n")

  // Set up Tailwind CSS v4 in index.css before shadcn init
  const indexCssPath = join(projectPath, "src/index.css")
  writeFileSync(indexCssPath, '@import "tailwindcss";\n')

  // Initialize shadcn/ui
  run("pnpm dlx shadcn@latest init -d", projectPath)
  run("pnpm dlx shadcn@latest add button", projectPath)

  // Configure shadcn to use Tabler icons
  const componentsJsonPath = join(projectPath, "components.json")
  const componentsJson = JSON.parse(readFileSync(componentsJsonPath, "utf-8"))
  componentsJson.iconLibrary = "tabler"
  writeFileSync(componentsJsonPath, JSON.stringify(componentsJson, null, 2) + "\n")

  // Update src/index.css - add IBM Plex fonts to @theme block
  let indexCss = readFileSync(indexCssPath, "utf-8")
  indexCss = indexCss.replace(/--font-(?:sans|serif|mono):[^;]+;/g, "")
  indexCss = indexCss.replace(
    /(@theme(?:\s+inline)?\s*\{)/,
    `$1
  --font-sans: "IBM Plex Sans", system-ui, sans-serif;
  --font-serif: "IBM Plex Serif", Georgia, serif;
  --font-mono: "IBM Plex Mono", monospace;`,
  )
  writeFileSync(indexCssPath, indexCss)

  // Copy source files
  copyTemplate("index.html", join(projectPath, "index.html"), vars)
  copyTemplate("src/App.tsx", join(projectPath, "src/App.tsx"), vars)
  copyTemplate("src/main.tsx", join(projectPath, "src/main.tsx"))
  copyTemplate("src/mobile.css", join(projectPath, "src/mobile.css"))
  copyTemplate("src/pwa.d.ts", join(projectPath, "src/pwa.d.ts"))
  copyTemplate("src/lib/preventPageZoom.ts", join(projectPath, "src/lib/preventPageZoom.ts"))
  copyTemplate(
    "src/lib/tests/preventPageZoom.test.tsx",
    join(projectPath, "src/lib/tests/preventPageZoom.test.tsx"),
  )
  copyTemplate(
    "src/components/UpdateNotice.tsx",
    join(projectPath, "src/components/UpdateNotice.tsx"),
  )
  copyTemplate(
    "src/components/tests/UpdateNotice.test.tsx",
    join(projectPath, "src/components/tests/UpdateNotice.test.tsx"),
  )
  mkdirSync(join(projectPath, "public"), { recursive: true })
  writeFileSync(join(projectPath, "public/icon.svg"), icon)
  copyTemplate("scripts/generate-icons.ts", join(projectPath, "scripts/generate-icons.ts"))
  run("pnpm exec tsx scripts/generate-icons.ts", projectPath)
  copyTemplate("src/vitest-setup.ts", join(projectPath, "src/vitest-setup.ts"))
  copyTemplate("src/App.test.tsx", join(projectPath, "src/App.test.tsx"))
  copyTemplate("e2e/app.spec.ts", join(projectPath, "e2e/app.spec.ts"))
  copyTemplate("e2e/pwa/update.spec.ts", join(projectPath, "e2e/pwa/update.spec.ts"))

  // Clean up Vite boilerplate
  const filesToRemove = [
    "src/App.css",
    "src/assets/react.svg",
    "public/vite.svg",
    "README.md",
    "eslint.config.js",
  ]
  for (const file of filesToRemove) {
    const filePath = join(projectPath, file)
    if (existsSync(filePath)) {
      rmSync(filePath)
    }
  }

  // Update package.json - remove ESLint dependencies and update scripts
  const packageJsonPath = join(projectPath, "package.json")
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"))

  // Remove ESLint-related dependencies
  const eslintPackages = ["eslint", "@eslint/js", "globals", "typescript-eslint"]
  const eslintPrefixes = ["eslint-plugin-", "eslint-config-"]
  if (packageJson.devDependencies) {
    for (const dep of Object.keys(packageJson.devDependencies)) {
      if (eslintPackages.includes(dep) || eslintPrefixes.some(prefix => dep.startsWith(prefix))) {
        delete packageJson.devDependencies[dep]
      }
    }
  }

  packageJson.scripts = {
    dev: "vite --open",
    build: "tsc -b && vite build",
    preview: "vite preview",
    test: "vitest",
    "test:pw": "playwright test",
    "test:pw:ui": "playwright test --ui",
    "test:pw:headed": "playwright test --headed",
    "test:pw:pwa": "playwright test --config playwright.pwa.config.ts",
    "test:all":
      "pnpm typecheck && pnpm test run && pnpm test:pw --max-failures=1 && pnpm test:pw:pwa",
    typecheck: "tsc -b --noEmit",
    format: "oxfmt .",
    "icons:generate": "tsx scripts/generate-icons.ts",
  }
  writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + "\n")

  // Sync dependencies after removing ESLint packages
  run("pnpm install", projectPath)

  // Update .gitignore
  const gitignorePath = join(projectPath, ".gitignore")
  let gitignore = readFileSync(gitignorePath, "utf-8")
  gitignore += "\n# Logs\n**/*.log\n\n# Test output\ntest-results\nplaywright-report\n"
  writeFileSync(gitignorePath, gitignore)

  // Install Playwright browsers
  run("pnpm exec playwright install chromium webkit", projectPath)

  // Format everything
  run("pnpm format", projectPath)

  // Verify the app before publishing its initial commit.
  run("pnpm test:all", projectPath)
  run("pnpm build", projectPath)

  // Initialize git and push to GitHub
  run("git init", projectPath)
  run("git add .", projectPath)
  run(
    'git commit -m "Scaffold mobile-ready PWA" -m "Start with install icons, explicit app updates, and an immobile responsive shell."',
    projectPath,
  )
  run(`gh repo create ${projectName} --public --source=. --push`, projectPath)

  // Initialize beads issue tracker
  run("bd init --agents-profile minimal", projectPath)

  // Open in VS Code
  run(`code ${projectPath}`, projectPath)

  console.log(`\n✅ Project ${projectName} scaffolded successfully!`)
}

main()
