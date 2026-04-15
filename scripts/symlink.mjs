#!/usr/bin/env node

import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

import { installDotfiles } from "./symlinkInstaller.mjs"

const dotfilesDir = dirname(dirname(fileURLToPath(import.meta.url)))
const home = process.env.HOME

if (!home) {
  throw new Error("HOME is not set")
}

installDotfiles({ dotfilesDir, home })
