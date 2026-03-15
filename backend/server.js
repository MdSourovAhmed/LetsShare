import express from "express";
import http from "http";
import { Server } from "socket.io";
import path from "path";
const app = express();
const server = http.createServer(app);

// ── Socket.io ────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || "*",
    methods: ["GET", "POST"],
  },
  // Increase limits for large binary transfers over slow LAN
  maxHttpBufferSize: 1e8, // 100 MB
});

// ── Health check (useful for Docker / load balancer) ─────────────────────────
app.get("/health", (_req, res) => res.json({ status: "ok" }));

//── Serving a static fronend ─────────────────────────
const __dirname = path.resolve();
app.use(express.static(path.join(__dirname, "../frontend/dist")));
app.use("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend", "dist", "index.html"));
});

// ── Signaling ─────────────────────────────────────────────────────────────────
io.on("connection", (socket) => {
  console.log(`Connection opened for ${socket.id}...`);

  // Join a session room as either 'sender' or 'receiver'
  socket.on("join", ({ linkId, role } = {}) => {
    if (!linkId || !role) return;
    console.log(`The ${role} joined with id: ${linkId}...`);

    socket.join(linkId);
    socket.data = { linkId, role };
    console.log({ linkId, role });

    // Notify every OTHER member: include the joiner's socketId so the
    // sender can open a dedicated RTCPeerConnection per receiver.
    socket.to(linkId).emit("peer-joined", {
      socketId: socket.id,
      role,
    });
  });

  // Route a WebRTC signal (offer / answer / ICE) to a specific peer.
  // toSocketId lets sender → receiver and receiver → sender communicate
  // without broadcasting to the whole room.
  socket.on("signal", ({ linkId, toSocketId, payload } = {}) => {
    if (!linkId || !toSocketId || !payload) return;

    io.to(toSocketId).emit("signal", {
      fromSocketId: socket.id,
      payload,
    });
  });

  socket.on("disconnect", () => {
    const { linkId, role } = socket.data || {};
    if (linkId) {
      console.log(`The ${role} left with id: ${linkId}...`);
      socket.to(linkId).emit("peer-left", { socketId: socket.id, role });
    }
  });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Signaling server listening on :${PORT}`);
});

// ── Graceful shutdown ─────────────────────────────────────────────────────────
function shutdown(signal) {
  console.log(`\n${signal} received — shutting down`);
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
