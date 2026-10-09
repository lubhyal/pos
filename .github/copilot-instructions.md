# Repository Instructions

## Project Shape
- This is a small Indonesian-language inventory/POS web application.
- `server.js` is a Node.js CommonJS application using Express and `mysql2/promise`. It serves static files from `public/` and implements the JSON API.
- `public/index.html` contains the browser UI, Bootstrap styling, and its client-side JavaScript. Keep the frontend framework-free unless the project is deliberately migrated.
- `readme.txt` contains Windows deployment and LAN access notes.

## Commands and Validation
- Install dependencies with `npm install`.
- Run the application with `npm start` (starts `server.js` on `PORT`, default `3000`).
- `package.json` currently defines no test, lint, or build scripts. Do not claim those checks ran; use focused manual/API checks when appropriate.

## Existing API and Data Conventions
- The API operates on the MySQL `stock` table. Existing routes are `GET /api/options`, `GET /api/barang`, `POST /api/barang`, and `PUT /api/barang/:kdBar`.
- Database fields use the existing casing and names such as `KdBar`, `Nmbar`, `KdKel`, `HBeli`, `HJual`, `StAwal`, and `RAK`. Preserve compatibility with these names unless a schema migration is part of the task.
- Use parameterized SQL for values. Keep pagination and filtering behavior compatible with the current API response shape.
- The frontend calls same-origin `/api/...` endpoints and expects JSON responses with a `success` field.

## Change Guidelines
- Keep edits focused and follow the existing CommonJS, plain JavaScript, and Indonesian UI conventions.
- Do not assume a database schema or migration tooling beyond what is present in the repository.
- Do not add database credentials to source control. Prefer environment-based configuration for new or revised connection settings.
- When changing an API contract, update its frontend callers and document any required deployment or database changes.
