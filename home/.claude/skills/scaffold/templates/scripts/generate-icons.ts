import sharp from "sharp"

/** Raster sizes derived from the app-specific, maskable-safe master SVG. */
const icons = [
  { path: "public/apple-touch-icon.png", size: 180 },
  { path: "public/pwa-192x192.png", size: 192 },
  { path: "public/pwa-512x512.png", size: 512 },
  { path: "public/pwa-maskable-512x512.png", size: 512 },
]

for (const icon of icons)
  await sharp("public/icon.svg").resize(icon.size, icon.size).png().toFile(icon.path)
