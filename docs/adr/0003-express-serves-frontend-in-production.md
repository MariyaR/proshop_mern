# 0003 — Express serves the React build as static files in production

**Status:** Accepted  
**Confidence:** HIGH — directly observable in `backend/server.js` and root `package.json`

## Context

In production, the React SPA needs to be delivered to the browser. A decision had to be made about where to host the frontend build — a dedicated static file server/CDN, a separate process, or the same Express server that handles the API.

## Decision

In production (`NODE_ENV=production`), Express serves the compiled React build from `frontend/build/` as static files, and all non-API routes return `index.html` to support client-side routing.

Observable in `server.js`:
```js
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '/frontend/build')))
  app.get('*', (req, res) =>
    res.sendFile(path.resolve(__dirname, 'frontend', 'build', 'index.html'))
  )
}
```

The `heroku-postbuild` script in `package.json` builds the frontend automatically on deploy:
```
"heroku-postbuild": "NPM_CONFIG_PRODUCTION=false npm install --prefix frontend && npm run build --prefix frontend"
```

In development the two concerns are separated: the React dev server (port 3000) proxies API calls to Express (port 5000) via the `proxy` field in `frontend/package.json`.

## Alternatives Considered

- **Separate static hosting** (e.g., Netlify, S3 + CloudFront) for the frontend with the API on its own server — would require CORS configuration on the Express side. No CORS middleware (`cors` package) is present in `server.js` or `package.json`, which confirms this was not the chosen approach.
- **nginx as a reverse proxy** in front of both — no nginx config file exists anywhere in the repository.

## Consequences

**+** Single dyno / single process on Heroku — simpler and cheaper deployment with no cross-origin complexity.  
**+** Zero CORS configuration required: the browser always talks to the same origin.  
**−** Express is not optimised for serving static files at scale; under high traffic a CDN or dedicated file server would perform better.  
**−** The frontend and backend must be deployed together — an independent frontend deploy (e.g., for a hotfix) is not possible.  
**−** The `uploads/` folder for product images is served by the same Express process and is ephemeral on Heroku — it is lost on every deploy.
