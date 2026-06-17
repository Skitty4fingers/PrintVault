# 🧊 PrintVault

**PrintVault** is a self-hosted 3D printing file library for organizing, previewing, sharing, uploading and downloading STL, 3MF, OBJ, STEP, G-code and related print files from any device over [Tailscale](https://tailscale.com). It runs locally in Docker, stores everything on your own disk, and depends on no cloud services.

---

## ✨ Features

- **Sleek, modern dark UI** — responsive card/grid layout that works on desktop, tablet and mobile.
- **In-browser 3D preview** — interactive STL/OBJ viewer (rotate, zoom, pan) powered by Three.js, plus image previews.
- **Bulk upload** — drag-and-drop multiple files with progress, applying tags/category/notes to the whole batch.
- **Rich metadata** — name, description, tags, category, printer/material/profile notes, source URL, size, type and date.
- **Powerful library** — fast search; filter by tag, category, file type and favorites; sort by name/date/size/type; grid⇄list toggle.
- **Bulk actions** — multi-select to download as ZIP, bulk-edit tags, or delete.
- **Collections / projects** — group files, reorder by drag-and-drop, download as ZIP, and share.
- **One-click sharing** — generate read-only links with optional expiration and password; revoke any time. Shared visitors can only preview/download what was shared and never see admin functions.
- **Favorites**, **metadata export** (JSON/CSV), and a **dashboard** with storage usage and recent activity.
- **Secure by default** — local admin login, hashed passwords, session auth, unguessable share tokens, rate limiting, upload validation and path-traversal protection.

## 🧱 Tech stack

| Layer     | Technology |
|-----------|------------|
| Frontend  | React 18 + Vite, Three.js, React Router |
| Backend   | Node.js + Express |
| Database  | SQLite (`better-sqlite3`) |
| Storage   | Local filesystem (Docker volume) |
| Packaging | Docker + Docker Compose |

## 📦 Supported file types

`.stl` · `.3mf` · `.obj` · `.step` · `.stp` · `.gcode` · `.zip` · `.png` · `.jpg` · `.jpeg` · `.webp`

(Configurable via `ALLOWED_EXTENSIONS`.)

---

## 🚀 Quick start (Docker Compose — recommended)

```bash
# 1. Clone
git clone https://github.com/Skitty4fingers/PrintVault.git
cd PrintVault

# 2. Configure
cp .env.example .env
#   Edit .env — at minimum set SESSION_SECRET and ADMIN_PASSWORD.
#   Generate a strong session secret:
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"

# 3. Build & run
docker compose up -d --build

# 4. Open
#   http://localhost:8080   (or your Tailscale IP — see below)
```

Log in with the `ADMIN_USER` / `ADMIN_PASSWORD` from your `.env`, then change the password from **Settings**.

## 🐳 Docker (without Compose)

```bash
docker build -t printvault .

docker run -d \
  --name printvault \
  -p 8080:8080 \
  --env-file .env \
  -v printvault-data:/data \
  --restart unless-stopped \
  printvault
```

## 💻 Local development

Requires **Node.js 20+**.

```bash
# Install all dependencies (root, server, client)
npm run install:all

# Create your env file
cp .env.example .env

# Run the API (:8080) and the Vite dev server (:5173) together
npm run dev
```

Open <http://localhost:5173>. The dev server proxies `/api` to the backend on `:8080`.

## 🏭 Production without Docker

```bash
npm run install:all
cp .env.example .env   # set NODE_ENV=production, SESSION_SECRET, etc.
npm run prod           # builds the client, then starts the server on :8080
```

The Express server serves the built client and the API on a single port.

---

## ⚙️ Configuration

All configuration is via environment variables (see [`.env.example`](./.env.example)).

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `8080` | Port the app listens on. |
| `HOST` | `0.0.0.0` | Bind address. `0.0.0.0` is required for Tailscale access. |
| `BASE_URL` | `http://localhost:8080` | Public base URL used when generating share links. Set to your Tailscale IP/MagicDNS name. |
| `STORAGE_PATH` | `./data` (`/data` in Docker) | Folder for uploaded files, the SQLite DB and thumbnails. |
| `DB_PATH` | `<STORAGE_PATH>/printvault.db` | Optional explicit database path. |
| `ALLOWED_EXTENSIONS` | `stl,3mf,obj,step,stp,gcode,zip,png,jpg,jpeg,webp` | Comma-separated allowed upload extensions. |
| `MAX_UPLOAD_MB` | `500` | Maximum size per uploaded file (MB). |
| `SESSION_SECRET` | _(none)_ | **Required in production.** Long random string used to sign session cookies. |
| `ADMIN_USER` | `admin` | Initial admin username (created on first run). |
| `ADMIN_PASSWORD` | `changeme` | Initial admin password. Change it after first login. |
| `NODE_ENV` | `production` | `production` or `development`. |

### First-run / admin setup

On first start, if no users exist, PrintVault creates an admin account from `ADMIN_USER` / `ADMIN_PASSWORD`. **Set a strong `SESSION_SECRET` and change the default password** in **Settings → Change admin password** immediately.

---

## 🔗 Remote access with Tailscale

PrintVault binds to `0.0.0.0`, so any device on your tailnet can reach it — no public internet exposure required.

1. Install Tailscale on the host machine and on the devices you want to access from.
2. Find the host's Tailscale IP:
   ```bash
   tailscale ip -4        # e.g. 100.101.102.103
   ```
3. From any tailnet device, open `http://100.101.102.103:8080` (or your MagicDNS name, e.g. `http://my-server.tailnet-name.ts.net:8080`).
4. Set `BASE_URL` in `.env` to that same address so generated **share links resolve correctly** for other devices, then restart:
   ```bash
   docker compose up -d
   ```

> **Do not** publish the port to the public internet. Access is intended to stay within your private tailnet. If you want links usable outside your tailnet, consider Tailscale Funnel deliberately — it is not enabled by default.

---

## 💾 Backup & restore

All state (uploaded files, SQLite database, thumbnails) lives in the `printvault-data` Docker volume (or your `STORAGE_PATH`).

**Back up** (stop the container first for a consistent SQLite snapshot):

```bash
docker compose stop
docker run --rm \
  -v printvault-data:/data \
  -v "${PWD}:/backup" \
  alpine tar czf /backup/printvault-backup.tar.gz -C /data .
docker compose start
```

**Restore** into a fresh volume:

```bash
docker run --rm \
  -v printvault-data:/data \
  -v "${PWD}:/backup" \
  alpine sh -c "cd /data && tar xzf /backup/printvault-backup.tar.gz"
docker compose up -d
```

If you run without Docker, simply back up the folder pointed to by `STORAGE_PATH`.

---

## 🔒 Security notes

- Local admin authentication with **bcrypt-hashed** passwords and signed session cookies.
- Share links use **cryptographically random, unguessable tokens** and can be password-protected, time-limited and revoked.
- Shared visitors get a **read-only** view limited to the shared file/collection — admin endpoints are never exposed to them.
- Uploads are validated against the allowed-extension list; stored files use internal IDs (original names are kept only as metadata), preventing path traversal and avoiding raw filesystem paths in the browser.
- Uploaded files are never executed.
- **Rate limiting** protects the login and public share endpoints.
- Secure HTTP headers via Helmet.
- No secrets are hard-coded; everything sensitive comes from environment variables.

---

## 🗂️ Project structure

```
PrintVault/
├── client/               # React + Vite frontend
│   ├── src/
│   │   ├── components/    # UI, FileCard, StlViewer, ShareModal, …
│   │   ├── pages/         # Dashboard, Library, FileDetail, Upload, …
│   │   ├── context/       # Auth context
│   │   └── lib/           # API client, formatters
│   └── vite.config.js
├── server/               # Express + SQLite backend
│   └── src/
│       ├── routes/        # auth, files, collections, shares, share, meta
│       ├── middleware/    # auth + rate limiting
│       ├── utils/         # file helpers, path safety
│       ├── config.js      # env-driven config
│       ├── db.js          # SQLite schema
│       └── index.js       # entry point
├── docs/API.md           # API contract
├── Dockerfile
├── docker-compose.yml
├── .env.example
└── package.json          # root scripts (dev / build / start / prod)
```

## 📜 npm scripts

| Script | Description |
|--------|-------------|
| `npm run install:all` | Install root, server and client dependencies. |
| `npm run dev` | Run server + client dev servers concurrently. |
| `npm run build` | Build the client for production. |
| `npm run start` | Start the server (serves API + built client). |
| `npm run prod` | Build the client, then start the server. |

---

## 📄 License

MIT
