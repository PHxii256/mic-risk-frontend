# MIC Risk Frontend — Design

**Date:** 2026-08-18
**Status:** Approved, pending implementation plan
**API:** `MIC.risk` v1 — 47 endpoints, ASP.NET Core 10, OpenAPI 3.1

---

## 1. Purpose and scope

A role-based dashboard over the MIC Risk API for two audiences:

- **Employees** (`User` role) — submit risk reports, track their own, consume learning resources.
- **Risk department** (`Admin` role) — triage reports, evaluate as auditor, assign corrective
  actions, manage employees, departments, resources and the risk taxonomy, and read analytics.

Bilingual English/Arabic with full RTL support, from the first commit.

**Slice 1 (this spec's build target):** login, app shell, submit report, my reports, report
detail, status history — plus the complete API/session/domain foundation and its tests.

**Out of scope for slice 1:** analytics, admin triage, resources, employee/department/taxonomy
management. These reuse slice 1's patterns and follow immediately after.

---

## 2. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Sequencing | Vertical slice first | Proves the session, mapper and form layers on real screens before repeating across ~35 more |
| API access | `openapi-typescript` + `openapi-fetch` | Types only, ~2KB runtime; generated React Query hooks would be discarded behind domain hooks anyway |
| Visual register | Uniformly dense and professional | One coherent enterprise-tool language across both roles |
| Test depth | Focused on risky logic | Pure mappers and the session layer; no per-screen component tests yet |
| Localisation | Arabic + English, full RTL, from day one | Retrofitting RTL means auditing every layout |
| Password recovery | Admin-initiated reset | No email infrastructure needed; matches how accounts are already provisioned |
| Charts | shadcn charts (Recharts) + hand-built matrix | Recharts has no real heatmap; a 5×5 grid is better as markup |

---

## 3. Domain model — risk scoring

The scoring rules are defined once on the backend in `Domain/RiskScoring.cs`. The frontend
mirrors them in `src/domain/scoring.ts`. **Change them together.**

An evaluation carries three reporter-supplied 1–5 ratings plus a priority:

| Field | Range | Meaning |
|---|---|---|
| `severity` | 1–5 | Impact if the risk materialises |
| `frequency` | 1–5 | Likelihood of occurrence |
| `controlEffectiveness` | 1–5 | Strength of existing controls — **1 = very strong, 5 = very weak** |
| `priority` | 1–5 | Reporter's priority call |

Two scores are computed by the database and are read-only on the wire, both integers:

```
inherentRisk = severity × frequency                       →  1 … 25
residualRisk = inherentRisk × controlEffectiveness        →  1 … 125
```

Note the direction: because the rating runs 1 = very strong to 5 = very weak, it acts as a
**multiplier on exposure**, not a discount. Strong controls (1) leave residual equal to inherent;
weak controls (5) multiply it fivefold. **Residual is therefore always greater than or equal to
inherent, never less** — the opposite of the usual convention, so label it clearly in the UI.

A control rating of **≥ 4** counts as a weak control.

### Bands

| Band | Score |
|---|---|
| Low | ≤ 5 |
| Moderate | 6 – 10 |
| High | 11 – 15 |
| Critical | > 15 |

The same thresholds apply to both scores, which works cleanly for inherent (1–25) and for
well-controlled risks, where residual equals inherent and so lands in the same band.

> **Open item — residual banding.** These thresholds were agreed for the 1–25 inherent scale.
> Applied unchanged to residual's 1–125 range they saturate: of the 125 possible
> (severity, frequency, control) combinations, **58% land in Critical**, against 16% for inherent.
> A "critical" flag that fires on the majority of risks stops carrying information. Scaling the
> residual thresholds ×5 (25 / 50 / 75) gives 64% Low, 22% Moderate, 8% High, 6% Critical.
> Currently implemented as agreed — unscaled. Changing it is a one-line edit in
> `Domain/RiskScoring.cs` plus the frontend mirror.

### Worked examples (verified against the database)

| severity | frequency | control | inherent | residual |
|---|---|---|---|---|
| 5 | 5 | 1 (very strong) | 25 | 25 |
| 5 | 5 | 3 | 25 | 75 |
| 5 | 5 | 5 (very weak) | 25 | 125 |
| 4 | 3 | 3 | 12 | 36 |
| 2 | 2 | 4 | 4 | 16 |
| 1 | 1 | 5 | 1 | 5 |

## 4. What the API provides

### Authentication

`POST /api/account/login` · `POST /api/account/refresh` · `POST /api/account/logout` ·
`GET /api/account/me` · `POST /api/account/change-password`

Login, refresh and change-password all return the same `AuthResponseDto`:

```jsonc
{
  "accessToken": "eyJ…",
  "accessTokenExpiresAt": "2026-08-18T08:08:19+00:00",
  "roles": ["User"],
  "employee": { "id": 3, "email": "…", "name": "…",
                "department": { "id": 1, "name": "Risk", "branchLocation": "HQ" },
                "active": true, "createdAt": "…" }
}
```

- The refresh token is **never in a response body** — it lives only in `mic_refresh_token`
  (`HttpOnly; Secure; SameSite=Strict; Path=/api/account`). Every request sends `credentials: 'include'`.
- The access token lives **in memory only**. On reload the session is restored by calling
  `/refresh`, never by reading storage.
- Access tokens last 15 minutes; the refresh cookie lasts 60 days and slides on every use.
  Access-token expiry is a silent refresh, not a logout.
- `employee.id` is the value the API expects as `empId` / `uploadedByEmpId` in request bodies.
  Sending a different one returns 403.
- Roles are exactly `Admin` and `User`.
- `change-password` returns **200 with a new `AuthResponseDto`**, not 204. It signs out every
  other device; update the in-memory token from the response.

### Errors — one shape everywhere

Every non-2xx is RFC 9457 `application/problem+json`, verified across the MVC path, `Forbid()`,
the JWT challenge and the exception middleware.

```jsonc
{ "type": "…rfc9110#section-15.5.5", "title": "Not Found", "status": 404,
  "detail": "Employee with ID 99999 was not found.",
  "instance": "/api/employee/99999", "traceId": "00-2527…" }

// validation adds `errors`
{ "errors": { "NewPassword": ["…minimum length of '8'."] },
  "type": "…#section-15.5.1", "title": "One or more validation errors occurred.", "status": 400 }
```

The normaliser needs two branches: with `errors` (field-level) and without (message in `detail`).
`instance` and `traceId` are optional. Surface `detail` to users; log `traceId`, never show it.

### Every number arrives as `number | string`

OpenAPI 3.1 emission from .NET renders every `int32`, `int64` and `double` as
`"type": ["integer","string"]`. Coerce at the boundary; no component sees the union.

### Values typed as bare `string`

- Report status: `Submitted` | `InReview` | `Resolved`.
  Transitions: `Submitted → InReview|Resolved`; `InReview → Submitted|Resolved`; `Resolved → InReview`.
  Same-to-same is a no-op. Anything else returns 400.
- Action status: `Pending` | `Completed`.
- Risk category: `Financial` | `Operational` | `Strategic` | `Insurance`.
- Resource type: DB allows `Video`|`Image`|`File`|`Quiz`|`Link`; upload only produces `Image`|`File`.

### Endpoint shapes that will bite

- `GET /api/risk-report/mine` returns a **plain array**; `GET /api/risk-report` a **paged envelope**.
- `GET /api/risk-report/{id}/history` **is paged**.
- `POST /api/resource-engagement` is an **upsert returning 200**.
- `PATCH /api/employee/{id}/toggle-active` returns **204, no body** — invalidate, don't reconcile.
- `GET /api/risk-subcategory/by-category/{category}` returns **404 when empty**. Treat as empty.
  There is no list-all; use `GET /api/risk-subcategory/categories` for pickers.
- `DELETE /api/risk-subcategory/{id}` is a **soft delete**, no undelete.
- No delete endpoints for employees or departments.
- **No quiz feature** — `ResourceEngagement` has only `viewed` and `surveyCompleted`.
- The whole `RiskAction` controller is Admin-only, including `by-report/{reportId}`.
  Employees deliberately cannot see corrective actions on their own reports.
- Paging: `page` 1, `pageSize` 20, max 100 (clamped server-side).
- Upload: multipart `file`/`name`/`description`, 10 MB, images `.png .jpg .jpeg .gif .webp`,
  files `.pdf .doc .docx .xls .xlsx .ppt .pptx .txt .csv .mp4 .mp3 .av1 .m4a`. The generated body
  type is an `allOf` of three anonymous objects making every field optional — hand-write this call.

---

## 5. Stack

Vite 7 · React 19 · TypeScript 5.9 · Tailwind v4 · shadcn/ui · React Router v7 ·
TanStack Query v5 · React Hook Form · Zod v4 · react-i18next · Recharts (via shadcn charts) ·
Vitest · Testing Library · MSW.

**Fonts:** IBM Plex Sans + IBM Plex Sans Arabic — same designer, matched metrics, so proportions
hold across locales; both have the tabular numerals dense tables need.

---

## 6. Architecture

```
src/
  api/         schema.d.ts (generated) · client.ts · session.ts · errors.ts · coerce.ts
  domain/      scoring.ts · report.ts · employee.ts — pure, tested
  features/    auth/ · reports/ …  each: hooks/ + pages + components
  components/  ui/ (shadcn) · app/ (DataTable, StateBoundary, RiskBadge, PageHeader)
  i18n/        index.ts · locales/{en,ar}/*.json
  routes/      router.tsx · guards
openapi/v1.json
```

The boundary rule: `api/` knows HTTP and nothing else. `domain/` is pure functions over plain
objects, with no imports from `api/` or React. `features/*/hooks/` is the only place the two meet.
Pages receive view models and callbacks — never a query object, never a raw DTO.

Four layers:

1. **Generated types** — `openapi-typescript` emits `schema.d.ts` from `openapi/v1.json`. Never edited.
2. **Client** (`api/client.ts`) — the only module that touches the network. Reads
   `VITE_API_BASE_URL`, attaches the in-memory token, sets `credentials: 'include'`, forwards
   `AbortSignal`, normalises errors into a typed `ApiError`, runs 401 → refresh → replay-once.
3. **Mappers** (`domain/`) — coerce `number | string`, parse `date-time` to `Date`, narrow status
   strings to unions, compute bands. Pure and unit-tested.
4. **Domain hooks** (`features/*/hooks/`) — wrap TanStack Query, own cache keys and invalidation,
   expose `idle | loading | success | error` plus typed commands.

`QueryClient` defaults: retry transient failures only, never 401/403/404/validation; stable
per-feature key factories; narrow invalidation after mutations.

---

## 7. Session layer

```
app start ──► POST /refresh ──► 200: token in memory, render app
                           └──► 401: render login
```

**On a 401 from any request:** queue behind a single shared refresh promise, refresh once, replay
the original request once. If the refresh fails, clear session state and route to login. Never a
retry loop.

**Cross-tab serialisation via the Web Locks API.** Tabs each hold their own in-memory access token
but share one cookie, so two tabs refreshing at once present the same refresh token — which the
backend's reuse detection would read as theft and respond to by revoking the whole family.

```ts
await navigator.locks.request('mic-refresh', async () => {
  if (tokenStillValid()) return;   // another tab already rotated
  await callRefresh();             // rotates the cookie, returns a token for THIS tab
});
```

Tab A rotates; tab B then refreshes against the new cookie and gets its own token. Serialised, so
reuse detection never fires. The backend's 30-second leeway window is the backstop, not the
mechanism. Where Web Locks is unavailable, fall back to the in-tab promise alone.

**Proactive refresh** scheduled 60s before `accessTokenExpiresAt`, so a user mid-form never sees a
request fail and retry.

**On logout:** call `POST /api/account/logout` (revokes server-side), then clear the token and the
query cache. Clearing local state alone leaves a live session on the server.

---

## 8. Localisation and RTL

- `lang` and `dir` on `<html>`, driven by the active locale. Radix `DirectionProvider` wraps the
  tree so menus, popovers and sliders mirror.
- **No physical direction properties.** `ms-`/`me-`/`ps-`/`pe-`, `text-start`/`text-end`,
  `border-s`/`border-e`. Enforced by an ESLint rule so it cannot rot.
- Recharts axes take `reversed` under RTL.
- Every user-facing string goes through `t()`, including error copy.

Three standing decisions:

1. **Western digits (0–9) in both locales** — standard in regional business software and better
   for mixed-language teams scanning tables.
2. **Gregorian dates**, formatted per-locale via `Intl` (Arabic month names and ordering).
3. **Server error text remains English.** ProblemDetails `detail` is English-only. Translate by
   *status code* for common cases; show the server's `detail` only where it carries specific
   information. A fully Arabic error experience needs error codes on the backend — later, not now.

---

## 9. Visual system

Dense and professional, uniformly. Cool-neutral base, ~13px body text, 32px table rows, 1px
borders rather than shadows, restrained motion.

Colour is reserved almost entirely for risk meaning: a four-step band scale (Low → Critical) used
consistently by the risk badge, the 5×5 matrix and the analytics thresholds; distinct hues for
report status; and a muted treatment for everything else. A screen where everything is coloured
communicates nothing.

Light and dark are both supported via CSS custom properties from the outset — cheap with
Tailwind/shadcn, awkward to retrofit.

---

## 10. Slice 1 detail

| Screen | Endpoints |
|---|---|
| Login | `POST /account/login` |
| Session bootstrap | `POST /account/refresh` |
| App shell | `GET /account/me`, `POST /account/logout` |
| Submit report | `GET /risk-subcategory/categories`, `POST /risk-report` |
| My reports | `GET /risk-report/mine` (plain array) |
| Report detail | `GET /risk-report/{id}` |
| Status history | `GET /risk-report/{id}/history` (paged) |

Deliberately exercises: the hardest form in the app, the `empId` 403, the array-vs-paged
mismatch, the 404-means-empty picker, the full session layer, and the scoring maths end to end.

---

## 11. Testing

**Unit (Vitest)** — `number | string` coercion, date mapping, error normalisation across both
ProblemDetails branches, the status-transition guard, risk banding and the residual formula
against the worked examples in §3.

**Integration (MSW)** — concurrent 401s collapsing into exactly one refresh; replay-once;
cross-tab lock serialisation; give-up-and-logout; the 404-means-empty case; abort propagation.

No per-screen component tests and no E2E in slice 1.

---

## 12. Backend changes made for this work

All built and verified against a live SQL Server instance; test databases removed afterwards.

**Sessions** — `RefreshToken` entity with SHA-256-hashed tokens, families and reuse detection;
rotation on every refresh with a 30s multi-tab leeway; access tokens cut from 7 days to 15
minutes; `ClockSkew` 5 min → 30 s; families revoked on logout, password change and deactivation;
`/refresh` re-checks the employee is active. The per-request active-employee check in the JWT
pipeline was kept — it is what makes deactivation take effect on the next request.

**Contract** — login/refresh/change-password return `employeeId`, `roles` and expiry;
`GET /api/account/me` added; all errors are now genuine `application/problem+json` (previously
`{"Message": …}`, with empty bodies on 403 and JWT challenges); CORS gained `.AllowCredentials()`.

**Scoring** — `MeasuresEffectiveness` → `ControlEffectiveness`; `RiskScore` → `InherentRisk`;
new persisted computed `ResidualRisk` (int, `severity × frequency × controlEffectiveness`);
`Priority` bounded 1–5 with a check constraint and a clamp for pre-existing rows; scoring
centralised in `Domain/RiskScoring.cs`. The weak-control test was flipped from `≤ 2` to `≥ 4`
to match the corrected 1 = strong / 5 = weak direction — it had been counting the strongest
controls as the weakest.

**Analytics corrections** — `CriticalResidualRisks` now uses residual risk rather than inherent;
the matrix previously named `residualRiskMatrix` was plotting severity × frequency and is renamed
`inherentRiskMatrix`; a new `residualRiskBands` breakdown shows the effect of controls.

**Password recovery** — `POST /api/employee/{id}/reset-password` (Admin), revoking that
employee's sessions. Required adding `.AddDefaultTokenProviders()` to Identity.

---

## 13. Known gaps, accepted

- `appsettings.json` holds a live connection string and `appsettings.Development.json` a
  hard-coded JWT signing key. Both should move to user-secrets or environment variables. Not
  addressed here; recommended as the next backend task.
- Server error messages are English-only (see §8).
- Residual risk bands saturate at 58% Critical; see the open item in §3.
- Employees cannot see corrective actions on their own reports (decided deliberately).
- No self-service password reset; admin-initiated only (decided deliberately).
