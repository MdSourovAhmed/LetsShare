/**
 * DropLink — Signaling Server
 * Handles WebRTC peer signaling only. No file data passes through this server.
 *
 * Usage:
 *   node server.js
 *   PORT=3000 node server.js
 */

import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 5000;

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

// Serve the built frontend
app.use(express.static(join(__dirname, 'dist')));

// SPA fallback — return index.html for all non-API routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// ──────────────────────────────────────────────────
// Signaling rooms
// ──────────────────────────────────────────────────
// Each room: { sender: socketId | null, receivers: Set<socketId> }
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`[+] Socket connected: ${socket.id}`);

  socket.on('join', ({ linkId, role }) => {
    if (!linkId || !role) return;

    socket.join(linkId);
    console.log(`[→] ${role} joined room: ${linkId}`);

    if (!rooms.has(linkId)) {
      rooms.set(linkId, { sender: null, receivers: new Set() });
    }

    const room = rooms.get(linkId);

    if (role === 'sender') {
      room.sender = socket.id;
    } else if (role === 'receiver') {
      room.receivers.add(socket.id);

      // Notify sender that a receiver has joined
      if (room.sender) {
        io.to(room.sender).emit('peer-joined', { role: 'receiver', socketId: socket.id });
      }

      // Notify all receivers that a sender exists
      if (room.sender) {
        socket.emit('peer-joined', { role: 'sender' });
      }
    }
  });

  socket.on('signal', ({ linkId, payload }) => {
    if (!linkId || !payload) return;

    const room = rooms.get(linkId);
    if (!room) return;

    // Route signal to the appropriate peer
    if (payload.type === 'offer' || payload.type === 'ice' && socket.id === room.sender) {
      // Sender → broadcast to all receivers
      room.receivers.forEach(receiverId => {
        io.to(receiverId).emit('signal', payload);
      });
    } else if (payload.type === 'answer' || payload.type === 'ice') {
      // Receiver → forward to sender
      if (room.sender) {
        io.to(room.sender).emit('signal', payload);
      }
    }
  });

  socket.on('disconnect', () => {
    console.log(`[-] Socket disconnected: ${socket.id}`);

    // Clean up rooms
    for (const [linkId, room] of rooms.entries()) {
      if (room.sender === socket.id) {
        room.sender = null;
        // Notify receivers that sender left
        room.receivers.forEach(receiverId => {
          io.to(receiverId).emit('signal', { type: 'sender-disconnected' });
        });
      }
      room.receivers.delete(socket.id);

      // Remove empty rooms
      if (!room.sender && room.receivers.size === 0) {
        rooms.delete(linkId);
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n🚀 DropLink server running at http://localhost:${PORT}`);
  console.log(`   Press Ctrl+C to stop\n`);
});
