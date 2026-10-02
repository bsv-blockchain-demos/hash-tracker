# BSV Hash Rate Explorer

A React dashboard that estimates BSV hash rate from recent block data returned by WhatsOnChain. It presents interval estimates, a block table and miner distribution information, with a larger historical view loaded progressively.

The initial view requests ten recent blocks. **Get Last 100 Blocks** expands the dataset; it does not turn the application into a live mining monitor.

## Run locally

Use Node.js 22 and npm.

```sh
npm ci
npm run dev -- --host 127.0.0.1
```

Open `http://localhost:8080`, the port configured in [vite.config.ts](vite.config.ts). No wallet, API credential, environment file or application backend is required. The browser needs access to the public WhatsOnChain API.

## Data and calculations

The client uses mainnet block headers and block details. It extracts miner labels from coinbase data where available and groups miner counts by the returned address.

For each pair of available blocks, [hashrate.ts](src/lib/hashrate.ts) calculates:

```text
interval estimate = difficulty * 2^32 / elapsed seconds
```

Difficulty comes from the API, with a compact-target calculation as a fallback. Non-positive time differences are excluded. The displayed average is the arithmetic mean of the remaining interval estimates.

Ten complete, ordered block records provide nine intervals. The larger view can provide up to 99 intervals when all 100 records are available.

## Interpretation limits

Block timestamps are supplied by miners, and short intervals can produce very large estimates. Averaging interval rates is not the same calculation as dividing total estimated work by the full observation period. Treat the display as an exploration of block data rather than a precise measurement of current network capacity.

When intermediate blocks are missing, the current calculation pairs the next available records without compensating for the skipped heights. Progressive results and partial downloads can therefore distort the displayed estimate.

Miner percentages cover records with an extracted miner address, not necessarily every fetched block. Missing or shared coinbase addresses and tags limit attribution.

## Caching and controls

The app caches its summary in local storage for five minutes and maintains a separate block cache. Refresh and cache controls affect the browser's stored view and API retrieval; they do not change blockchain data.

Requests are queued and spaced by the client. API failures and rate limits can interrupt or slow the larger download, and cached results may be older than the chain tip.

## Build and source guide

```sh
npm run build
npm run preview -- --host 127.0.0.1
```

Vite writes static assets to `dist/`. The build script bundles the app without a separate TypeScript checking step. `npm run lint` and `npm run build:dev` are also available; no automated test script is defined.

- [src/App.tsx](src/App.tsx): active dashboard, loading and summary cache.
- [whatsonchain.ts](src/lib/whatsonchain.ts): API requests, block cache and miner-data extraction.
- [hashrate.ts](src/lib/hashrate.ts): interval estimates and miner statistics.
- [src/components/](src/components/): charts, table and status display.
