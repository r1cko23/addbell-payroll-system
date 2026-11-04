# Gotchas

Traps that have already bitten this project. Add an entry whenever an incident teaches something non-obvious. Newest first.

## 1. Long `.in()` filters fail silently in the browser (2026-11-04)

**Symptom:** Uploaded payment cheques stopped showing in the Fund Request Approval inbox for Upper Management. The data was fine: every `payment_check` row and its Storage file were still there.

**Cause:** `components/fund-request/FundRequestInbox.tsx` loads cheques with `.in("fund_request_id", <every loaded request id>)`. supabase-js sends that as a GET query string. Once `fund_requests` reached ~630 rows, the URL was ~24.7 KB. With a logged-in user's JWT in the headers, the request went over the Supabase gateway limit and came back as a plain-text `400 Bad Request`. The effect then cleared the cheque map to `{}` on error, so every cheque disappeared with no message. First failure: 2026-11-03 22:16 UTC (06:16 Manila).

Reproduced: the same URL succeeds with the anon key, fails once ~1.2 KB of extra header is added, and 650 random UUIDs fail outright.

**Rule:**
- Don't build a client-side `.in()` from a list that grows with business data. Batch it (≤100 IDs per request) or move the filter to the server or an RPC.
- On a fetch error, keep the previous state and show an error. Don't reset to empty.
- Other `.in(ids)` calls to watch: `app/api/leave-approval`, `app/api/overtime-approval`, `app/api/employee-portal/{leave,overtime}-requests`. They run server-side on smaller scoped lists today.

**Also noted:** the same inbox effect loaded cheques only for `upper_management`, not `admin`, while upload is allowed for both.

**Fixed:** `loadFundRequestPaymentCheckDocumentsByRequestId` in `lib/fund-request-payment-check.ts` sends 100 IDs per request. The inbox keeps its current cheques and shows a toast if a load fails, and it now loads cheques for `admin` too. Test: `utils/__tests__/fund-request-payment-check-loader.test.ts`.

## 2. Payment cheque upload is two steps and can partly succeed

`/documents/confirm` registers the source row first, then links peer requests. If a peer fails validation after that, the route returns an error while the source row is already saved. If linking fails, the source keeps the cheque and the peers don't (the route returns a `warning`). When cheques are "missing" on some requests in a payee group, check this before anything else.

## 3. `admin` ≠ `upper_management`

`isUpperManagementRole` checks the literal `upper_management`. `admin` is a separate system-owner role. Features meant for both must check both (`normalizeUserRole`).

## 4. Docs from the GP-HRIS fork are stale

Much of `docs/` (and `docs/privacy/`, which names Green Pasture) predates Addbell. When a doc and the code disagree, the code wins.
