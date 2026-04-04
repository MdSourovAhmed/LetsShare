/**
 * DropLink — Signaling Server
 * Only exchanges WebRTC SDP/ICE metadata. No file data passes through here.
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
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

// Serve built frontend
app.use(express.static(join(__dirname, 'dist')));
app.get('*', (_req, res) => res.sendFile(join(__dirname, 'dist', 'index.html')));

// rooms: linkId → { sender: socketId | null, receivers: Set<socketId> }
const rooms = new Map();

io.on('connection', (socket) => {
  console.log(`[+] ${socket.id}`);

  socket.on('join', ({ linkId, role }) => {
    if (!linkId || !role) return;
    socket.join(linkId);

    if (!rooms.has(linkId)) rooms.set(linkId, { sender: null, receivers: new Set() });
    const room = rooms.get(linkId);

    if (role === 'sender') {
      room.sender = socket.id;
      console.log(`[sender]   room=${linkId}`);
    } else {
      room.receivers.add(socket.id);
      console.log(`[receiver] room=${linkId}`);

      // Tell sender a receiver joined
      if (room.sender) io.to(room.sender).emit('peer-joined', { role: 'receiver' });
    }
  });

  socket.on('signal', ({ linkId, payload }) => {
    if (!linkId || !payload) return;
    const room = rooms.get(linkId);
    if (!room) return;

    if (socket.id === room.sender) {
      // Sender → all receivers
      room.receivers.forEach(id => io.to(id).emit('signal', payload));
    } else {
      // Receiver → sender
      if (room.sender) io.to(room.sender).emit('signal', payload);
    }
  });

  socket.on('disconnect', () => {
    console.log(`[-] ${socket.id}`);
    for (const [linkId, room] of rooms.entries()) {
      if (room.sender === socket.id) {
        room.sender = null;
        room.receivers.forEach(id => io.to(id).emit('signal', { type: 'sender-disconnected' }));
      }
      room.receivers.delete(socket.id);
      if (!room.sender && room.receivers.size === 0) rooms.delete(linkId);
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`\n🚀 DropLink ready at http://localhost:${PORT}\n`);
});
