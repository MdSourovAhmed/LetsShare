// const express = require("express");
// const http    = require("http");
// const path    = require("path");
// const { Server } = require("socket.io");

// const app    = express();
// const server = http.createServer(app);
// const PORT = process.env.PORT || 5000;

// const io = new Server(server, {
//   cors: {
//     origin: ["http://localhost:5173", "http://localhost:5174"],
//     methods: ["GET", "POST"],
//   },
//   maxHttpBufferSize: 1e8, // 100 MB — headroom for large transfers
// });

// // ── Static frontend ───────────────────────────────────────────────────────────
// app.use(express.static(path.join(__dirname, "dist")));

// // SPA fallback — let React Router handle unknown paths
// app.use((_req, res) => {
//   res.sendFile(path.join(__dirname, "dist", "index.html"));
// });

// // ── Signaling ─────────────────────────────────────────────────────────────────
// io.on("connection", (socket) => {
//   console.log("Client connected:", socket.id);

//   socket.on("join", ({ linkId, role } = {}) => {
//     if (!linkId || !role) return;

//     socket.join(linkId);
//     socket.data = { linkId, role };
//     console.log(`[${socket.id}] ${role} joined room ${linkId}`);

//     // ✅ Include socketId so the sender knows which peer just joined
//     //    and can open a dedicated RTCPeerConnection for them
//     socket.to(linkId).emit("peer-joined", {
//       socketId: socket.id,
//       role,
//     });
//   });

//   socket.on("signal", ({ linkId, toSocketId, payload } = {}) => {
//     if (!linkId || !toSocketId || !payload) return;

//     // ✅ Route directly to one specific peer instead of broadcasting to the room
//     //    This is what allows N receivers to each have their own WebRTC handshake
//     io.to(toSocketId).emit("signal", {
//       fromSocketId: socket.id,
//       payload,
//     });
//   });

//   socket.on("disconnect", () => {
//     const { linkId, role } = socket.data || {};
//     if (linkId) {
//       // ✅ Include socketId so the frontend knows which peer left
//       socket.to(linkId).emit("peer-left", { socketId: socket.id, role });
//     }
//     console.log("Client disconnected:", socket.id);
//   });
// });

// // ── Start ─────────────────────────────────────────────────────────────────────

// server.listen(PORT, () => {
//   console.log(`Server running at http://localhost:${PORT}`);
// });




const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");
const { Bonjour } = require("bonjour-service");

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;

// ── mDNS (Bonjour) ────────────────────────────────────────────────────────────
const bonjour = new Bonjour();

bonjour.publish({
  name: "LetsShare",
  type: "http",
  port: PORT,
});

console.log(`mDNS: advertising LetsShare at http://letsshare.local:${PORT}`);

// Graceful shutdown (IMPORTANT — prevents ghost services)
process.on("SIGINT", () => {
  bonjour.unpublishAll(() => {
    bonjour.destroy();
    process.exit(0);
  });
});

// ── Socket.IO ─────────────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"],
  },
  maxHttpBufferSize: 1e8,
});

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  socket.on("join", ({ linkId, role } = {}) => {
    if (!linkId || !role) return;

    socket.join(linkId);
    socket.data = { linkId, role };

    console.log(`[${socket.id}] ${role} joined room ${linkId}`);

    socket.to(linkId).emit("peer-joined", {
      socketId: socket.id,
      role,
    });
  });

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
      socket.to(linkId).emit("peer-left", {
        socketId: socket.id,
        role,
      });
    }

    console.log("Client disconnected:", socket.id);
  });
});

// ── Static frontend ───────────────────────────────────────────────────────────
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// Better SPA fallback (fixes edge cases)
// app.get("*", (_req, res) => {
//   res.sendFile(path.join(distPath, "index.html"));
// });

app.get(/^\/(?!socket\.io).*/, (_req, res) => {
  res.sendFile(path.join(__dirname, "dist", "index.html"));
});

// ── Start ─────────────────────────────────────────────────────────────────────
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running at http://localhost:${PORT}`);
});