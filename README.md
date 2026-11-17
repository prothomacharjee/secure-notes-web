# Secure Notes Web

Plain HTML + vanilla JS frontend for the Secure Notes API. No build step, no framework.

- `index.html` — markup and minimal styles
- `app.js` — API calls, rendering, pagination

`API_URL` at the top of `app.js` points to `http://localhost:4000/api` when opened from localhost, otherwise to the deployed Render API.

Run locally: serve this folder (e.g. Laragon at `http://localhost/secure-notes/web/`, or `npx serve . -l 5500`) with the API running.
