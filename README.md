# Tyano's Bliksemheld

Een kleine 2D game met Vite en TypeScript. De held schiet bliksemstralen die terugkaatsen tegen muren en dozen. Raak alle zombies op hun hoofd voordat de bliksem op is.

## Development

Vereisten:

- Node.js 18 of hoger
- npm

```bash
npm install
npm run dev
```

Open daarna `http://localhost:5173`.

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

De repository is voorbereid voor GitHub Pages met dezelfde Vite-aanpak als CrystalHarp Sampler:

- `vite.config.ts` gebruikt `base: "/mini-game/"`.
- `.github/workflows/deploy.yml` bouwt met `npm ci` en `npm run build`.
- `public/.nojekyll` voorkomt Jekyll-verwerking.
- `npm run deploy` publiceert handmatig via `gh-pages`.

Als de GitHub-repository anders heet dan `mini-game`, pas dan `homepage` in `package.json` en `base` in `vite.config.ts` aan.

## Structuur

- `index.html`: vaste HTML-shell.
- `src/main.ts`: levels, raycasting, botsingen, tekenlogica en spelstatus.
- `src/style.css`: layout en visuele stijl.
- `public/.nojekyll`: GitHub Pages-instelling.
