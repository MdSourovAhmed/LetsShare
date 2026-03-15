# LetsShare — P2P LAN File Transfer

Browser-to-browser file sharing over your local network using **WebRTC** for direct transfers and **Socket.io** only for the initial handshake. Once connected, no data passes through the server.

---

## How it works

```
Sender browser                 Signaling server              Receiver browser(s)
      |                           (Express)                         |
      |──── join(linkId, sender) ────────────────────────────────>  |
      |                              |  <── join(linkId, receiver) ─|
      |  <── peer-joined(socketId) ──|                              |
      |──── signal(offer, toSocketId) ──────────────────────────>   |
      |  <── signal(answer, fromSocketId) ───────────────────────── |
      |                                                              |
      |<══════════════ WebRTC DataChannel (direct) ═════════════════|
      |                    files stream here                         |
```

1. **Sender** picks files or a folder, clicks "Create Share Link" — a random `linkId` is generated and they join the signaling room.
2. **Each receiver** opens the share link in their browser, which contains the `linkId` in the URL (`/receive?id=...`), and joins the same room.
3. The server tells the sender a new receiver arrived, including their **socketId**. The sender opens a dedicated `RTCPeerConnection` for that receiver and sends an SDP offer directly to their socketId.
4. The receiver answers. ICE candidates are exchanged the same way — routed by socketId, never broadcast to the whole room.
5. Once the DataChannel opens, files transfer **directly browser-to-browser**. The server is no longer involved.
6. Any number of receivers can join the same link. Each gets their own independent connection and receives the full transfer simultaneously.

---

## Project structure

```
LetsShare/
│
├── frontend/                        # React + Vite + Tailwind v4
│   ├── src/
│   │   ├── main.jsx                 # React entry point
│   │   ├── App.jsx                  # Router (/, /send, /receive)
│   │   ├── index.css                # Tailwind v4 @theme + global component classes
│   │   │
│   │   ├── lib/
│   │   │   ├── socket.js            # createSocket() — env-aware io() factory
│   │   │   ├── utils.js             # formatBytes, generateId, getFilePath, getRootFolderName
│   │   │   └── webrtc.js            # RTC_CONFIG, CHUNK_SIZE, BUFFER_LOW constants
│   │   │
│   │   ├── hooks/
│   │   │   ├── useSender.js         # All sender logic: file selection, session, multi-peer WebRTC
│   │   │   └── useReceiver.js       # All receiver logic: signaling, data channel, file assembly
│   │   │
│   │   ├── pages/
│   │   │   ├── HomePage.jsx         # Landing — links to /send and /receive
│   │   │   ├── SendPage.jsx         # Send flow UI
│   │   │   └── ReceivePage.jsx      # Receive flow UI (reads ?id= from URL)
│   │   │
│   │   └── components/
│   │       ├── ui/                  # Shared primitives
│   │       │   ├── Layout.jsx       # Sticky nav + footer
│   │       │   ├── StatusBadge.jsx  # Dot indicator + label (idle/connecting/connected/error)
│   │       │   ├── ProgressBar.jsx  # Reusable progress bar (brand or success variant)
│   │       │   ├── OverallProgress.jsx
│   │       │   └── FileIcon.jsx
│   │       ├── send/
│   │       │   ├── DropZone.jsx     # Drag-drop + "Select Files" / "Select Folder" buttons
│   │       │   ├── ShareLinkBox.jsx # Link display + copy button
│   │       │   ├── ReceiverCard.jsx # Per-receiver progress card (one per connected peer)
│   │       │   └── SenderFileTable.jsx
│   │       └── receive/
│   │           └── ReceiverFileTable.jsx  # File list with download buttons
│   │
│   ├── docker/
│   │   └── nginx/
│   │       └── nginx.conf           # SPA fallback + gzip + cache headers
│   │
│   ├── Dockerfile                   # Production: node build → nginx static
│   ├── Dockerfile.dev               # Development: Vite HMR, source bind-mounted
│   ├── vite.config.js
│   ├── package.json
│   └── .env                         # VITE_BACKEND_URL (see below)
│
├── backend/                         # Express + Socket.io signaling server
│   ├── server.js                    # Signaling logic (ESM)
│   ├── Dockerfile.backend           # Node 22 alpine, non-root user
│   ├── package.json                 # "type": "module", express + socket.io
│   └── .env                         # PORT, CORS_ORIGIN (see below)
│
└── docker-compose.yml               # Runs both services, dev + prod profiles
```

---

## Environment variables

### Frontend — `frontend/.env`

| Variable | Dev | Prod | Description |
|---|---|---|---|
| `VITE_BACKEND_URL` | _(empty)_ | `http://192.168.1.10:3000` | Backend URL as seen from the **browser**. Empty in dev — Vite's proxy forwards `/socket.io` to the backend automatically. In prod this is baked into the JS bundle at build time. |

### Backend — `backend/.env`

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the signaling server listens on. |
| `CORS_ORIGIN` | `*` | Allowed origin for Socket.io connections. Use `*` on a trusted LAN, or lock to your frontend URL in prod. |

---

## Workflows

### 1 — Local development (no Docker)

```bash
# Terminal 1 — backend
cd backend
cp .env.backend .env
npm install
npm run dev          # nodemon, restarts on changes, :3000

# Terminal 2 — frontend
cd frontend
cp .env.frontend .env
npm install
npm run dev          # Vite HMR, :5173
```

Vite proxies all `/socket.io` requests to `http://localhost:3000` so `VITE_BACKEND_URL` can stay empty.

Open `http://localhost:5173` in the sender's browser.  
Receivers on the same machine or LAN open the share link.

---

### 2 — Docker development (HMR + nodemon)

```bash
cp .env.frontend frontend/.env
cp .env.backend  backend/.env

docker compose --profile dev up
```

| Service | URL |
|---|---|
| Frontend (Vite HMR) | `http://localhost:5173` |
| Backend (nodemon) | `http://localhost:3000` |

Source files are bind-mounted into the frontend container — edits reflect instantly via HMR without rebuilding the image. The Vite proxy routes `/socket.io` to the `backend` container by service name.

---

### 3 — Production: static `dist` served from the backend

This is the setup you are using. The frontend is built into a `dist/` folder and the **Express server serves it as static files** — one process, one port.

**Step 1 — build the frontend**

```bash
cd frontend

# Set the backend URL to the machine's LAN IP
echo "VITE_BACKEND_URL=http://192.168.1.10:3000" > .env

npm run build        # outputs to frontend/dist/
```

**Step 2 — copy dist into the backend**

```bash
cp -r frontend/dist backend/dist
```

**Step 3 — add static serving to `server.js`**

```js
import { fileURLToPath } from 'url'
import { dirname, join }  from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Serve the built React app
app.use(express.static(join(__dirname, 'dist')))

// SPA fallback — send index.html for any non-API route
app.get('*', (_req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'))
})
```

Add those lines to `server.js` **before** `server.listen()`.

**Step 4 — run the backend**

```bash
cd backend
npm start            # :3000 serves both the API and the React app
```

Receivers on the LAN open `http://192.168.1.10:3000` — they get the React app and socket.io from the same origin, so no CORS issues and no need for `VITE_BACKEND_URL` to be set for socket connections (same-origin works automatically).

---

### 4 — Production: Docker (nginx frontend + Node backend)

```bash
# Set the LAN IP of the host machine
echo "BACKEND_URL=http://192.168.1.10:3000" >> .env
echo "CORS_ORIGIN=http://192.168.1.10" >> .env

docker compose --profile prod up --build
```

| Service | URL |
|---|---|
| Frontend (nginx) | `http://192.168.1.10:80` |
| Backend (node) | `http://192.168.1.10:3000` |

`VITE_BACKEND_URL` is injected as a build arg during `docker build` so it gets baked into the JS bundle. The browser then connects its socket directly to the backend on port 3000.

---

## WebRTC + signaling protocol

The server only passes three event types. All file data flows directly between browsers.

| Event | Direction | Payload | Purpose |
|---|---|---|---|
| `join` | client → server | `{ linkId, role }` | Join a session room as `sender` or `receiver` |
| `peer-joined` | server → client | `{ socketId, role }` | Notify room members of a new joiner |
| `signal` | client → server | `{ linkId, toSocketId, payload }` | Route an SDP offer/answer or ICE candidate to one specific peer |
| `signal` | server → client | `{ fromSocketId, payload }` | Deliver the signal to the target, with sender's socketId for reply routing |
| `peer-left` | server → client | `{ socketId, role }` | Notify when a peer disconnects |

### Why `toSocketId`?

The original single-receiver design broadcast signals to the whole room. With multiple receivers, each needs its own `RTCPeerConnection` with its own offer/answer/ICE exchange. Routing by `socketId` ensures each signal reaches exactly one peer without interfering with others.

---

## File + folder transfer

**Files**: select individual files via the picker or drag them onto the drop zone.

**Folders**: click "Select Folder" or drag a folder onto the drop zone. The browser uses the `webkitdirectory` API and `FileSystemDirectoryReader` to recursively read all files, preserving relative paths (e.g. `photos/2024/img001.jpg`). These paths are sent in the manifest so receivers see the full folder structure.

**Transfer protocol** (over the DataChannel):

```
sender → receiver:  { type: "manifest", files: [{path, name, size, type}, ...] }
sender → receiver:  { type: "start", index: 0 }
sender → receiver:  <ArrayBuffer chunk> × N
sender → receiver:  { type: "end", index: 0 }
... repeat for each file ...
sender → receiver:  { type: "all_done" }
```

Backpressure is handled via `bufferedAmountLowThreshold` — the sender pauses when the DataChannel buffer exceeds 512 KB and resumes when it drains, preventing memory exhaustion on large transfers.

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 |
| Build tool | Vite 7 |
| Styling | Tailwind CSS v4 (Vite plugin, no `tailwind.config.js`) |
| Routing | React Router v7 |
| Real-time transport | Socket.io v4 (signaling only) |
| Peer connection | WebRTC `RTCPeerConnection` + `RTCDataChannel` |
| Backend | Node 22, Express 4, Socket.io 4 |
| Dev server | nginx 1.27 (prod Docker), Vite dev server (dev) |
| Containers | Docker + Docker Compose v2 |
