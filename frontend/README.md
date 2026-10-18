# DocChat — frontend

React 19 + Vite + Tailwind v4.

```bash
cp .env.example .env
npm install
npm run dev          # http://localhost:5173
```

## Theme

All colours come from `src/index.css`. The components use Tailwind's stock
`slate` / `indigo` / `fuchsia` / `emerald` class names, but those scales are
re-pointed in the `@theme` block to the app's own palette:

| Class name | Becomes | Used for |
|---|---|---|
| `slate-*` | graphite neutrals | text, surfaces, borders |
| `indigo-*` | library teal `#1f5f5b` | primary actions, links, focus |
| `fuchsia-*` / `purple-*` | blue pencil `#3e5c86` | summaries, secondary actions |
| `emerald-*` | olive | ready / success states |

Edit a scale there and every page follows. Fonts (Public Sans for the
interface, Literata for headings and document text) are self-hosted via
`@fontsource`, so nothing loads from Google at runtime.
