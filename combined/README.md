# DropLink

A peer-to-peer file sharing app — share files and folders directly between browsers with no cloud storage, no size limits, and no accounts required. Files travel encrypted over a WebRTC data channel; the server never sees your data.

![Stack](https://img.shields.io/badge/React-19-61dafb?style=flat-square&logo=react) ![Vite](https://img.shields.io/badge/Vite-6-646cff?style=flat-square&logo=vite) ![Tailwind](https://img.shields.io/badge/Tailwind-3-38bdf8?style=flat-square&logo=tailwindcss) ![Socket.io](https://img.shields.io/badge/Socket.io-4-white?style=flat-square&logo=socket.io&logoColor=black)

---

## Features

- **File & folder upload** — select individual files or an entire folder; the full directory structure is preserved on the receiver's end
- **Drag and drop** — drop files or folders straight onto the drop zone
- **Shareable link** — one click generates a link; anyone with it can download
- **Multiple receivers** — the same link works for multiple people simultaneously, each gets their own direct P2P connection
- **Live transfer stats** — animated radial progress ring and a real-time speed sparkline chart
- **Per-file download** — receivers can save files individually as they arrive, without waiting for the full transfer
- **Download All** — one button to save everything at once
- **End-to-end encrypted** — WebRTC DataChannel encryption (DTLS), data never passes through the server

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 19 + Vite 6 |
| Styling | Tailwind CSS 3 |
| Routing | React Router 7 |
| Icons | Lucide React |
| Real-time signaling | Socket.io 4 (client + server) |
| P2P transport | WebRTC DataChannel |
| Backend server | Node.js + Express 4 |

---

## Project Structure

```
droplink/
├── index.html                  # Vite entry point
├── vite.config.js              # Dev proxy: /socket.io → :3000
├── tailwind.config.js
├── postcss.config.js
├── package.json
├── server.js                   # Signaling server (Express + Socket.io)
│
└── src/
    ├── main.jsx                # React root
    ├── App.jsx                 # Router setup
    ├── index.css               # Global styles + Tailwind directives
    │
    ├── pages/
    │   ├── SendPage.jsx        # Upload UI, link generation, transfer stats
    │   └── ReceivePage.jsx     # Download UI, per-file progress, save buttons
    │
    ├── components/
    │   ├── Logo.jsx            # DropLink logo mark
    │   ├── FileRow.jsx         # Table row: icon, name, progress bar, status badge
    │   ├── RadialProgress.jsx  # SVG donut chart showing overall % complete
    │   └── SpeedChart.jsx      # Bezier sparkline of transfer speed history
    │
    └── utils/
        └── index.js            # formatBytes, formatSpeed, generateId, file type helpers
```

---

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm 9 or later

### Installation

```bash
# Clone or extract the project
cd droplink

# Install all dependencies
npm install
```

### Development

Run the signaling server and the Vite dev server in two separate terminals:

```bash
# Terminal 1 — signaling server on port 3000
npm run server

# Terminal 2 — Vite dev server on port 5173
npm run dev
```

Then open http://localhost:5173.

The Vite dev server automatically proxies all `/socket.io` traffic to port 3000, so hot-reload and socket connections both work out of the box.

### Production

```bash
# Build the frontend and start the combined server
npm start
```

This runs `vite build` then starts the Express server which serves both the static frontend and the Socket.io signaling from a single process on port 3000.

Open http://localhost:3000.

To use a different port:

```bash
PORT=8080 npm start
```

---

## How It Works

DropLink uses WebRTC for direct browser-to-browser data transfer. The server's only job is to help the two peers find each other — a process called signaling.

```
Sender                     server.js                    Receiver
  │                       (port 3000)                       │
  │── join(linkId, sender) ──────────────────────────────►  │
  │                                                          │── join(linkId, receiver)
  │◄─ peer-joined ──────────────────────────────────────────│
  │                                                          │
  │── offer (SDP) ─────────────────────────────────────── ►│
  │◄─ answer (SDP) ─────────────────────────────────────────│
  │── ICE candidates ──────────────────────────────────── ►│
  │◄─ ICE candidates ───────────────────────────────────────│
  │                                                          │
  │◄══════════════ WebRTC DataChannel (direct) ════════════►│
  │                  all file bytes go here                  │
```

Once the DataChannel is open, the server is no longer involved. Files are split into 64 KB chunks, streamed through the channel with backpressure control, and reassembled in the receiver's browser as Blob objects ready for download.

---

## npm Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite dev server on port 5173 |
| `npm run build` | Build frontend into `dist/` |
| `npm run preview` | Preview the production build locally |
| `npm run server` | Start the signaling server on port 3000 |
| `npm start` | Build frontend then start the full production server |

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Port the production server listens on |

---

## Browser Support

Any modern browser with WebRTC DataChannel support — Chrome 56+, Firefox 44+, Edge 79+, Safari 15.4+. The `webkitdirectory` attribute used for folder uploads is supported in all major browsers.

---

## Extending the Backend

The `server.js` is intentionally minimal. Some things you may want to add:

- **Link expiry** — delete a room automatically after N minutes of inactivity
- **Multi-instance / Redis adapter** — for deploying behind a load balancer, swap in `socket.io-redis`
- **Auth tokens** — validate a JWT or shared secret before allowing a socket to join a room
- **TURN server** — WebRTC can fail to establish a direct connection through strict NATs or firewalls; a TURN relay fixes this (Twilio, Xirsys, or self-hosted coturn)
- **Rate limiting** — use `express-rate-limit` to prevent room spam

---

## License

MIT
