# ADK Advanced Water Solutions — Business Platform

A custom business management system for Adirondack Advanced Water Solutions (plumbing, water filtration, and pump services), covering customer intake, service call invoicing, payments, an employee time clock with payroll tracking, and a scheduling calendar.

## Stack

- **Frontend:** Vite + React + Tailwind CSS v4
- **Backend:** Vercel serverless functions (`api/`)
- **Database / CMS:** Sanity (separate repo: `adk-studio`)
- **Email:** EmailJS (contact form, invoice emails)
- **PDF generation:** jsPDF (client-side, invoices and customer profiles)

## Local Development

This project **must** run with `npx vercel dev`, not plain `npm run dev` — the `api/` serverless functions are only served through the Vercel CLI. Plain Vite alone won't serve them.

```
npx vercel dev
```

Requires `SANITY_READ_TOKEN` and `SANITY_WRITE_TOKEN` environment variables (set in Vercel's project settings, and in a local `.env.local` for local dev).

## Pages

Each page is a separate Vite build entry (see `vite.config.js`) with its own HTML file and `*-main.jsx` React root. Routing between them is handled by `vercel.json` rewrites (e.g. `/desktop` → `desktop.html`), not client-side routing — there is no react-router.

| URL | Entry | Purpose |
|---|---|---|
| `/` | `index.html` / `App.jsx` | Public marketing site |
| `/invoice` | `invoice.html` / `IntakeWizard.jsx` | Customer intake & profile editing (hidden, PIN-gated) |
| `/desktop` | `desktop.html` / `Desktop.jsx` | Admin hub — customers, properties, invoicing, employees, calendar (hidden, PIN-gated) |
| `/employee` | `employee.html` / `Employee.jsx` | Employee self-service portal — intake, time clock, pay history (hidden, **not** PIN-gated, since each employee has their own PIN) |

`PinGate.jsx` wraps `/invoice` and `/desktop`. `/employee` intentionally skips it — see the note in `employee-main.jsx`.

Two error boundaries exist on purpose: `ErrorBoundary.jsx` (public site, shows a "call us" fallback) and `InternalErrorBoundary.jsx` (the three internal tools, points to Sanity Studio as a fallback instead — since "call us" makes no sense for the person using their own tool).

## Sanity Schemas

Schema files live in the separate `adk-studio` repo, registered in `schemaTypes/index.js`.

- **`customerProfile`** — name, phone(s), `additionalContactFirstName`/`additionalContactLastName` (a second person on the same job — e.g. a spouse — searchable by either name), billing address, dog-on-site, notes, `creditBalance`, one `property` reference.
- **`property`** — the permanent house record (kept independent of the customer, so history survives a change of ownership): address, well/municipal, gate code, shutoff location, notes, and an `equipment` array (pumps, heaters, filters — serial numbers, install dates, warranty, filter-change schedule).
- **`customerInvoice`** — the actual job record. References both `customer` and `property` independently. Line items (catalog or one-off/misc), labor cost, auto-incrementing `invoiceNumber`, `paymentStatus` (computed from a `payments` array — never set by hand), and `jobStatus` (`notStarted` / `ongoing` / `complete`), which is **independent of payment status** and drives both the employee time clock's property picker and the Calendar view.
- **`inventoryItem`** — the parts catalog. `buyPrice`/`sellPrice` (tiered markup: under $80 → 90% markup, $80+ → 35%, editable per item), `category` (Plumbing/Electrical/Heating/Other), `isEquipment` (flags pumps/heaters/etc. for the auto serial-number prompt at Service Call save time).
- **`employee`** — name, contact info, a self-chosen 4-digit PIN, start/leave dates, Michael-only private notes, and a `payments` array (a running ledger — balance owed is always *earned minus paid*, computed on the fly, never stored as a single number).
- **`timeEntry`** — one clock-in/out record. `jobType` (Plumbing $25/hr or Contracting $20/hr default — an employee-entered different rate flags the entry for review), a `breaks` array, `totalHours`/`totalPay` (computed at clock-out), `editedByMichael` (an unread-notification flag, cleared when the employee views it).
- **`comment`** — customer testimonials, with a pending/approved/archived review workflow.
- **`accessPin`** — the shared PIN gating `/invoice` and `/desktop`.
- **`supplierPurchase`**, **`project`** — supporting types (purchase tracking, public site gallery images).

## API (`api/`)

Kept to a small number of **consolidated** files rather than one-file-per-action, specifically to stay under Vercel's Hobby-plan 12-function limit (hit this limit once already; this is why the endpoints below each handle several related actions via `?action=` or method + query params, instead of being split further).

- **`customers.js`** — GET (list / `?id=` / `?propertyId=` / `?search=`), POST (create), PATCH (update). Name search matches both the primary name and the additional contact fields.
- **`properties.js`** — GET (list / `?id=` / `?activeOnly=true`, which only returns properties with a currently Ongoing invoice — used by the employee time clock's property picker), POST (create), PATCH (`action: update / addEquipment / updateEquipment / deleteEquipment`).
- **`invoices.js`** — GET (`?id=` / `?customerId=` / `?propertyId=` / `?calendarMonth=YYYY-MM` / unfiltered list, which hides `complete` jobs to stay focused on active work), POST (create — assigns the next sequential invoice number, defaults to `jobStatus: notStarted` unless `startNow: true`), PATCH (`action: update / payment / credit / setJobStatus`).
- **`inventory.js`** — GET only.
- **`timeclock.js`** — the whole employee-portal backend in one file: employee intake, PIN verification (checked server-side on every sensitive action, never trusted from the client), clock in/out, break in/out, the employee's own history/balance, and Michael's admin actions (`adminEditEntry`, `adminRecordPayment`, roster, per-employee entries).
- **`submit-comment.js`**, **`verify-pin.js`** — public site support (testimonials, the shared PIN gate).

## Key Design Decisions

- **Property/customer split**: a property is the house, a customer is the person. Both are referenced independently on every invoice, so a property's full service history survives a change of ownership, and a customer's history survives a move.
- **Payment status is never set by hand** — always computed from the `payments` array on save. Same for `totalAmount`.
- **Job status is independent of payment status** — a job can be fully paid but still Ongoing (work not physically done), or Complete but still owed (pay-later customers). `jobStatus: ongoing` is what makes a property "active" for the employee time clock; `serviceDate` is what places a job on the Calendar.
- **Employee pay is a running balance**, not per-day paid/unpaid flags — mirrors the customer account-credit model. Balance owed = sum of `totalPay` across time entries, minus the sum of the `payments` ledger.
- **Offline support** (`offlineQueue.js`, IndexedDB): Service Call can create customers and invoices while offline; they queue and sync automatically once back online. The employee time clock does **not** have offline support currently.
- **Title-casing**: names and addresses are automatically title-cased server-side on save (`customers.js`, `properties.js`) — applies to new data only, not retroactively to existing records.

## Known Limitations / Open Items

- EmailJS template editor has intermittently thrown a "template isn't updated" save error unrelated to any code here — if it recurs, try an incognito window, or contact EmailJS support.
- Equipment currently lives as an array on each `property` document. A planned refactor would make it its own document type, referencing property, customer, *and* the invoice it came from — not yet built.
- Receipt photos are captured and stored on invoices but not yet shown anywhere the customer sees (print/email).
- Resend integration for employee payment/edit email notifications was deliberately deferred — currently, only the in-app unread badge fires; no email goes out yet.
- "Kits" (bundled catalog items for common jobs, e.g. a Well Pump Kit) not yet built.
- No automated tests exist. All verification has been manual, plus ad hoc local rendering checks for PDF output during development.

## Deployment

- **Site**: push to `main` on GitHub → Vercel auto-deploys.
- **Studio**: separate repo (`adk-studio`) → `npx sanity deploy` (manual, not auto-deployed on push).
- Recommended workflow for any non-trivial change: branch as `preview/<name>`, test via the Vercel preview deployment it generates, then merge to `main`.
