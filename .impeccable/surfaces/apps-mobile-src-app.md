---
version: 1
slug: "apps-mobile-src-app"
primary_target: "apps/mobile/src/app"
related_targets: []
---

# Kasir Bengkel — mobile app surface brief

Scope: the Expo mobile app (apps/mobile/src/app), all tabs and stack screens. Visitor mode: Operate.

Audience and job: cashier or owner at the front desk of a small Indonesian motorcycle workshop, phone held in one hand while serving a waiting customer, often an entry-level Android with a small screen; the owner also checks Home away from the workshop. Success is speed without thinking: a simple sale in under 30 seconds, the total and the next action always obvious. Wrong outcomes: fintech/m-banking coolness, promo-app noise, spreadsheet blandness.

Constraints: DESIGN.md flow, vocabulary and bottom navigation (Home, Kasir, Stok, Lainnya) stay; 48 dp targets; Rupiah is the most prominent information on POS screens.

## Direction contract

THESIS: Every figure that matters is stamped like an Indonesian licence plate, readable at a glance, at arm's length, in bright light. Refuses the category default of white cards with a blue accent and product tiles.

OWN-WORLD: Plate black #121314 and plate white #F7F7F2 own the shell; public-plate yellow #F4C21B is the single action colour; government-plate red #C8261E marks danger and low stock; warm asphalt ground #E7E6E1. Barlow for UI text, Barlow Condensed Bold for every figure. Plates are rounded rectangles with an inset 2 px white rule. No grey text on black; one face on the fixed 12/14/16/20/24/32 ladder.

STORY: The cashier finds an item by name, taps the black add key, watches the plate total grow, presses the yellow Bayar, and gets a receipt whose transaction number is itself a plate. The owner opens Home and reads the day's omzet plate first.

FIRST VIEWPORT: Kasir. Black header band with title, white search field and Semua/Sparepart/Jasa filter. White list rows, name and stock tag left, price right-aligned in a shared condensed column, 48 dp black add key or stepper. Pinned at the bottom above the tab bar: the black total plate with inset rule, total in Barlow Condensed 32, item count and payment beneath, yellow Bayar segment on the right.

FORM: Plat Nomor, candidate 4 of 7 on the grounded list. seed:ebe49cd2aeb457b3. Raises: ikeda-datamatics two-value shell; cassette j-card single right-aligned money column; zoo guide map colour owns regions; bitmap specimen fixed type ladder; centre-rail fixed state marks; Saville one headline figure per screen.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Unresolved: final brand name and logo; dark theme; tablet layout.
