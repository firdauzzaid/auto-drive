# BRD analysis — SaaS Inventori & POS Bengkel

## Source and scope

- Source: Google Doc **Fitur Bengkel**, **Tab 2**, version 1.0 / Draft Product Discovery, read 3 November 2026.
- Product target: an Android-first mobile SaaS for single-outlet independent motorcycle workshops in Indonesia, initially with 1–5 mechanics.
- Product promise: quick recording of workshop sales, automatic stock updates, vehicle service history, and mobile visibility for owners.

## What the BRD actually requires for the MVP

The BRD's mandatory path is a complete workshop transaction, not a collection of separate CRUD screens:

1. An authenticated user creates or joins one workshop.
2. The workshop maintains products, services, customers, and vehicles.
3. A cashier creates a sale containing products and/or services, optionally linked to a customer and vehicle, then records a payment.
4. Completing a sale records immutable transaction prices, reduces product stock, creates stock movements, updates vehicle history, and feeds the dashboard and reports.
5. A purchase increases stock through stock movements; an expense is recorded separately.

The stated Definition of Done additionally includes basic dashboard/reporting, purchase, expense, customer/vehicle history, and the ability for an owner to operate without developer assistance.

## In-scope data and invariants

| Area | Minimum records | Non-negotiable rule from BRD |
| --- | --- | --- |
| Tenancy | workshop, user, membership/role | Every business record is scoped by `workshop_id`; cross-workshop access is forbidden. |
| Catalog | product, product category, service, service category, supplier | Product and service are distinct; a service never reduces stock. |
| Inventory | inventory movement | Stock must never change without a movement record. Default is no negative stock. |
| Sales | transaction, transaction item, payment | Completed sales retain a price snapshot and cannot be hard-deleted; void/cancel needs an audit trail. |
| CRM | customer, vehicle | One customer may own many vehicles; licence plate is a primary lookup key; vehicle-linked sales form service history. |
| Operations | purchase, purchase item, expense | Completed purchases add stock; expenses are outside POS sales. |

## Priority interpretation

The BRD's own P0/P1 list conflicts slightly with its broader “MVP Definition of Done.” The smallest coherent pilot scope is:

- **Pilot P0:** authentication/workshop, owner and cashier permissions, catalog, customer/vehicle, POS sale + cash/QRIS/transfer payment, inventory movement, purchase, expense, dashboard, transaction/vehicle history, and basic sales/inventory/expense reports.
- **Pilot P1:** Bon/receivable repayment, formal audit-log viewer, CSV import, low-stock notification delivery, and exportable PDF invoice. The underlying data model should still safely support partial payment and transaction voiding from day one where required by business rules.
- **Explicitly deferred:** mechanic portal/commission, WhatsApp, booking, loyalty, multi-branch, supplier debt, full offline POS sync, accounting, marketplace/API integrations, AI, Bluetooth printing, and unit conversion.

## Material decisions still missing

These answers alter financial correctness, access, or workflow and must be decided before implementation:

1. **Cost of goods sold:** BRD permits latest purchase cost or stored product cost. Pick one for pilot reporting and define whether the cost is snapshotted at sale completion. (Recommended: snapshot the product's current cost at sale completion; do not retroactively rewrite history.)
2. **Void/cancel:** Define who may void a completed sale, whether a reason is mandatory, and whether it automatically creates a reversing inventory movement.
3. **Bon:** Although listed P1, it is also a POS payment method and dashboard measure. Decide whether pilot accepts Bon; if yes, define repayment flow, payment allocation, due date, and cashier/owner permission.
4. **Payment:** Can one transaction have split payments, or exactly one method for pilot? The BRD only gives examples, not the rule.
5. **Stock adjustments and returns:** Define allowed reasons, whether return means supplier return or customer return, and the corresponding financial/reversal behavior.
6. **Customer/vehicle uniqueness:** Decide plate normalization and the handling of no-plate/new vehicles; enforce uniqueness per workshop rather than globally unless an intentional cross-tenant lookup policy exists.
7. **Identity and roles:** Specify how an owner invites a cashier, who may change roles, and whether a user can belong to more than one workshop.
8. **Invoice:** Digital receipt is required, but the exact channel is undecided. In-app receipt should be the pilot default; WhatsApp/PDF belongs to P1 unless validation says otherwise.
9. **Onboarding/import:** CSV is P1 but the pilot's 15-minute-first-sale objective will require either manual setup for pilot workshops or an import path. Decide the operator-owned pilot process.

## Product and delivery risks

- The ≤30-second checkout target is incompatible with forcing a new customer or vehicle every time; both associations should be optional during the sale and addable inline.
- “Gross profit” is only meaningful after a single COGS policy is locked; displaying it before that risks misleading owners.
- Multi-tenancy requires database-enforced isolation (not only client filtering) and all direct data access must be authorization-scoped.
- Offline *draft persistence*, connectivity indication, and retry are reasonable pilot safeguards; offline completed checkout with sync/conflict handling is correctly out of scope.

## Source

Google Docs, [Fitur Bengkel — Tab 2](https://docs.google.com/document/d/1zJXqXxhRyKBYjuuHLhvKTYMJhaRxHCFDC4MlMNZr1qk/edit?tab=t.xs9wyerll3me), accessed 3 November 2026.
