# 0001 — JWT and user session stored in localStorage

**Status:** Accepted  
**Confidence:** HIGH — directly observable in `frontend/src/store.js`

## Context

The app needs to persist the authenticated user's session across page refreshes without a server-side session store. Two standard browser storage options exist: `localStorage` and `httpOnly` cookies. A choice had to be made about where to keep the JWT token and the user info object returned by the login endpoint.

## Decision

Store the JWT token and user info object in `localStorage`, rehydrate them into the Redux initial state on every page load.

Observable in `store.js`:
```js
const userInfoFromStorage = localStorage.getItem('userInfo')
  ? JSON.parse(localStorage.getItem('userInfo'))
  : null
```

The cart items and shipping address are also persisted to `localStorage` by the same pattern.

## Alternatives Considered

- **httpOnly cookies** — the server sets a `Set-Cookie` header; the browser sends the cookie automatically on every request. Not implemented: there is no cookie-parser middleware in `server.js` and no `res.cookie()` call anywhere in the controllers.

## Consequences

**+** Simple to implement — no server-side session management or cookie configuration needed.  
**+** Works transparently with the React dev proxy (no CORS credential handling required).  
**−** `localStorage` is accessible to any JavaScript running on the page, making the token vulnerable to XSS attacks. An `httpOnly` cookie cannot be read by JavaScript at all.  
**−** If a user's account is deleted or their token is invalidated server-side, the stale token in `localStorage` still passes JWT signature verification until it expires — the app will only reject it when a protected API call is made (as observed with the `data:import` gotcha).
