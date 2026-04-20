import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    include: ["scripts/**/tests/*.test.ts", "home/**/tests/*.test.ts"],
  },
})
