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

3. **Install dependencies:**
   ```bash
   pnpm add -D tailwindcss @tailwindcss/vite vite-plugin-pwa prettier prettier-plugin-tailwindcss
   pnpm add lucide-react
   ```

4. **Configure vite.config.ts:**
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

5. **Update tsconfig.json** - add path alias to compilerOptions:
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

6. **Update tsconfig.app.json** - add path alias to compilerOptions:
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

7. **Initialize shadcn/ui** (this sets up index.css with Tailwind v4 syntax):
   ```bash
   pnpm dlx shadcn@latest init -d
   pnpm dlx shadcn@latest add button
   ```

8. **Add IBM Plex fonts to src/index.css** - add to the existing @theme block:
   ```css
   @theme {
     --font-sans: "IBM Plex Sans", system-ui, sans-serif;
     --font-serif: "IBM Plex Serif", Georgia, serif;
     --font-mono: "IBM Plex Mono", monospace;
   }
   ```

9. **Update index.html** - add IBM Plex fonts:
   ```html
   <!doctype html>
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

10. **Replace src/App.tsx:**
    ```tsx
    export default function App() {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <h1 className="text-4xl font-bold">Hello, world</h1>
        </div>
      )
    }
    ```

11. **Update src/main.tsx** (remove App.css import if present):
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

12. **Add .prettierrc:**
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

13. **Clean up Vite boilerplate:**
    ```bash
    rm -f src/App.css src/assets/react.svg public/vite.svg
    ```

14. **Verify:**
    ```bash
    pnpm dev
    ```
    Should display "Hello, world" centered on screen with IBM Plex Sans font.

15. **Open in VS Code:**
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
│   ├── main.tsx
│   └── index.css        # Tailwind v4 + shadcn theme
├── index.html           # IBM Plex fonts loaded
├── vite.config.ts       # Tailwind + PWA + path alias
├── tsconfig.json
├── tsconfig.app.json
├── components.json      # shadcn config
├── .prettierrc
└── package.json
```

## Common Issues

| Issue | Fix |
|-------|-----|
| Path alias not working | Ensure both tsconfig.json and tsconfig.app.json have baseUrl and paths |
| Fonts not loading | Check Google Fonts link in index.html, verify network tab |
| PWA not installing | Run `pnpm build && pnpm preview` - PWA only works in production |
| shadcn init fails | Ensure @tailwindcss/vite is installed and in vite.config.ts |

## Tailwind v4 Notes

- No `tailwind.config.js` needed - configuration is in CSS via `@theme`
- Use `@import "tailwindcss"` instead of `@tailwind` directives
- shadcn/ui automatically configures Tailwind v4 CSS variables

## After Scaffolding

Once the project is verified working, ask the user if they want to deploy it:

> "Project scaffolded successfully. Would you like me to deploy it to `<project-name>.herbcaudill.com`?"

If yes, use the `/deploy` skill:
```
/deploy <project-name>
```
