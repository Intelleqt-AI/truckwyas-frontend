# TruckWys Frontend

> **New here?** Read the full engineering handover in the backend repo:
> [`truckwys-backend/HANDOVER.md`](../truckwys-backend/HANDOVER.md) — what TruckWys is,
> the flow, the AI, integrations, and go-live config.

The operator-facing web app for **TruckWys** — a finance + data + AI product for South
African road-freight carriers (AI quoting, fast-pay, collections, financial intelligence).

## Stack

React 18 · TypeScript · Vite · TanStack Query · Recharts · dnd-kit. Custom "v5"
architectural design system (CSS variables, dark/light) — **do not** add shadcn/Tailwind
component styling to v5 pages.

## Run

```sh
npm install
cp .env.example .env        # set VITE_API_URL to your backend
npm run dev                 # http://localhost:3701
npm run typecheck           # tsc --noEmit -p tsconfig.app.json (build gate)
npm run build               # production bundle
```

The app expects the TruckWys backend (Django) running and reachable at `VITE_API_URL`.
