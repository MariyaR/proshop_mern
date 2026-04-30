# 0006 — Authorization is a single boolean `isAdmin`; no RBAC, no resource ownership checks

**Status:** Accepted  
**Confidence:** HIGH — directly observable in `backend/models/userModel.js`, `authMiddleware.js`, and all route files

## Context

The app has two classes of users: shoppers and administrators. Administrators can manage products, users, and orders. A decision had to be made about how to model and enforce these permissions.

## Decision

The entire permission model is one boolean field on the User document. A single `admin` middleware is the only authorization primitive beyond `protect`.

Observable in `userModel.js`:
```js
isAdmin: { type: Boolean, required: true, default: false }
```

Routes compose the two middleware directly:
```js
router.route('/').get(protect, admin, getUsers)
router.route('/:id').delete(protect, admin, deleteUser)
```

No per-resource ownership is checked. `orderController.js` — `getOrderById` fetches any order by ID with only `protect` applied — any authenticated user who knows an Order ObjectId can read another user's full order, including shipping address and PayPal `email_address`. `updateOrderToPaid` has the same exposure: any logged-in user can mark any order paid by ID.

## Alternatives Considered

- **A `roles: [String]` array or separate Role collection** — would support a third role (e.g., vendor, support agent) without a schema migration. Not present; the schema has only `isAdmin`.
- **An ownership-check middleware (`isOwnerOrAdmin`)** — none defined anywhere in the codebase; routes use only `protect` and `admin`.
- **A policy/ACL library** (`casl`, `accesscontrol`) — absent from `package.json`.
- **Encoding role in the JWT** — would eliminate the per-request `User.findById()` call in `protect` (`authMiddleware.js` line 17) used to re-derive admin status. Not done; every authenticated request hits MongoDB.

## Consequences

**+** Dead-simple mental model — admin routes are visible from a single grep.  
**+** Promoting a user to admin is a one-boolean toggle in the admin panel.  
**−** Insecure direct object reference (IDOR) on `GET /api/orders/:id` and `PUT /api/orders/:id/pay` — authenticated non-admin users can access or mutate any order by ID.  
**−** Adding a third role (e.g., vendor managing their own products only) requires a schema migration plus rewriting every `protect, admin` guard.  
**−** Every authenticated request pays a MongoDB round-trip in `protect` to re-derive a value that could have been stored in the JWT claim.
