const path = require("path");
const http = require("http");
const socketio = require("socket.io");
const express = require("express");
const Filter = require("bad-words");
const {
    generateLocationMessage,
    generateMessages
} = require('./utils/messages')

const {
    addUser,
    removeUser,
    getUser,
    getUserInRoom
} = require('./utils/users')
const app = express();
const server = http.createServer(app);
const io = socketio(server);

const port = process.env.PORT || 3000;
const publicDirectoryPath = path.join(__dirname, "../public");

app.use(express.static(publicDirectoryPath));

io.on("connection", (socket) => {
    console.log("New WebSocket Connection");

    // join room
    socket.on('join', ({
        username,
        room
    }, callback) => {

        const {
            error,
            user
        } = addUser({
            id: socket.id,
            username,
            room
        })
        if (error) {
            return callback(error)
        }
        socket.join(user.room)
        socket.emit("message", generateMessages('Admin', 'Welcome!'));
        socket.broadcast.to(user.room).emit("message", generateMessages('Admin', `${user.username} has joined!`));
        io.to(user.room).emit('roomData', {
            room: user.room,
            users: getUserInRoom(user.room)
        })
        callback()

    })

    socket.on("sendMessage", (message, callback) => {
        const user = getUser(socket.id)
        const filter = new Filter();
        if (filter.isProfane(message)) {
            return callback("Profanity is not allowed");
        }
        io.to(user.room).emit("message", generateMessages(user.username, message));
        callback();
    });

    socket.on("sendLocation", (coords, callback) => {
        const user = getUser(socket.id)
        io.to(user.room).emit(
            "locationMessage",
            generateLocationMessage(user.username, `https://google.com/maps?q=${coords.latitude},${coords.longitude}`));
        callback();
    });
    // sending message when user has been left from the chatroom
    socket.on("disconnect", () => {
        const user = removeUser(socket.id)
        if (user) {
            io.to(user.room).emit("message", generateMessages('Admin', `${user.username} has left!`));
            io.to(user.room).emit('roomData', {
                room: user.room,
                users: getUserInRoom(user.room)
            })
        }
    });
});

server.listen(port, () => {
    console.log(`Server running at ${port}`);
});