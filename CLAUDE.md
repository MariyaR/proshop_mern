# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev          # Run frontend (port 3000) + backend (port 5000) concurrently
npm run server       # Backend only with nodemon hot reload
npm run client       # Frontend only (from root)
```

### Database Seeding
```bash
npm run data:import  # Seed MongoDB with sample users and products
npm run data:destroy # Wipe all data from database
```

### Production
```bash
npm start            # Serve static frontend build + Express API
cd frontend && npm run build  # Build frontend for production
```

No linting or automated tests are configured in this project.

## Architecture

Full-stack MERN e-commerce app. The backend is an Express REST API; the frontend is a React SPA that proxies API calls to `http://127.0.0.1:5000`.

### Backend (`backend/`)

Express server on port 5000. All routes are under `/api/`:

| Route | Controller |
|---|---|
| `/api/products` | Product catalog, reviews, top-rated carousel |
| `/api/users` | Register, login, profile, admin user management |
| `/api/orders` | Create, retrieve, payment/delivery updates |
| `/api/upload` | Multer image upload for products |
| `/api/config/paypal` | Returns PayPal client ID to frontend |

**Auth flow:** `protect` middleware validates JWT Bearer tokens. `admin` middleware checks `user.isAdmin`. Both are in `backend/middleware/authMiddleware.js`. Tokens are generated in `backend/utils/generateToken.js`.

**Error handling:** All route handlers use `express-async-handler`. A global error handler middleware in `backend/middleware/errorMiddleware.js` converts exceptions to JSON.

**Mongoose models:** `User` (bcrypt password hashed in pre-save hook), `Product` (reviews embedded as subdocument array), `Order` (references User and contains cart items snapshot).

### Frontend (`frontend/src/`)

React 16 + Redux SPA with React Router v5 and React Bootstrap.

**State management pattern:** Each feature follows: `constants/` → `actions/` → `reducers/` → wired into `store.js`. Redux Thunk handles async API calls. Cart and user session are persisted to `localStorage` and rehydrated in `store.js`.

**Redux state slices:** `productList`, `productDetails`, `productTopRated`, `productCreate/Update/Delete`, `productReviewCreate`, `cart`, `userLogin`, `userRegister`, `userDetails`, `userUpdateProfile`, `userList`, `userDelete`, `userUpdate`, `orderCreate`, `orderDetails`, `orderPay`, `orderDeliver`, `orderListMy`, `orderList`.

**Screens** (`frontend/src/screens/`) are page-level components mapped to routes in `App.js`. Private routes use a `<Route>` wrapper pattern checking `userInfo` from Redux state.

**Checkout flow:** ShippingScreen → PaymentScreen → PlaceOrderScreen → OrderScreen (with PayPal integration).

### Environment Variables (`.env` at root)

```
NODE_ENV=
PORT=5000
MONGO_URI=
JWT_SECRET=
PAYPAL_CLIENT_ID=
```

### Deployment

Heroku-ready: `heroku-postbuild` in root `package.json` builds the frontend, then Express serves the static build at `/` and API at `/api/*`.

## PR Conventions

- Branch names: `feat/short-description`, `fix/short-description`, `chore/short-description`
- PR titles match the branch: `feat: add product search`, `fix: order payment null error`
- Keep PRs small and focused on one thing — one screen, one bug, one feature
- Test the full affected user flow before marking ready (not just the changed component)

## Local Gotchas

- **After `npm run data:import`**, all users are wiped and recreated with new MongoDB IDs. Any browser session holding an old JWT will get auth errors — log out and log back in.
- **After `npm run data:destroy`**, the app has no products, users, or orders. The home page will be empty and login will fail until you re-import.
- **After adding a new Mongoose model**, register it in `backend/seeder.js` if it needs seed data, and manually run `npm run data:import` — there is no auto-migration.
- **After adding a new Redux slice**, wire it into `store.js` manually — it is not auto-discovered.
- **PayPal sandbox only**: `PAYPAL_CLIENT_ID` must be a PayPal sandbox client ID for local development. Real client IDs will not work in sandbox mode and vice versa.
- Both ports must be free: frontend on 3000, backend on 5000. `npm run dev` will silently fail if either is occupied.

## Deployment Quirks

- Run `cd frontend && npm run build` locally to catch build errors before pushing — Heroku will fail the deploy silently on build errors.
- Environment variables must be set in Heroku config vars manually (`heroku config:set KEY=value`) — the `.env` file is not deployed.
- `NODE_ENV=production` must be set on Heroku or the Express server will not serve the frontend static build.
- The `uploads/` folder (product images) is ephemeral on Heroku — it resets on every deploy. Use cloud storage (e.g., S3) for persistent image uploads in production.

## Product documentation search for proshop_mern (search-docs MCP)

For any questions about functionality, features, architecture, ADRs, runbooks, or incidents — ALWAYS use the `search_project_docs` MCP first. It is faster and returns relevant chunks with metadata. ONLY if the vector search does not return the needed results or you need the full file content from the metadata of a found chunk → fall back to grep + read. DO NOT start with grep + read across the project — it is slow and token-expensive.

## Feature flags management (feature-flags MCP)

- When the user asks about a feature status ("what is the status of gift_message?", "is search_v2 enabled?") — call the feature-flags MCP `get_feature_info`, do not read `features.json` directly.
- When the user wants to change a status ("enable feature X", "move Y to Testing", "set traffic to 25%") — call the appropriate tools (`set_feature_state`, `adjust_traffic_rollout`). Never edit `backend/features.json` manually via Edit/Write.
- When the user asks for a list of all features — use the `list_features` tool (if available), do not grep the file.
