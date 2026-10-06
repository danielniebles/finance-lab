Self-hosted fonts (latin subset, variable weight), so builds never download
from Google Fonts. A failed download used to break the Vercel build with
"Can't resolve '@vercel/turbopack-next/internal/font/google/font'".

Source: Fontsource variable packages v5.3.0 (`@fontsource-variable/sora`,
`@fontsource-variable/dm-sans`, `@fontsource-variable/jetbrains-mono`),
the `*-latin-wght-normal.woff2` files. Licence: SIL OFL 1.1, see OFL.txt.
