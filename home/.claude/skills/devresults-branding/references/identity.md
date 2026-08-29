# DevResults identity reference

## Scope and status

This reference covers the planned DevResults identity in the upstream `Identity 2025` folder. It inventories the approved DevResults logo forms, palette, and type families. CivResults is a related planned product with its own logo and palette, but it is intentionally out of scope here.

Use this identity for new internal work and drafts. Confirm before using it publicly. Use the legacy identity only when the user explicitly asks for current, legacy, or production branding.

## Source of truth

- Identity guide: `/Users/herbcaudill/Library/CloudStorage/GoogleDrive-herb@devresults.com/Shared drives/Graphics/Logo/Identity 2025/DevResults + CivResults identity.pdf`
- Application study: `/Users/herbcaudill/Library/CloudStorage/GoogleDrive-herb@devresults.com/Shared drives/Graphics/Logo/Identity 2025/DevResults Application.pdf`
- Upstream logos: `/Users/herbcaudill/Library/CloudStorage/GoogleDrive-herb@devresults.com/Shared drives/Graphics/Logo/Identity 2025/logos/`

The local files under `../assets/logos/` are copies of the upstream DevResults exports dated May 21, 2025. Treat Google Drive as upstream when checking for later revisions.

## Logo inventory

All supplied PNGs have transparent backgrounds. The full-color combination marks use orange and tan in the symbol and near-black `#231f20` in the wordmark. The `mono` files contain white artwork with opacity variations.

| Form | Full-color SVG | White SVG | PNG fallbacks | Inferred selection guidance |
| --- | --- | --- | --- | --- |
| Symbol only | `../assets/logos/dev.svg` – viewBox 169.05 × 169.07 | `../assets/logos/dev.mono.svg` | `dev.png`, `dev.mono.png` – 339 × 340 px | Use where the DevResults name is already clear or space is very constrained. |
| Horizontal combination | `../assets/logos/dev.h.svg` – viewBox 641.94 × 141.19 | `../assets/logos/dev.h.mono.svg` | `dev.h.png` – 1285 × 284 px; `dev.h.mono.png` – 1284 × 282 px | Default for wide, shallow spaces such as headers and footers. |
| Stacked combination | `../assets/logos/dev.v.svg` – viewBox 472.25 × 319.19 | `../assets/logos/dev.v.mono.svg` | `dev.v.png`, `dev.v.mono.png` – 945 × 640 px | Use where a centered, compact block fits better than a wide logo. |

The wordmark is converted to vector outlines in the supplied SVGs. Do not try to reproduce it by typing “DevResults” in an IBM Plex font.

The identity guide includes construction grids for the combination marks, but it does not state clear-space or minimum-size rules. Use the exported artwork as-is rather than deriving new geometry from the grid.

## Color palette

| Name | Hex | Typical appearance in the identity examples |
| --- | --- | --- |
| Orange | `#b36d1e` | Primary logo color and warm accent |
| Tan | `#ddccbe` | Pale logo tone and light warm field |
| Seagrass | `#007b66` | Deep green field and strong accent |
| Khaki | `#b0a092` | Neutral field shared with the broader identity family |
| Teal | `#00b399` | Bright green-blue field and accent |
| Brown | `#534539` | Dark warm neutral field |

The near-black wordmark color `#231f20` appears in the logo exports but is not listed as one of the six palette swatches in the guide.

## Typography

The identity guide shows four IBM Plex families. It displays weights Thin, Extra Light, Light, Regular, Text, Medium, Semibold, and Bold. It also shows italic variants for IBM Plex Serif and IBM Plex Mono.

| Family | Variants shown |
| --- | --- |
| IBM Plex Serif | Upright and italic |
| IBM Plex Mono | Upright and italic |
| IBM Plex Sans | Upright |
| IBM Plex Sans Condensed | Upright |

The guide demonstrates these families in brand applications but does not assign a strict role to each family. Do not invent a required heading, body, caption, or interface hierarchy unless the user provides one.
