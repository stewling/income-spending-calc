# Household Finance Hub

Local-first rolling monthly income, outgoings, weekly/monthly direct debits, one-off payments, and savings/assets tracker with browser caching (`localStorage` + `IndexedDB` + Service Worker), real-time LAN/remote sync (SSE), and persistent local SQLite + JSON storage.

## Run as a Docker Container (Port 5025)

### Option 1: Docker Compose (Recommended)

Copy the project folder to your server and run:

```bash
docker compose up -d --build
```

This will:
- Build the `node:24-alpine` container image (`Dockerfile`).
- Expose the app on port **`5025`** (`0.0.0.0:5025`).
- Persist the SQLite database (`household-budget.sqlite`) and mirrored JSON backup (`household-budget.json`) in `./data` on the host (`/app/data` inside the container).
- Automatically restart unless stopped and run health checks against `/api/health`.

To view logs or stop:

```bash
docker compose logs -f
docker compose down
```

### Option 2: Standalone `docker build` and `docker run`

```bash
docker build -t household-finance-hub .

docker run -d \
  --name household-finance-hub \
  --restart unless-stopped \
  -p 5025:5025 \
  -v "$(pwd)/data:/app/data" \
  household-finance-hub
```

### Accessing Remotely

Open from any browser on your local network or server:

```text
http://<your-server-ip>:5025
```

- **Data persistence**: Stored on the host in `./data/household-budget.sqlite` and `./data/household-budget.json`.
- **Browser caching**: Each device caches the app shell and ledger locally in `localStorage` and `IndexedDB` so edits work immediately and sync back when connected.
- **Optional environment variables**:
  - `PORT` (default in Docker: `5025`, default locally: `3000`)
  - `DATA_DIR` (default in Docker: `/app/data`, default locally: `./data`)
  - `HOST_IP` or `PUBLIC_URL` (optional; explicitly displays your remote server IP/URL in the **Local Network Access, Cache & Backups** modal)

## Run Directly Without Docker

Requires **Node.js >= 22.5** (tested on Node v24):

```bash
PORT=5025 node server.js
```

Run tests:

```bash
npm test
```
