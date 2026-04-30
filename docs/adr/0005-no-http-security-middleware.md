# 0005 — No CORS, rate limiting, helmet, or input validation middleware

**Status:** Accepted  
**Confidence:** HIGH — confirmed by absence in `package.json` and `backend/server.js`

## Context

Express APIs typically need a layer of cross-cutting HTTP security concerns: CORS headers, request-rate limiting, security response headers, and input sanitisation. A choice had to be made about whether to add this middleware or rely on deployment topology to provide equivalent protection.

## Decision

No security middleware is wired in. The API is treated as a trusted same-origin endpoint, protected by the fact that Express serves the React SPA from the same process and origin in production.

Confirmed absent from `package.json` dependencies: `cors`, `helmet`, `express-rate-limit`, `express-validator`, `joi`, `express-mongo-sanitize`, `csurf`, `cookie-parser`.

`backend/server.js` registers only: `morgan`, `express.json()`, route handlers, and the error middleware — nothing else.

`backend/routes/uploadRoutes.js` instantiates `multer` without a `limits` option, so there is no enforced maximum file size on image uploads.

## Alternatives Considered

- **`cors()` middleware** — would allow a separately hosted frontend (mobile app, different domain) to consume the API. Its absence means the API cannot be used cross-origin without code changes.
- **`helmet()`** — sets X-Frame-Options, Content-Security-Policy, and other protective response headers.
- **`express-rate-limit`** on `POST /api/users/login` — no brute-force protection on the login endpoint.
- **`express-validator` / `joi`** — controllers do raw destructuring with no length, format, or type checks on any field.

## Consequences

**+** Minimal middleware stack — fewer dependencies, simpler server setup.  
**+** No risk of CORS misconfiguration because there is no CORS layer at all.  
**−** The app is locked into a single-origin deployment; a mobile client or separately hosted frontend cannot call the API as-is.  
**−** No protection against credential stuffing on login, registration spam, or oversized file uploads filling the server disk.  
**−** User-supplied strings (`name`, `comment`, product `description`) are stored and rendered without sanitisation, leaving XSS possible if output escaping ever fails.
