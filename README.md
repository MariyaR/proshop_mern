# ProShop

ProShop is a full-stack e-commerce web app where users can browse products, leave reviews, add items to a cart, and pay via PayPal. Admins can manage products, users, and orders through a dedicated dashboard. It is a learning project built with the MERN stack — useful as a reference implementation for authentication, Redux state management, and a PayPal checkout flow.

## Tech Stack

| Layer | Library | Version |
|---|---|---|
| Runtime | Node.js | 14.6+ |
| Backend | Express | ^4.17.1 |
| Database | MongoDB + Mongoose | ^5.10.6 |
| Auth | jsonwebtoken + bcryptjs | ^8.5.1 / ^2.4.3 |
| File upload | Multer | ^1.4.2 |
| Frontend | React | ^16.13.1 |
| State | Redux + Redux Thunk | ^4.0.5 / ^2.3.0 |
| Routing | React Router DOM | ^5.2.0 |
| UI | React Bootstrap | ^1.3.0 |
| Payments | react-paypal-button-v2 | ^2.6.2 |
| HTTP client | Axios | ^0.20.0 |

## Folder Structure

```
proshop_mern/
├── backend/
│   ├── config/        # MongoDB connection (db.js)
│   ├── controllers/   # Route handlers (product, user, order)
│   ├── data/          # Seed data arrays (products, users)
│   ├── middleware/    # JWT auth, error handler
│   ├── models/        # Mongoose schemas (User, Product, Order)
│   ├── routes/        # Express route definitions
│   ├── utils/         # generateToken.js
│   └── server.js      # Express entry point
├── frontend/
│   └── src/
│       ├── actions/   # Redux async actions (thunks)
│       ├── components/# Reusable UI components
│       ├── constants/ # Redux action type strings
│       ├── reducers/  # Redux reducers
│       ├── screens/   # Page-level components
│       ├── App.js     # Route definitions
│       └── store.js   # Redux store + localStorage persistence
├── uploads/           # Product images (local dev only, not persisted on Heroku)
├── .env               # Environment variables — create this yourself (see below)
└── package.json       # Backend deps + all dev scripts
```

## Setup

### Prerequisites

- **Node.js v14.6 or higher** — the backend uses ES Modules (`import`/`export`) which require 14.6+. Check with `node -v`.
- **MongoDB** — either:
  - Local: [install MongoDB Community](https://www.mongodb.com/try/download/community) and run `mongod`
  - Cloud: create a free cluster at [MongoDB Atlas](https://www.mongodb.com/atlas) and copy the connection string

### 1. Environment Variables

Create a `.env` file in the project root (not inside `frontend/`):

```
NODE_ENV=development
PORT=5000
MONGO_URI=mongodb://localhost:27017/proshop
JWT_SECRET=any_long_random_string
PAYPAL_CLIENT_ID=your_paypal_sandbox_client_id
```

- `MONGO_URI` — for Atlas, use the connection string from the Atlas dashboard (format: `mongodb+srv://user:pass@cluster.mongodb.net/proshop`)
- `JWT_SECRET` — any string; used to sign auth tokens
- `PAYPAL_CLIENT_ID` — must be a **sandbox** client ID for local development (see Troubleshooting)

### 2. Install Dependencies

From the project root, install backend and frontend dependencies separately:

```bash
npm install
cd frontend && npm install && cd ..
```

### 3. Seed the Database

The app starts with an empty database. Import sample products and users:

```bash
npm run data:import
```

Sample accounts created:

| Email | Password | Role |
|---|---|---|
| admin@example.com | 123456 | Admin |
| john@example.com | 123456 | Customer |
| jane@example.com | 123456 | Customer |

### 4. Run in Development

```bash
npm run dev
```

This starts both servers concurrently:
- Backend API: `http://localhost:5000`
- Frontend: `http://localhost:3000` (proxies `/api/*` to port 5000)

Open `http://localhost:3000` in your browser.

## Other Commands

```bash
npm run server       # Backend only (with nodemon)
npm run client       # Frontend only
npm run data:destroy # Wipe all data from the database
```

## Deployment (Heroku)

Set all `.env` variables as Heroku config vars:

```bash
heroku config:set NODE_ENV=production
heroku config:set MONGO_URI=your_atlas_uri
heroku config:set JWT_SECRET=your_secret
heroku config:set PAYPAL_CLIENT_ID=your_client_id
```

Push to Heroku — the `heroku-postbuild` script automatically builds the frontend. Express then serves the static build at `/` and the API at `/api/*`.

Note: the `uploads/` folder is ephemeral on Heroku. Product images uploaded via the admin panel will be lost on each deploy.

## Troubleshooting

**Products don't appear on the home page**
The database is empty. Run `npm run data:import` to seed it.

**"Cannot read property '_id' of null" on the order page**
Your browser has a JWT token for a user that was deleted when you last ran `npm run data:import`. Log out and log back in to get a fresh token.

**MongoDB connection error on startup**
- Local MongoDB: make sure `mongod` is running
- Atlas: check that your IP address is whitelisted in the Atlas Network Access settings, and that the username/password in `MONGO_URI` are correct

**PayPal button doesn't appear / PayPal errors**
`PAYPAL_CLIENT_ID` must be a **sandbox** client ID, obtained from [developer.paypal.com](https://developer.paypal.com) → Apps & Credentials → Sandbox. Production client IDs do not work in development.

**Port already in use**
`npm run dev` requires ports 3000 and 5000 to be free. Find and stop whatever is using them:
```bash
lsof -ti:3000 | xargs kill
lsof -ti:5000 | xargs kill
```

**API calls fail with network errors in development**
The frontend proxies `/api/*` to `http://127.0.0.1:5000` via the `proxy` field in `frontend/package.json`. This only works when running `react-scripts start` — it does not apply to the production build. Make sure the backend is running before starting the frontend.
