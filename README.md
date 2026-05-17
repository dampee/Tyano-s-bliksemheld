# Tyano's Bliksemheld

Een kleine 2D game met Vite en TypeScript. De held schiet bliksemstralen die terugkaatsen tegen muren en dozen. Raak alle zombies op hun hoofd voordat de bliksem op is.

## Spelen

De nieuwste versie staat op GitHub Pages:

https://dampee.github.io/Tyano-s-bliksemheld/

## Development

Vereisten:

- Node.js 18 of hoger
- npm

```bash
npm install
npm run dev
```

Open daarna `http://localhost:5173/Tyano-s-bliksemheld/`.

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

De repository publiceert automatisch naar GitHub Pages wanneer er naar `main` wordt gepusht:

- `vite.config.ts` gebruikt `base: "/Tyano-s-bliksemheld/"`.
- `.github/workflows/deploy.yml` bouwt met `npm ci` en `npm run build`.
- `public/.nojekyll` voorkomt Jekyll-verwerking.
- `npm run deploy` publiceert handmatig via `gh-pages`.

De gepubliceerde site staat op `https://dampee.github.io/Tyano-s-bliksemheld/`.

## Structuur

- `index.html`: vaste HTML-shell.
- `src/main.ts`: levels, raycasting, botsingen, tekenlogica en spelstatus.
- `src/style.css`: layout en visuele stijl.
- `public/.nojekyll`: GitHub Pages-instelling.
