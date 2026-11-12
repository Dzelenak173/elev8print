# Elev8 Print website direction

Owner direction recorded November 12, 2026. This is a working plan, not a release of the redesign or a public product catalog.

## 1. Immediate corrections — prepared for review

- Route website order alerts and contact inquiries to **office@elev8print.com**, as Daniel requested.
- Customer confirmation replies and visible support addresses should use the office inbox. Replying to an internal alert should address that customer or visitor.
- Keep the existing SendGrid From address until any replacement sender is verified. Receiving mail at the office does not require changing mailbox hosting, MX records, or DNS.
- Finish both order email send attempts before returning the server response. If an email fails after the order was saved, log the failure without inviting a duplicate order submission.
- Correct the FAQ and support page: Elev8 Print now offers white ink using its UV printer. Material compatibility and white placement are confirmed in the proof; do not promise this option for every material.
- Local tests use fictional data with mocked email/database services. Actual inbox delivery still needs a separately approved test; a successful provider request alone does not prove inbox receipt.
- Ask Daniel before publishing these corrections. Do not send live test messages without showing the recipient and message for review.

## 2. Redesign — planning, then owner preview

Keep Elev8 Print as the main storefront. Give customers two clear shopping paths:

| Path | Customer task | Initial scope |
| --- | --- | --- |
| Custom Printing | Upload their own design or request a custom job | Preserve current products, pricing, cart, order tracking, and private approval workflow |
| Shop Premade | Browse existing designs and products by interest | Collection browsing and product pages, beginning with Nature & Outdoors |
| Nature & Outdoors | Find nature-inspired designs and Stowterra products | A collection within Shop Premade, with a branded Stowterra feature |

Working assumption: premade designs are sold as physical printed products. Digital downloads and design-license terms have not been requested or confirmed; do not add them by assumption.

Design goals:
- Keep the existing Elev8 identity and make the two shopping paths obvious on desktop and mobile.
- Allow additional interest-based collections later without inventing a large empty catalog.
- Show real product imagery, clear prices, size/material options, and stock or made-to-order status.
- Manage products, collections, inventory, and resulting orders from the existing admin area. Do not create a disconnected shop that requires a second admin workflow.
- Keep customer artwork approvals private and reachable by the links Daniel sends; do not add them to public navigation.
- Show Daniel a homepage, collection, and product-page preview before connecting live purchasing or replacing the homepage.

Stowterra planning context:
- Daniel chose the Stowterra name and wants its boxes/products sold in the nature/outdoors area.
- Earlier concept: outdoor food storage for campers, a ten-pack presentation, and forest green / cream / orange mountain branding.
- Confirm the exact sale unit and contents, dimensions, photographs, price, launch inventory, packing/shipping requirements, and food-contact suitability before making a purchasable listing. Do not invent them.
- Do not claim the product is bear-resistant, prevents animals from smelling food, or replaces required bear-resistant storage without supporting testing/certification. Product guidance must allow for local food-storage requirements.

## 3. Reliability work — still open

- Larger artwork uploads and server-side upload/privacy controls. Current checkout original limit: 4 MB per file; private approval proofs use their separate private workflow.
- Expired admin sessions should return the owner to sign-in rather than show an empty or broken dashboard.
- Verify actual order and contact notification inbox delivery after the routing correction is approved and published.
- Review payment collection for premade-product purchases before presenting the new shop as immediate online checkout. The existing custom-order flow collects payment separately.
- Review destination-based tax and any applicable exemptions before treating the current 6% estimate as a complete tax solution.
- Establish an appropriate backup/recovery approach without adding paid services without approval.

## 4. Shipping — collect gradually

Use the existing [shipping examples task](https://trello.com/c/TJAtfU2m). Daniel will provide product/quantity, packed weight, package dimensions, Pirate Ship cost, and destination state/zone as normal shipments go out. Do not duplicate the task or hold up unrelated work.

The live settings remain $8.50 shipping and free shipping at $150. Proposed replacement rates are not approved or live. Sticker pricing and cart-artwork fixes were published in [PR #2](https://github.com/Dzelenak173/elev8print/pull/2).

## Next sequence

1. Review and publish the office-email and white-ink corrections, then verify approved email delivery.
2. Prepare and review the homepage / Nature & Outdoors / Stowterra design preview using real product information where available.
3. Implement the approved shop and admin product management in stages, alongside the remaining reliability fixes.
4. Calibrate shipping as shipment examples accumulate. Get approval before any live changes or new charges.
