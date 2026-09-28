# TruckWys backend API review: surface, contracts and partner readiness

Scope: `truckwys-backend` main @ 45039ee, reviewed on 28 Sep 2026. The review was read-only: I read code, ran GETs against `localhost:8001` as admin@truckwys.co.za, and generated the OpenAPI schema into the scratchpad with the broken views patched in memory only. I made no changes to the repo and did no writes beyond the one authorised login. The 50 issues in `docs/audit/BACKEND-AUDIT-2026-09-23.md` are excluded; they come up only where they change a recommendation.

Scratchpad artefacts:
- `openapi.yaml`: the full generated schema, 261 unique paths and 356 unique operations.
- `gen.log`: 72 schema warnings and 154 errors.
- `paths_v1.txt`: the route list.

---

## Verdict

TruckWys is roughly **two maturity levels short of world class**.

**What is already good:**
- The domain coverage is broad.
- Auth is secure by default (`IsAuthenticated`).
- Per-device sessions exist.
- Datetimes are mostly correct ISO-8601 with an offset.
- Decimal money is stored as `Decimal`.

**Why it is not yet a platform:**
- **There is no contract.**
  - Money arrives in three shapes: decimal strings, floats, and pre-formatted `"R 7,266.67"`.
  - The same KPI ("outstanding", "active vehicles") returns different values from different endpoints.
  - List filters are silently ignored on the three finance collections.
  - The frontend reads the first 20 rows of paginated lists as if they were the whole list.
  - One public-facing KPI card shows **hard-coded fabricated numbers**.
- **The OpenAPI docs are down.** `/api/schema/` and `/api/docs/` return 500 because of a one-line naming collision introduced on 22 Sep.
- **The hot list endpoints cost too much.** They run 60–140 queries per page. Every request also pays about 4 fixed DB round-trips: auth lookup, DB-cache throttle read and write, and an activity-log INSERT.
- **Integrations are ad hoc, not partner-grade.**
  - There are five different API-key schemes, with plaintext keys and no scopes.
  - Webhooks are sent synchronously inside `post_save`, with `time.sleep` retries and no replay protection.
  - There are no idempotency keys, no OAuth, and no documented rate limits.
- **Observability is thin.**
  - Production runs the base `config.settings`, so the Sentry and LOGGING config in `settings_prod.py` is dead code.
  - There are no request IDs and no health endpoint.

**Can a TMS partner integrate today? No.** Not without hand-holding and a support channel.

**What closes most of the gap:** fixing the contract (Phase 1, about 2–3 weeks) makes the product trustworthy. Phase 2 (performance and auth hardening) and Phase 3 (a partner API surface) make it sellable to lenders and TMS vendors.

---

## Findings (ranked)

Severity: **C** = critical (wrong numbers or broken capability in front of users or partners), **H** = high, **M** = medium, **L** = low. Effort: **S** ≤ 1 day, **M** 2–5 days, **L** > 1 week.

### C1 · Fleet Overview shows fabricated KPI values (S)

**Evidence.**
- `core/views.py:1291` falls back to a hard-coded average margin: `... else 7266.67`.
- `:1305`: `... else 6500.00`.
- `:1306`: `... else 12.0`.
- `:1342`: `margin_change = 2.3`, which feeds the banner.
- `:1338`: `uptime_score = 0  # Not stored`.

Live `GET /api/v1/fleet/overview/` returns:
- `"value":"R 7,266.67","raw_value":7266.67,"trend":{"value":11.8,"label":"+11.8% improvement"}`
- `"banner":{"message":"Fleet margin up 2.3% this month ..."}`

11.8% is exactly (7266.67−6500)/6500, so both figures are pure fallbacks. The dev company has **zero** revenue this month (`dashboard/finance` returns `revenue_mtd: 0.0`).

**Why it matters.** A fleet-finance product that shows invented margins on its Overview (`Overview.tsx:47` fetches it) loses lender and customer trust the first time anyone reconciles. This is not in the Sept audit; its "pricing honesty" item covers quotes only.

**Change.**
- Return `null` plus a `data_status: "insufficient_data"` flag.
- Delete the constants.
- Compute the banner from real deltas or omit it.
- Add a test asserting no literal fallbacks.

### C2 · OpenAPI schema and Swagger are broken (S)

**Evidence.** `GET /api/schema/` returns **500**, and `manage.py spectacular` raises:

> AssertionError: Incompatible AutoSchema used on View core.views_import.CustomerImportCommitView

Cause:
- `core/views_import.py:80,85,90,118` declare `schema = CUSTOMER_COLUMNS` / `VEHICLE_COLUMNS`.
- That shadows DRF's `APIView.schema` attribute.
- It was introduced in dd24f24 (2026-09-22, bulk import).
- No test covers schema generation.

**Why it matters.** Partner docs, frontend type generation and contract testing are all dead. It also shows that nothing in CI exercises the schema.

**Change.**
- Rename the attribute to `import_columns`.
- Add a CI test: `call_command('spectacular', '--validate', '--fail-on-warn')`, initially without `--fail-on-warn`.

### C3 · Filters silently ignored on invoices, payments and expenses (S)

**Evidence.**
- The router registers `InvoiceFinanceViewSet`, `PaymentFinanceViewSet` and `ExpenseFinanceViewSet` (`core/urls.py:112-114`; `core/views_finance.py:38,453,…`). None of them sets `filterset_fields`, `search_fields` or `ordering_fields`.
- The properly configured `InvoiceViewSet` and `PaymentViewSet` at `core/views.py:3139-3170` (`filterset_fields=['status','customer','load']`) are **imported but never routed**, so they are dead code.
- Live:
  - `GET /invoices/?status=PAID` returns `count: 34`.
  - `GET /invoices/?status=zzz` also returns `count: 34` (every invoice).
  - `GET /invoices/?created_after=2030-01-01` also returns 34.
- Compare `GET /loads/?status=nonsense`, which returns **400** `{"status":["Select a valid choice..."]}`. The platform is inconsistent even about whether bad filters are errors.

**Product impact.** `InvoiceDetail.tsx:99` fetches `payments/?invoice=${id}` and filters client-side over the first 20 company payments (`:104`). Once a company has more than 20 payments, an invoice's payment history silently loses rows.

**Change.**
- Move the filter config onto the Finance viewsets, then delete the dead viewsets.
- Add a global `FilterSet` policy that returns **400 on unknown query params** for list endpoints. A small `StrictFilterBackend` can do this.

### C4 · Pagination contract mismatch truncates UI data at 20 rows (M)

**Evidence.**
- `PAGE_SIZE: 20` with plain `PageNumberPagination` (`config/settings.py:236-237`), so there is no `page_size_query_param`.
- Only `QuoteViewSet` honours `page_size`, max 100 (`views.py:2522-2528`).
- Live:
  - `GET /vehicles/?page_size=100` returns 20 of 23.
  - `GET /loads/?page_size=100` returns 20 of 28.
- The frontend follows `next` in exactly one place (`QuotesList.tsx:236`). Everywhere else it reads page 1 only:
  - Overview totals from `loads/` and `vehicles/` (`Overview.tsx:43,45,86,93,99-110`).
  - `Invoices.tsx:215-221` outstanding totals.
  - `LoadsList.tsx:284,315` revenue totals.
  - `Insights.tsx:280-321`, which asks for `page_size=…` and gets 20.
  - `FleetHeatmap.tsx:67` (`page_size=200`).
  - Customer and vehicle dropdowns in `CreateInvoice.tsx:24` and `NewQuote.tsx:483`.
- About 80 frontend sites handle both `results` and bare arrays (`x?.results || x`), because the backend returns both:
  - Unpaginated: `vehicle-types`, `auth/sessions/`, every `@action` list (`customers/{id}/loads|invoices`, `vehicles/{id}/logs|loads`, `drivers/{id}/loads|settlements`) and `bookings/pipeline/`.
  - Paginated: everything else.

**Why it matters.** For any fleet with more than 20 vehicles or loads, KPIs and dropdowns are wrong. A customer beyond row 20 cannot be selected on a new invoice.

**Change.** See Standard §5.
- One global pagination class with `page_size` (default 25, max 100) and cursor pagination for large and append-only tables.
- Every list endpoint is paginated, with no bare arrays.
- Totals are computed server-side (aggregate endpoints), never summed client-side over a page.
- Add a frontend `fetchAll`/infinite-query helper for pickers, or better, add `?search=` typeahead endpoints.

### C5 · Money has three wire formats (M)

**Evidence.**
- **Decimal strings** from `DecimalField` serializers:
  - invoices `"total_amount":"23805.00"`
  - loads `"rate":"14997.00"`
  - billing `"amount":"4499.00"`
- **Floats** from hand-built dashboards and serializer method fields:
  - `dashboard/finance` `"revenue_ytd":182052.68`, `"net_margin_percent":14.09203643692584`
  - `capital/eligible` `"amount":13104.25`
  - `vehicles[].revenue_generated: 0.0`, via `float(total)` at `core/serializers.py:225`
  - A single vehicle object mixes `"capacity":"28000.00"` and `"revenue_generated":0.0`.
- **Pre-formatted display strings:** `fleet/overview` `"value":"R 7,266.67"` alongside `raw_value`.
- The frontend breaks exactly where it assumes numbers: `Insights.tsx:600,603,767,984,1153` do `sum + l.total_amount`, which **string-concatenates** (`0 + "1500.00"` gives `"01500.00"`). Other lines in the same file wrap the value in `Number()`.
- The Sept audit #40 (float arithmetic in the route calculator) is the server-side twin of this problem.

**Decision.** Money is a **decimal string in major units with exactly two places**, and every money value carries a currency (Standard §1). Rationale:
- Floats cannot represent cents exactly. Lenders and Xero reconcile to the cent, and JS `number` sums of floats drift.
- Integer minor units (`2380500`) are Stripe's choice, but they push a ÷100 into every screen and break the DRF default.
- Strings are what 80% of the API already emits. Standardise on the majority and make the frontend parse once at the boundary with a `money()` helper and a zod or io-ts schema.
- Presentation strings (`"R 7,266.67"`) never belong in an API.

### H1 · The same KPI has different definitions per endpoint (M)

**Evidence (live, same user, same moment):**

| Metric | Endpoint | Value | Definition |
|---|---|---|---|
| Outstanding | `dashboard/finance` (`views_finance.py:806`) | 499,530.27 | Σ`balance`, status ∈ SENT/VIEWED/PARTIALLY_PAID/OVERDUE |
| Outstanding | `dashboard/kpi` (`views_finance.py:1339`) | 499,530.27 | same |
| Outstanding | `dashboard/overview` (`views.py:3999-4003`) | **444,680.92** | Σ`total_amount` (not balance), status ∈ SENT/OVERDUE |
| Active vehicles | `dashboard/kpi` (`views_finance.py:1357`) | **18** | status ∈ AVAILABLE/IN_USE/ACTIVE |
| Active vehicles | `fleet/overview` (`views.py:1270`) | **9** | status = AVAILABLE |
| Revenue change % (no prior revenue) | `dashboard/finance` | `null` | |
| Revenue change % (no prior revenue) | `dashboard/kpi` | `0.0` | |

**Why it matters.** Overview, Finance and Copilot will disagree on screen. Sept audit #50 (briefing "outstanding") is a fourth definition of the same metric.

**Change.**
- Create one `core/metrics.py` with named, tested metric functions (`outstanding_receivables(company, as_of)`, `active_vehicles(company)`), used by every endpoint and by Copilot.
- Document each metric definition in the OpenAPI description.

### H2 · N+1 queries on every hot list endpoint (M)

None of these querysets uses `select_related` or `prefetch_related`. `CompanyFilterMixin.get_queryset`, `views.py:51-60`, only filters. Queries per page, where N is rows on the page (20 by default):

| Endpoint | Queries | Cause |
|---|---|---|
| `quotes/` | 3 + 4N … 7N (≈83–143; ≈700 at page_size 100) | `customer` (serializers.py:393-397), `created_by` (398), `_converted_load()` runs `loads.first()` **twice per row** (437, 440, 447), then the vehicle/driver/user fallbacks |
| `vehicles/` | 2 + 7N (≈142) | `driver.user` (215-217), `vehicle_type` (177,184), plus 4 aggregate queries per row in `get_revenue_generated` / `get_total_trips` / `get_utilisation_rate` (220-237) |
| `loads/` | 2 + 5N (≈102) | customer, driver, driver.user, vehicle, quote (348-372) |
| `invoices/` | 2 + 3N (≈62) | customer, load, reverse one-to-one `delivery_fee_charge` (494) |
| `bookings/pipeline/` | 16 + N, **unbounded N** | 10 count/aggregate queries (views.py:1882-1885), then every quote with `customer_name` per row |
| `dashboard/customer-health/` | 3 + 7N over all customers | views_finance.py:1171-1223 |
| `dashboard/finance/` | ≈51–53 | monthly (855-870) and weekly (884-899) loops run 2 queries per bucket |

**Fixed per-request tax** on every authenticated call:
1. `UserSession` lookup (`session_auth.py:38`).
2. Throttle read and write on **DatabaseCache**: `settings.py` CACHES, plus `UserRateThrottle` and `AnonRateThrottle`.
3. `UserActivityLog` INSERT for every `/api/` request (`core/middleware/activity_logging.py:44`).

The activity middleware's exclusion list is wrong:
- `ACTIVITY_LOG_EXCLUDED_PREFIXES` (`settings.py:138-142`) lists `/api/v1/notifications/unread-count`, but the route is `unread_count`.
- `/api/v1/vehicles/positions` doesn't exist.
- Only `/api/v1/admin/job-health` actually matches, so the polling it was meant to skip is still logged.

**Change.**
- Add `select_related` / `Prefetch`.
- Replace per-row aggregates with queryset `annotate(Sum/Count(filter=Q()))`.
- Collapse the dashboard loops with `TruncMonth` / `TruncWeek`.
- Move throttling to Redis (it is already a hard dependency for Channels and Celery).
- Make activity logging async (Celery or a buffered bulk insert) or sampled, and fix the exclusion paths.
- Add `django-querycount` / `assertNumQueries` tests for these endpoints.

### H3 · Overview request fan-out vs a 60/min user throttle (M)

**Evidence.**
- The Overview page fires 9 parallel GETs (`Overview.tsx:36-50`), plus a fallback call to `dashboard/insights/` if `dashboard/signals/` fails.
- The shell adds `auth/me`, `auth/security-settings`, two `notifications` calls and `notifications/settings`. That is about 14 HTTP requests on a cold load, plus WebSocket-triggered refetches (`useAutoRefresh`, `:259`).
- `UserRateThrottle` is 60/min per user **across all devices and tabs** (`settings.py:239-245`).
- The frontend has no 429 or `Retry-After` handling (`lib/Api.ts`).
- The purpose-built `dashboard/overview/` exists but is unused, and it has its own definitions (H1).
- Production runs **one** gunicorn/uvicorn worker (`docker-entrypoint.sh:13`); the Procfile says 2.

**Change.**
- Build a single `GET /api/v1/overview` (BFF-style aggregate) that returns every Overview card in one document.
  - Each section includes `as_of` and `data_status`.
  - Cache per company for 30–60 s in Redis, invalidated by the existing domain signals.
- Keep a list-endpoint throttle, but use scoped throttles:
  - `read` 600/min per user.
  - `write` 120/min.
  - `expensive` (PDF, AI, exports) 20/min.
  - `copilot` unchanged.
- Always emit `X-RateLimit-Limit`, `X-RateLimit-Remaining` and `Retry-After`.
- Run workers = 2×vCPU+1.

### H4 · Tokens never expire, are stored plaintext, and sessions grow without bound (M)

**Evidence.**
- `UserSession.key` is a plaintext 40-hex bearer token (`core/models/user_session.py:28`), looked up by equality (`session_auth.py:38`).
- There is no absolute expiry. The idle timeout applies only if the user opted in (`session_auth.py:48-51`, `security_settings.session_timeout`, default off).
- Every login creates a row (`views.py:495`). Nothing prunes or caps them: no task references `UserSession` outside login, logout and admin.
- Live `GET /auth/sessions/` for admin returns **128** sessions, as an unpaginated bare list (`views.py:831-838`).
  - `time` is UTC (`+00:00`) while every other endpoint uses `+02:00`.
  - `location` is actually the IP.
- The frontend keeps the token in `localStorage['access']` (`lib/Api.ts:33`). Any XSS gives a token that never expires.

**Change.**
- Store `sha256(key)` and look up by hash.
- Absolute TTL of 30 days, plus an idle TTL of 7 days for everyone, with a sliding refresh.
- Cap at 10 sessions per user, evicting the oldest.
- A nightly prune job.
- Paginate the list and fix `time`/`location`.
- Medium term: move the web app to an HttpOnly, SameSite=Lax session cookie with CSRF, and keep bearer tokens for mobile and partners.

### H5 · Throttle identity and client IP can be spoofed via `X-Forwarded-For` (S)

**Evidence.**
- `REST_FRAMEWORK` has no `NUM_PROXIES`.
- DRF's `get_ident` (`venv/.../rest_framework/throttling.py:40`) then keys anonymous throttles on the **entire client-supplied XFF string**. The `login` 5/min, `otp_verify` 10/min, `otp_resend` 3/min and `anon` scopes can be bypassed by sending a random `X-Forwarded-For` on each attempt, since nginx appends rather than replaces.
- `core/utils/request_meta.py:10-12` `client_ip()` trusts the **first** XFF entry, which is attacker-controlled. So `UserSession.ip_address`, login alerts, the activity log and `IntegrationAPIKey.allowed_ips` checks (`views_risk_score_api.py:47,66-68`) are all forgeable.

**Change.**
- Set `NUM_PROXIES = 1` (nginx), or 2 behind a CDN.
- Have `client_ip()` take the right-most untrusted hop.
- Add a test.

### H6 · Outbound webhooks run synchronously, pre-commit, and without replay protection (M)

**Evidence.**
- `core/signals.py:66-78` `post_save`, via `dispatch_webhook` (`core/services/webhook_dispatcher.py:22`), calls `WebhookDeliveryService.deliver_to_all`.
- That does `requests.post(timeout=10)` with `time.sleep(1, 5)` retries (`webhook_delivery.py:16-17,61-92`) **inside the request that saved the Load or Invoice, before the transaction commits**.
- One slow partner endpoint adds up to about 36 s per subscription to a user's save. A rolled-back save still emits `load.created`.
- There are two parallel systems with different contracts:
  - `WebhookSubscription`, with `X-Webhook-Signature`.
  - Legacy `Webhook`, with `X-Truckwys-Signature` (`webhook_dispatcher.py:43-55`), routed at `webhooks/` vs `partners/webhooks/`.
- The signature covers the body only: no timestamp, no event id, so replays are possible.
- The payload is the internal `LoadSerializer(instance).data`: unversioned, and it leaks internal fields.
- Filtering and delivery errors are reported with `print()` (`webhook_dispatcher.py:25`).

**Change.** Adopt a single outbox:
- `transaction.on_commit`, then write a `WebhookEvent` row with `id` and `type`.
- A Celery delivery task with exponential backoff over about 24 h.
- A header in the form `TruckWys-Signature: t=<ts>,v1=<hmac(ts.body)>`.
- A versioned, documented event schema, a delivery log, and a replay endpoint.
- Retire the legacy `Webhook` model.

### H7 · Partner auth is five incompatible API-key schemes (L)

**Evidence.**

| Scheme | Header | Backing store | Location |
|---|---|---|---|
| WebhookSubscription key | `X-API-Key` | DB, plaintext | `core/auth/api_key_auth.py:37-50` |
| IntegrationAPIKey | `X-API-Key` | DB, plaintext, `allowed_ips` | `views_risk_score_api.py:53-73` |
| Lender keys | `X-API-Key` | **env var** `LENDER_API_KEYS` | `views_lender.py:50` |
| Partner key | `X-Partner-API-Key` | | `views_partner.py:40,83` |
| CtrlFleet / fleet webhooks | `X-CtrlFleet-Key`, `X-Fleet-Signature` | | `integrations/ctrlfleet.py:120`, `views_fleet.py:286` |

- None of them has scopes.
- Keys are stored in plaintext.
- `IntegrationAPIKeyViewSet` is routed twice (`integrations/api-keys` and `integration-keys`, `urls.py:120-121`).
- None has an OpenAPI security scheme (`gen.log`: "could not resolve authenticator APIKeyAuthentication").

**Change.**
- One `ApiKey` model:
  - Prefix plus hashed secret (`tw_live_xxx`).
  - Company-owned.
  - Scopes such as `loads:read`, `invoices:write`, `capital:read`.
  - Test and live modes.
  - `last_used_at`.
- Keys are sent as `Authorization: Bearer`.
- Later, OAuth 2 client-credentials for lenders.
- A single `APIKeyAuthentication` class with a spectacular extension.

### H8 · No idempotency on writes (M)

**Evidence.**
- Idempotency exists only ad hoc: advances (`views_capital.py:220,258`) and fleet-trip import dedupe (`views_integrations.py:1233`).
- Invoice create, payment create, quote-to-load conversion, send-reminder (Sept audit #25) and all partner POSTs are unprotected.
- A mobile retry on a flaky SA network can double-record a payment.

**Change.**
- Support an `Idempotency-Key` header on every POST.
- Middleware stores `(key, user/api_key, request_hash) → response` for 24 h.
- A replay with a different body returns 422.
- Start with payments, invoices, quote conversion and all partner endpoints.

### H9 · Observability is mostly unconfigured in production (M)

**Evidence.**
- Every entrypoint uses `config.settings`: `manage.py`, `config/asgi.py:4`, `wsgi.py`, `celery.py`. So `settings_prod.py`, with Sentry (`:159-166`), `LOGGING` (`:108`) and HSTS, and `settings_production.py` are **dead files**.
- `sentry-sdk` is not in `requirements.txt`.
- The base settings have no `LOGGING` dict.
- Gunicorn runs with `--log-level debug` in production (`docker-entrypoint.sh:16`).
- There are no request or correlation IDs anywhere (grep returns nothing).
- There is no `/healthz` or `/readyz`. `GET /api/v1/health/` returns 404, and the compose `web` service has no healthcheck (`docker-compose.prod.yml`); only db and redis do.
- The custom exception handler returns a generic 500 JSON with no error id to quote to support (`core/views.py:27-37`).
- 45 responses echo `str(e)` to clients, for example `views_capital.py:394,429,467,509`.

**Change.**
- Fold the prod settings into env-driven `config/settings.py` and delete the two dead files.
- Add sentry-sdk with Django, Celery and Redis integrations.
- Add JSON logging with `request_id`, `user_id`, `company_id` and `api_key_id`.
- Add request-ID middleware: honour an inbound `X-Request-ID`, echo it, and include it in error bodies.
- Add `/healthz` (process) and `/readyz` (DB, Redis, Celery heartbeat).
- Add Prometheus metrics or OpenTelemetry for latency and query count.

### M1 · Error envelope is inconsistent (M)

**Evidence.** Four hand-rolled shapes plus DRF defaults:

| Shape | Occurrences |
|---|---|
| `{'error': ...}` | 141 |
| `{'detail': ...}` | 48 |
| `{'success': False, 'error': ...}` | 11 |
| `{'message': ...}` | 4 |
| DRF field errors `{"field": ["msg"]}` | |
| Billing `{'error', 'account_suspended': true}` with 402 (`views.py:81-84`) | |

- Non-DRF 404s (e.g. `/api/v1/health/`) return Django's HTML page; with `DEBUG=True` in dev that is 254 KB.
- `?page=99` returns 404 `{"detail":"Invalid page."}`.
- Status codes are mostly correct. The 200-with-error cases are Sept audit #44/#45.
- The frontend copes by guessing `serverMsg` (`lib/Api.ts:73`).

**Change.** Use a Standard §4 error object from one exception handler. Views raise typed exceptions (`BillingSuspended(402)`, `ValidationError`) instead of building `Response({'error'})`. Add JSON `handler404` and `handler500`.

### M2 · Route surface is duplicated and inconsistently named (M)

**Evidence.**
- The whole API is mounted twice, at `/api/` and `/api/v1/` (`config/urls.py:9-10`), which doubles the schema to 522 paths. The frontend uses both: `api/vehicle-types/`, `api/auth/me/` and `/api/integrations/xero/*` alongside `api/v1/...`.
- Duplicates and aliases:
  - `integration-keys` = `integrations/api-keys`.
  - `intelligence/` = `intelligence/recommendations/` = `dashboard/insights/`, all `DashboardInsightsView`.
  - URL name `fleet-trip-sync` is used twice (`urls.py:288,329`).
  - `webhooks/` vs `partners/webhooks/`.
  - `partner/` vs `partners/` prefixes.
  - `lender/` vs `partners/` vs `capital/` for overlapping capital data.
  - `risk/score` (router) vs `risk/underwrite`, `risk/assessment`.
  - `bookings/pipeline/` returns quotes.
  - A `dashboard` router viewset (`CapitalDashboardViewSet`) is interleaved with `dashboard/*` paths.
- Naming mixes 20 snake_case action paths (`invoices/{id}/send_reminder/`, `loads/{id}/update_status/`, `notifications/unread_count/`, `quotes/{id}/convert_to_load/`) with kebab-case everywhere else (`bulk-delete`, `run-dunning`, `risk-profile`).
- The frontend calls a route that doesn't exist: `GET /api/integrations/fleet/import-history/` (`pages/settings/FleetImport.tsx:63`) always 404s.
- About 40 routed endpoints have no frontend, mobile or partner consumer:
  - `dashboard/overview|routes|customer-health`
  - `intelligence/*`
  - `fleet/insights|action`
  - `reports/export`
  - `billing/audit`
  - `trips/{id}/costs`
  - `agent/chat|memory`
  - `quotes/optimize|suggest|win-probability`
  - `risk/*` (7 endpoints)
  - `vehicle-logs`
  - `settlements`
  - `invoices/batch_generate`
- Dead viewsets: `InvoiceViewSet`, `PaymentViewSet`, `ExpenseViewSet` (`views.py:3139-3170`).

**Change.**
- Drop the unversioned `/api/` mount after fixing the three frontend call sites, keeping a 301 for one release.
- Adopt kebab-case for all paths via `@action(url_path='send-reminder')`, keeping snake aliases for one release.
- Publish a route inventory with owners, delete or feature-flag dead endpoints, and consolidate partner surfaces under `/api/v1/partner/…`.

### M3 · Payload hygiene bugs visible in live responses (S)

- `expenses[].vehicle_info` returns the literal string `"<method-wrapper '__str__' of NoneType object at 0x101bfaa68>"` when `vehicle` is null. Cause: `CharField(source='vehicle.__str__')` at `core/serializers.py:511`.
- `payments[].company` is `null` on audit rows (`GET /payments/`, id 10), a data-integrity signal.
- `drivers[].user_details` nests the full `UserSerializer`, including `subscription_status`, `is_superuser` and `cancel_at_period_end`. That is over-exposure and extra queries.
- `quotes/` adds a non-standard `total_amount` key to the pagination envelope (`views.py:2568`).
- Unrounded percentages, e.g. `net_margin_percent: 14.09203643692584`.

**Change.** Add explicit read serializers per resource (list vs detail) and apply the Standard §1–3 rules.

### M4 · OpenAPI quality, once it builds (M)

**Evidence** (from `openapi.yaml` and `gen.log` after patching C2 in memory):
- 154 generator errors and 72 warnings.
- **404 of 712 operations (57%) have no response schema.** Every `APIView` dashboard, `admin/*`, `auth/*` and `dashboard/*` endpoint is `{}`.
- `RouteCalculatorView`, `TripCostView` and `VehicleBulkDeleteView` are "unable to guess serializer".
- Method fields are untyped and default to string. For example, `revenue_generated` is documented as string but emitted as a float.
- No `servers`, no tags strategy, no examples, and no documented error model or rate limits.
- The security schemes list only `tokenAuth` and `cookieAuth`; partner keys are missing.

**Change.**
- Add `@extend_schema` with response serializers for every `APIView`.
- Add `@extend_schema_field` on method fields.
- Add a spectacular auth extension for API keys.
- Use tags per domain.
- Split the partner schema (`/api/v1/partner/schema`) from the internal one.
- Generate the frontend's TypeScript types from the schema (`openapi-typescript`) so contract drift fails the build.

### L1 · CSRF trusted-origin wildcards (S)

`CSRF_TRUSTED_ORIGINS` defaults to `https://*.up.railway.app,https://*.vercel.app` (`settings.py`, around line 365). Anyone can host on those domains. SameSite=Lax mitigates most of the risk, but the default should list exact origins.

### L2 · Date and time are mostly right (S)

- `TIME_ZONE='Africa/Johannesburg'` and `USE_TZ=True`.
- Serializers emit `2026-06-16T03:45:39.481990+02:00`.
- Business dates are `YYYY-MM-DD`.

Exceptions:
- `auth/sessions` returns UTC `+00:00` (`views.py:835`).
- The webhook timestamp is `utcnow()+'Z'`, which is naive (`webhook_dispatcher.py:38`).
- Microseconds are leaked everywhere.

Codify this in Standard §2.

---

## Proposed TruckWys API Standard (v1)

Adopt this as `docs/api/STANDARD.md` and enforce it with schema tests.

**1 · Money**
- Wire format: a JSON **string** with a decimal in major units, exactly 2 dp, `.` separator, no thousands separator, no symbol. Example: `"23805.00"`. Negatives are written `"-150.00"`.
- Every money value is either an object `{"amount":"23805.00","currency":"ZAR"}`, or sits in a resource with a top-level `currency` field. Pick the object form for new and partner endpoints, and resource-level `currency` for existing internal ones.
- Never floats. Never pre-formatted display strings. Formatting belongs to the client (`Intl.NumberFormat('en-ZA',{style:'currency',currency:'ZAR'})`).
- Rates, percentages and ratios: strings with explicit precision (`"14.09"`, `"0.25"`), and field names say the unit (`margin_pct`, `take_rate_pct`).
- Implementation:
  - A shared `MoneyField` / `PercentField` serializer (a `DecimalField` subclass with `coerce_to_string=True`).
  - A `money()` helper for dashboard dicts.
  - A lint rule banning `float(` in `views*`/`serializers*` for money.
  - Frontend: a single `parseMoney()` at the boundary, typed from the generated schema.

**2 · Dates and times**
- Instants: RFC 3339 with offset, rendered in `Africa/Johannesburg` (`2026-09-28T14:18:33+02:00`). Truncate to seconds. Field suffix `_at`.
- Calendar dates such as due, issue and pickup-day: `YYYY-MM-DD`, interpreted in SAST. Field suffix `_date`.
- Ranges: `from` inclusive and `to` inclusive for dates; `[start, end)` for instants. Echo the range only if it was applied (Sept audit #48).
- Accept any offset on input and store UTC.

**3 · Null, zero and missing**
- **Missing key** means the field is not part of this resource version. The schema is the contract; never omit keys conditionally.
- **`null`** means unknown or not applicable (no prior period, no GPS fix, no data).
- **`0` / `"0.00"`** means measured and truly zero.
- Derived metrics with an undefined denominator return `null` plus a `data_status` (`"ok" | "insufficient_data" | "degraded" | "error"`). Never return a fallback constant (C1).
- Empty collections are `[]`, never `null`.

**4 · Errors** (RFC 9457-style, one handler)

```json
{
  "error": {
    "type": "validation_error",        // stable machine code
    "code": "invoice_amount_negative",  // specific code
    "message": "Amount must be greater than zero.",
    "fields": {"amount": ["Must be greater than zero."]},
    "request_id": "req_01J..."
  }
}
```

- Types: `validation_error` (400/422), `authentication_error` (401), `permission_error` (403), `not_found` (404), `conflict` (409), `idempotency_error` (422), `payment_required` (402), `rate_limited` (429), `upstream_error` (502/503), `internal_error` (500).
- No `str(e)` in responses.
- Never 2xx with an error body.
- Unknown query params and invalid filter values return 400.

**5 · Collections and pagination**
- Every list is paginated. The envelope is `{"data":[…], "next_cursor": "...", "has_more": true, "total_count": 34}`. During migration, keep DRF's `{count,next,previous,results}` but make it universal: no bare arrays and no extra envelope keys.
- `?page_size` defaults to 25, max 100. Use cursor pagination (`?cursor=`) for append-heavy tables: loads, invoices, payments, activity, notifications, sessions.
- Filtering uses explicit `FilterSet`s. Common names: `status` (multi, comma-separated), `customer`, `created_at__gte/lte`, `q` for search, `ordering` (whitelisted, 400 otherwise).
- Aggregates (counts, sums, KPIs) come from aggregate endpoints, never from summing a page client-side.

**6 · Resources and naming**
- Versioning: a URL major version (`/api/v1`). Additive changes need no bump. Breaking changes need `/v2` or a dated `TruckWys-Version` header for the partner API.
- Paths are plural, kebab-case nouns. Actions are `POST /invoices/{id}/send-reminder`. Only one path exists per capability.
- IDs: keep integer PKs internally. Expose opaque prefixed public IDs (`inv_…`, `load_…`) on the partner API.
- JSON fields are snake_case.

**7 · Writes**
- Accept an `Idempotency-Key` on every POST, and require it on partner POSTs and payments.
- Use `ETag` / `If-Match` for concurrent edits on quotes and invoices, optional at first.
- 201 plus `Location` on create. 204 on delete.

**8 · Auth, limits and headers**
- Web: session cookie (HttpOnly, SameSite=Lax) with CSRF, or bearer tokens with an absolute TTL.
- Mobile: bearer token with an absolute and idle TTL.
- Partners: scoped API keys or OAuth client-credentials.
- Every response carries `X-Request-ID`, `X-RateLimit-Limit`, `X-RateLimit-Remaining` and, on 429, `Retry-After`.

**9 · Webhooks**
- Event envelope: `{id, type, created_at, api_version, data}`.
- Header `TruckWys-Signature: t=…,v1=…`, with a 5-minute tolerance.
- At-least-once delivery from an on-commit outbox, with backoff over 24 h, a delivery log and replay.

---

## Phased plan

**Phase 0: stop the bleeding (≈3 days, all S)**
1. C2: rename `schema`, and add a schema build test to CI.
2. C1: remove the fabricated Fleet Overview fallbacks and return `null` plus `data_status`.
3. C3: add filter config to the Finance viewsets, delete the dead viewsets, and make `payments/?invoice=` work.
4. H5: set `NUM_PROXIES` and fix `client_ip()`.
5. M3: fix `vehicle_info`, and fix the activity-log exclusion paths.
6. Global `PageNumberPagination` subclass with `page_size_query_param='page_size'`, `max_page_size=100` (unblocks the C4 frontend call sites immediately).
7. H9 quick wins: install and initialise Sentry in `config/settings.py`, add `/healthz` and `/readyz`, and drop `--log-level debug`.

**Phase 1: contract (≈2–3 weeks)**
1. Write and ratify the Standard.
   - Build `MoneyField`, the error handler (with JSON 404/500), request-ID middleware and strict query-param validation.
2. H1: `core/metrics.py` as the single source of KPI definitions, with every dashboard and Copilot migrated to it.
3. C5: convert dashboard and method-field floats to money strings, behind a one-release compatibility shim if needed. The frontend switches to schema-generated types plus `parseMoney()`, which fixes the `Insights.tsx` concatenations.
4. C4: paginate every list, including `@action`s, `auth/sessions` and `bookings/pipeline`. Add frontend infinite-query and typeahead helpers, and remove every client-side total over a page.
5. M4: `@extend_schema` on all APIViews, and generate frontend types in CI.
6. M2: kebab-case aliases, the route inventory, removal of dead endpoints, and removal of the `/api/` mount.

**Phase 2: performance and sessions (≈2 weeks)**
1. H2: fix N+1 on quotes, vehicles, loads, invoices, pipeline, customer-health and finance dashboard, with `assertNumQueries` budgets in tests.
2. H3: the `GET /api/v1/overview` aggregate endpoint with a Redis cache, scoped throttles, rate-limit headers, frontend 429 backoff, and a correct worker count.
3. Move the cache and throttle to Redis. Make activity logging async.
4. H4: hashed tokens, absolute and idle TTL, session cap and prune job, and a plan to move the web app to cookie sessions.

**Phase 3: partner platform (≈4–6 weeks)**
1. H7: one scoped `ApiKey` model with test and live modes. OAuth client-credentials for lenders.
2. H8: the `Idempotency-Key` middleware.
3. H6: a webhook outbox with signed, versioned events, a delivery log and a replay API. Retire the legacy `Webhook` model.
4. `/api/v1/partner/*`: a curated, documented surface with its own OpenAPI, a changelog, a sandbox company, a Postman collection and published rate limits.
5. Observability: OpenTelemetry traces and a per-key usage dashboard (building on `IntegrationAPIKey.usage_count`).

Exit criteria for "world class":
- The schema builds with zero errors.
- 100% of operations have typed responses.
- Every list is paginated and filter-validated.
- One money format.
- KPIs are defined once.
- p95 under 300 ms and under 15 queries on hot endpoints.
- A partner can integrate from the docs alone, with idempotent retries and verifiable webhooks.

---

*No changes were made to `truckwys-backend`. `git status --porcelain` was empty at the end of the review.*
