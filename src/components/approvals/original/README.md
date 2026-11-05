# Approved artwork-approval presentation

The canonical presentation comes from the owner's October 20 multi-design preview, source commit `66960e271d7fb34b6c35ae9cb5533e94bfbb90c9`. `model.mjs` is retained unchanged. `app.mjs` preserves its gallery, proof/specification view, batch decisions, three statements, independent optional promotional permission, editor and version receipts.

The renderer is scoped to one mounted DOM root. `ProofPortal.tsx` handles its React lifecycle. Authenticated staff and customer adapters in `src/lib/approval-client.ts` use server APIs; they never save real approvals to browser storage or generate demo fallback records. `demo.mjs` is an in-memory adapter available through the development-only preview route. Its data is fictional.

`style.css` is the original stylesheet scoped to `.artwork-portal`, with small internal-review, print-isolation and fingerprint additions. The matching brand/sample assets are in `public/approval-assets`.

Customer mode exposes only customer review and receipt views. The existing Orders dashboard mounts staff mode after sign-in. These UI boundaries supplement server authentication, token lookup, private storage, RLS and restricted SQL functions; the API/database remain the enforcement boundary.
