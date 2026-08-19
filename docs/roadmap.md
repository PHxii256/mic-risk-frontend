# MIC Risk Frontend — Roadmap

Companion to [the design spec](specs/2026-08-18-mic-risk-frontend-design.md). Phases are ordered
by what makes the product usable by a real team, not by API surface area.

**Status:** Phase 1 complete. Phase 1b (auditor evaluation) written, pending an API restart.

---

## Done

**Phase 1 — foundation and the employee loop**
Login · session with silent refresh · app shell · English/Arabic with RTL · submit a report ·
my reports · report detail · status history. Plus the API layer, domain mappers, scoring rules
and 95 tests.

**Phase 1b — auditor evaluation** *(written, unverified)*
Tabbed evaluation card, auditor tab created from a copy of the reporter's values, revisable,
showing who last modified it and when. Needed a new `PUT /api/risk-report/{id}/auditor-evaluation`
because the existing POST refuses a second call.

---

## Phase 2 — Admin triage

The core lifecycle closes here: an employee submits, an auditor evaluates, an admin moves the
report through to resolution. Everything before this is only half a product.

| Screen | Endpoints |
|---|---|
| All reports (admin queue) | `GET /api/risk-report` — paged, status filter |
| Status transition on report detail | `PATCH /api/risk-report/{id}/status` |

**All reports** is the first paged screen in the app, so it establishes the pattern the actions
queue and the employee list will both reuse:

- Page and status filter live in the URL, so a triage view can be linked and survives a reload.
- Both belong in the query key; keep the previous page visible while the next loads.
- `pageSize` clamped to 100 — the server silently clamps above that.
- Columns: description, reporter, department, subcategory, inherent, residual, status, submitted.
  Sorting is client-side only for now; the endpoint has no sort parameter.

**Status transition** is the one genuinely subtle piece:

- Offer only legal targets. `allowedTransitions()` already encodes the server's graph, so the
  control is built from it — anything else returns 400 with nothing the user can act on.
  Notably `Resolved → Submitted` is illegal; only `Resolved → InReview` reopens a report.
- Optimistic, with rollback: snapshot the report, flip the badge, reconcile from the response.
- On success, invalidate the status history for that report — the server writes a history row,
  so a stale history panel would contradict the badge directly above it.
- A same-status change is a no-op server-side; the control should not offer it.

Effort: roughly a day. Reuses the detail page and the existing history panel.

---

## Phase 3 — Account and people

Higher priority than it looks. **Today nobody can create an account** — the only users are the two
I seeded — and **nobody can change their own password**, even though the endpoint exists. Until
this ships, the product cannot be handed to anyone.

| Screen | Endpoints |
|---|---|
| Change my password | `POST /api/account/change-password` |
| Employees list + detail | `GET /api/employee`, `GET /api/employee/{id}` |
| Create employee | `POST /api/employee` |
| Edit employee | `PUT /api/employee/{id}` |
| Activate / deactivate | `PATCH /api/employee/{id}/toggle-active` |
| Reset an employee's password | `POST /api/employee/{id}/reset-password` |
| Departments list, create, edit | `GET/POST/PUT /api/department` |

Things that will bite:

- `change-password` returns **200 with a fresh `AuthResponseDto`**, not 204. Take the new token
  from the response, or the session dies on the next request. It also signs out every other
  device by design — tell the user that.
- `toggle-active` returns **204 with no body**, so an optimistic switch cannot reconcile; it must
  invalidate instead.
- Deactivating an employee revokes their refresh tokens server-side. If an admin deactivates
  themselves, they are logged out on their next request — worth a confirmation step.
- There is **no delete** for employees or departments. Do not build the affordance.
- `GET /api/employee` and `GET /api/department` are `[Authorize]` only, not admin-gated — any
  employee can read them. Mutations are admin-only.

Effort: two to three days. The list-and-form pattern repeats for departments.

---

## Phase 4 — Corrective actions

| Screen | Endpoints |
|---|---|
| Actions on a report | `GET /api/risk-action/by-report/{reportId}` |
| Actions queue | `GET /api/risk-action` — paged |
| Create / edit / delete | `POST`, `PUT /{id}`, `DELETE /{id}` |
| Overdue summary tile | `GET /api/risk-action/summary` |

- The whole controller is **admin-only**, including `by-report`. Employees deliberately cannot
  see actions on their own reports — your decision, recorded in the spec.
- Status is `Pending` | `Completed` only. Setting `Completed` stamps `completedAt` server-side.
- `summary` gives overdue and due-this-week counts; it belongs on the admin dashboard as much as
  on this screen.
- Assignee is any employee id, so this screen depends on Phase 3's employee list.

Effort: two days.

---

## Phase 5 — Learning resources

| Screen | Endpoints |
|---|---|
| Resource library (all users) | `GET /api/resource`, `GET /api/resource/{id}` |
| Mark viewed / survey done | `POST /api/resource-engagement` (upsert, 200), `GET /mine` |
| Manage resources (admin) | `POST`, `PATCH /{id}`, `DELETE /{id}` |
| Upload a file (admin) | `POST /api/resource/upload` |
| Engagement stats (admin) | `GET /api/resource-engagement/stats`, `/by-department` |

- **There is no quiz engine.** Engagement is two booleans, `viewed` and `surveyCompleted`. The
  analytics field named `employeesWithQuizCompletion` is computed from `surveyCompleted`.
- The upload call must be **hand-written** against the mutator: the generated body type is an
  `allOf` of three anonymous objects, which makes every field optional. Multipart fields are
  `file`, `name`, `description`; limit 10 MB; extension allowlist is in the spec. Never set a
  manual multipart content type.
- Engagement upsert returns 200 and is safely optimistic — it is a toggle the user can reverse.

Effort: two to three days, most of it the upload.

---

## Phase 6 — Analytics dashboard

`GET /api/analytics/dashboard` (optional `from` / `to`) and `GET /api/analytics/employees-by-department`.

- KPI tiles: risk awareness %, risks this week/month, average resolution time, early-warning
  counts (critical residual risks, weak controls, pending review), outstanding actions.
- Charts via shadcn/Recharts: risks by department, by location, subcategory distribution,
  department maturity.
- The **5×5 inherent risk matrix** is a hand-built CSS grid using the band colour scale — Recharts
  has no real heatmap, and 25 cells are clearer as markup.
- **Residual risk bands** render as a simple four-bar breakdown.
- Recharts axes need `reversed` under RTL.

**Resolve the residual banding question before building this.** With the current thresholds, 58%
of the possible score space lands in Critical, so the early-warning tile will read Critical for
most reports and stop meaning anything. See the open item in the spec.

Effort: three days, plus whatever the banding decision costs.

---

## Phase 7 — Risk taxonomy

`GET /api/risk-subcategory/categories`, `GET /{id}`, `POST`, `PUT /{id}`, `DELETE /{id}`,
`GET /by-category/{category}`.

- Delete is a **soft delete** (`Active = false`) with no undelete endpoint. Label it as such, or
  ask for an endpoint to restore.
- `by-category/{category}` returns **404 when a category is empty** — treat as empty, not an error.
- There is no list-all endpoint; `categories` returns the grouped tree.
- Category is constrained to `Financial` | `Operational` | `Strategic` | `Insurance` by a database
  check constraint, so it is a fixed picker, not free text.

Effort: one to two days.

---

## Suggested order

```
Phase 2  Admin triage          ← next
Phase 3  Account and people    ← unblocks real users
Phase 4  Corrective actions
Phase 5  Learning resources
Phase 6  Analytics             ← needs the banding decision
Phase 7  Risk taxonomy
```

Phases 2 and 3 are the ones that turn this from a demo into something a team can use. Everything
after is additive.

---

## Decisions still open

1. **Residual risk banding.** Current thresholds put 58% of the score space in Critical. Blocks
   Phase 6 from being meaningful.
2. **Should `Resolved` require an auditor evaluation first?** The backend does not enforce it, so
   a report can be resolved with only the reporter's own assessment. Policy question.
3. **`resolvedAt` is not in `RiskReportResponseDto`.** The column exists and analytics uses it,
   but the UI cannot show a resolution date without adding it to the DTO.
4. **Priority defaults to 1 on employee submissions**, which renders to admins as "Very low" —
   indistinguishable from a deliberate assessment. Cleanest fix is a nullable priority on the
   create DTO plus a "Not set" state.
5. **Auditor revisions overwrite.** The row is updated in place, so there is no record of what a
   previous auditor assessed. A history table would fix it, like status changes already have.
