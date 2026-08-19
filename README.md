# MIC Risk — Frontend

Role-based dashboard over the MIC Risk API. English and Arabic, full RTL.

Design spec: [`docs/specs/2026-08-18-mic-risk-frontend-design.md`](docs/specs/2026-08-18-mic-risk-frontend-design.md)

## Running it

The API must be running first (default `http://localhost:5166`):

```bash
cd ../MIC.risk-main && dotnet run
```

Then:

```bash
npm install
npm run dev
```

Vite proxies `/api` to the API, so the browser stays on one origin. That removes CORS from the
dev loop and lets the `SameSite=Strict` refresh cookie behave exactly as it does in production.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on `http://localhost:5173` |
| `npm run build` | Type check and production build |
| `npm run typecheck` | Type check only |
| `npm test` | Run the test suite |
| `npm run test:watch` | Tests in watch mode |
| `npm run lint` | oxlint |
| `npm run api:generate` | Regenerate `src/api/schema.d.ts` from `openapi/v1.json` |

## When the API contract changes

```bash
cp ../MIC.risk-main/v1.json openapi/v1.json
npm run api:generate
npm run typecheck
```

The generated file is owned by the generator — never edit it by hand. Custom behaviour lives in
`src/api/client.ts`, `src/api/coerce.ts` and the mappers under `src/domain/`.

## Layout

```
src/
  api/        transport only — client, session, error and number coercion
  domain/     pure models, mappers and scoring rules (no React, no HTTP)
  features/   auth/ and reports/ — hooks plus pages
  components/ ui/ primitives, app/ shared pieces
  i18n/       locales and direction handling
  routes/     router and route guards
```

`api/` knows about HTTP and nothing else. `domain/` is pure functions over plain objects.
`features/*/hooks/` is the only place the two meet; pages receive view models and callbacks.

## Things worth knowing before changing code

**Numbers arrive as `number | string`.** The API document is OpenAPI 3.1 emitted from .NET,
which types every integer and double as a union. Everything crossing into `domain/` goes through
`src/api/coerce.ts`; no component should ever see the union.

**The access token lives in memory only.** Never `localStorage`. A page reload restores the
session by calling `/refresh` against the HttpOnly cookie — see `src/api/session.ts`.

**Refreshes are serialised across tabs** with the Web Locks API. Two tabs refreshing at the same
instant would present the same cookie twice, which the server reads as token theft and answers
by revoking the session everywhere. Do not remove that lock.

**No physical direction utilities.** Use `ms-`/`me-`, `ps-`/`pe-`, `text-start`/`text-end`,
`border-s`/`border-e`. `src/test/rtl-safety.test.ts` fails the build otherwise.

**Risk scoring mirrors the backend.** `src/domain/scoring.ts` and the backend's
`Domain/RiskScoring.cs` define the same rules and must change together. Note that control
effectiveness runs 1 = very strong to 5 = very weak, so residual risk is always **greater than
or equal to** inherent risk — the reverse of the usual convention.
