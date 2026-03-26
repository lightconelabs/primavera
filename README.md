
![Primavera logo](assets/primavera-logo.png)

# Primavera

Primavera is an online tool for practicing sight-reading.

![Primavera demo](assets/demo.gif)

## Features

- Randomly generated sight-reading exercises rendered as SVG sheet music
- Configurable key signatures (0–7 sharps or flats)
- Adjustable maximum interval between consecutive notes
- Hover over notes to hear them individually
- Play button to hear the full exercise with note highlighting
- Adjustable tempo and exercise length
- All settings persist in browser localStorage — no login required

## Tech Stack

- **SvelteKit 2** with Svelte 5
- **Cloudflare Workers** via `@sveltejs/adapter-cloudflare`
- **Web Audio API** for synthesized note playback
- **TypeScript** throughout

## Development

```bash
npm install
npm run dev
```

## Build & Deploy

```bash
npm run build
npx wrangler deploy
```
