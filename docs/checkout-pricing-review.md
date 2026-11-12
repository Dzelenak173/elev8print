# Checkout pricing review — November 12, 2026

This branch is a proposed pricing correction for owner review. It is not a production release.

## Pricing behavior

The maker, cart, quantity edits, pricing API and server-side order creation use one calculation. Standard square sizes use a fixed price snapshot rather than changing automatically when StickerApp changes its prices. Published tier totals were read from StickerApp's US white-vinyl/gloss die-cut calculator on November 12, 2026, matching the baseline the existing cart already requested. Materials remain exactly the existing six choices: Matte Vinyl, Holographic, Clear, Window Perf, Heat Transfer (Clothing), and Wall Stickers. As in the existing cart, all six use the same size/quantity price baseline. This does not claim that StickerApp charges the same for those six products, or introduce material premiums.

Between listed quantity tiers, interpolate the order total in cents. Above the largest listed tier, retain that tier's per-piece rate. Display rounding never feeds back into the order total. Arbitrary quantities are Elev8 calculations based on the benchmark; they are not claimed to exactly match StickerApp.

| Square size | Quantity | Proposed product total, before estimated tax and shipping |
| --- | ---: | ---: |
| 2 × 2 in | 500 | $132.00 |
| 3 × 3 in | 500 | $210.00 |
| 4 × 4 in | 500 | $303.00 |
| 5 × 5 in | 500 | $403.00 |
| 6 × 6 in | 500 | $516.00 |
| 7 × 7 in | 500 | $644.00 |
| 8 × 8 in | 500 | $779.00 |
| 9 × 9 in | 500 | $931.00 |
| 10 × 10 in | 500 | $1,089.00 |

Minimum quantities are retained in the same price snapshot and shown by the maker. Existing saved carts refresh to the proposed prices on opening. A changed, invalid or altered order price is stopped before database writes or email; the customer must review and submit again. Bag size minimums are enforced in the maker, cart and server validation. No new database columns, migration, secret, subscription, or paid integration is needed for this branch.

Custom dimensions retain the existing external StickerApp benchmark through the server with input validation, a timeout and safe error handling. This remains a third-party dependency. A later fixed custom-size schedule would remove that dependency. No claim of matching material-specific production costs or profitability has been made.

## Shipping and tax follow-up

The existing $8.50 shipping charge and $150 free-shipping threshold remain in this pricing-only draft; the negative notice is corrected to use the actual threshold. The existing 6% tax estimate is shared by browser and server. It is not a completed destination-based tax system. Review these policies before a production release; this branch does not establish their suitability.

The owner uses Pirate Ship. Its official support says it has no public API and does not supply live website checkout rates. Keep label purchases there. Recommended next shipping phase:

1. Present shipping as pending review, with the final amount approved before payment, until reliable rates exist.
2. Store product subtotal, tax, shipping amount and pending/final status separately in orders, invoices and confirmations. This needs a separate reviewed database migration and all customer/admin views updated together.
3. Support an admin CSV export for Pirate Ship's spreadsheet import. Do not invent package weights or dimensions, buy labels, or transmit customer data automatically.
4. Use real packed weights, dimensions and recent postage history to evaluate an optional fixed-rate or weight-based checkout policy later.

Michigan Treasury confirms 6% on taxable Michigan sales. Out-of-state collection depends on applicable registration obligations; do not blindly apply Michigan tax to every destination or assume all other states are tax-free. Separately itemized shipping can be excluded from Michigan tax only with appropriate accounting records. Confirm destination/exemption rules before replacing the estimate.

Official references:

- https://stickerapp.com/custom-stickers
- https://support.pirateship.com/en/articles/2309246-does-pirate-ship-have-an-api
- https://support.pirateship.com/en/articles/2125835-does-pirate-ship-offer-a-shopping-cart-plugin
- https://www.pirateship.com/integrations/spreadsheets
- https://www.michigan.gov/taxes/business-taxes/sales-use-tax
- https://www.michigan.gov/taxes/business-taxes/sales-use-tax/delivery-and-installation-charges

## Verification boundary

Automated tests exercise maker pricing, actual Zustand cart actions, the pricing route, order validation and the real order POST handler. Database/email transport is replaced in order tests; no hosted test order or real customer email is created. The existing artwork approval database and API tests remain part of the regression suite. Original artwork surviving a full cart refresh is a separate outstanding fix; preserving a File while recalculating an in-memory cart does not solve its JSON persistence.
