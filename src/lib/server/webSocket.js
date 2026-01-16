import { Server } from 'socket.io';

export const configureServer = (server) => {
    const io = new Server(server);

    // Make io accessible globally for API routes
    global.io = io;

    // Track connected users: socketId -> userInfo
    const connectedUsers = new Map();

    // Helper to broadcast unique contributors in a room
    const broadcastContributors = (roomId, excludeSocketId = null) => {
        const sockets = io.sockets.adapter.rooms.get(roomId);
        if (!sockets) {
            io.to(roomId).emit('contributors-updated', []);
            return;
        }

        const contributors = [];
        const seenIds = new Set();

        for (const socketId of sockets) {
            if (socketId === excludeSocketId) continue;

            const userData = connectedUsers.get(socketId);
            if (userData) {
                // Deduplicate based on user ID if possible, otherwise just add
                // Assuming userData has an 'id' field
                if (userData.id && seenIds.has(userData.id)) {
                    continue;
                }
                if (userData.id) seenIds.add(userData.id);
                contributors.push(userData);
            }
        }

        io.to(roomId).emit('contributors-updated', contributors);
    };

    io.on('connection', (socket) => {
        console.log('Client connected', socket.id);

        socket.on('join-map', (mapId, user) => {
            if (mapId) {
                socket.join(mapId);
                console.log(`Socket ${socket.id} joined map ${mapId}`);

                // Store user info
                if (user) {
                    connectedUsers.set(socket.id, { ...user, socketId: socket.id });
                }

                broadcastContributors(mapId);
            }
        });

        socket.on('leave-map', (mapId) => {
            if (mapId) {
                socket.leave(mapId);
                broadcastContributors(mapId);
            }
        });

        socket.on('disconnecting', () => {
            const rooms = socket.rooms;
            rooms.forEach(room => {
                if (room !== socket.id) {
                    broadcastContributors(room, socket.id);
                }
            });
            connectedUsers.delete(socket.id);
        });

        socket.on('disconnect', () => {
            console.log('Client disconnected', socket.id);
        });
    });

    console.log('Socket.IO server configured');
    return io;
};
