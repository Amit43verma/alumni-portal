const express = require("express")
const mongoose = require("mongoose")
const cors = require("cors")
const { createServer } = require("http")
const { Server } = require("socket.io")
require("dotenv").config()

const authRoutes = require("./routes/auth")
const userRoutes = require("./routes/users")
const postRoutes = require("./routes/posts")
const chatRoutes = require("./routes/chat")
const { authenticateSocket } = require("./middleware/auth")
const Post = require("./models/Post")
const Comment = require("./models/Comment")

const app = express()
const httpServer = createServer(app)

// Socket.io setup
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    methods: ["GET", "POST"],
  },
})

// Middleware
app.use(cors())
app.use(express.json())
app.use("/uploads", express.static("uploads"))

// Database connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.error("MongoDB connection error:", err))

// Routes
app.use("/api/auth", authRoutes)
app.use("/api/users", userRoutes)
app.use("/api/posts", postRoutes)
app.use("/api/chat", chatRoutes)

// Attach io to app for access in routes
app.set('io', io)

// Socket.io connection handling
io.use(authenticateSocket)

io.on("connection", (socket) => {
  console.log("User connected:", socket.userId)

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId)
    console.log(`User ${socket.userId} joined room ${roomId}`)
  })

  socket.on("leaveRoom", (roomId) => {
    socket.leave(roomId)
    console.log(`User ${socket.userId} left room ${roomId}`)
  })

  socket.on("sendMessage", async (data) => {
    try {
      const { roomId, text, mediaUrl } = data
      const Message = require("./models/Message")
      const ChatRoom = require("./models/ChatRoom")

      const message = await Message.create({
        roomId,
        sender: socket.userId,
        text,
        mediaUrl,
        messageType: mediaUrl ? (mediaUrl.match(/\.(jpeg|jpg|gif|png)$/) ? "image" : "video") : "text",
      })

      await message.populate("sender", "name avatarUrl")

      // Update room's last message
      await ChatRoom.findByIdAndUpdate(roomId, {
        lastMessage: message._id,
        updatedAt: new Date(),
      })

      io.to(roomId).emit("newMessage", message)
    } catch (error) {
      console.error("Send message error:", error)
      socket.emit("error", { message: "Failed to send message" })
    }
  })

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.userId)
  })

  // Post and comment like events
  socket.on("joinPost", (postId) => {
    socket.join(`post:${postId}`)
    console.log(`User ${socket.userId} joined post ${postId}`)
  })

  socket.on("leavePost", (postId) => {
    socket.leave(`post:${postId}`)
    console.log(`User ${socket.userId} left post ${postId}`)
  })

  socket.on("postLiked", async (data) => {
    const { postId } = data
    try {
      const post = await Post.findById(postId)
      const likedUserIds = post.likes.map(id => id.toString())
      const likesCount = post.likes.length
      io.to(`post:${postId}`).emit("postLikeUpdate", { postId, likesCount, likedUserIds })
    } catch (err) {
      console.error("Error in postLiked socket event:", err)
    }
  })

  socket.on("commentLiked", async (data) => {
    const { commentId, postId } = data
    try {
      const comment = await Comment.findById(commentId)
      const likedUserIds = comment.likes.map(id => id.toString())
      const likesCount = comment.likes.length
      io.to(`post:${postId}`).emit("commentLikeUpdate", { commentId, likesCount, likedUserIds })
    } catch (err) {
      console.error("Error in commentLiked socket event:", err)
    }
  })
})

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack)
  res.status(500).json({ message: "Something went wrong!" })
})

// 404 handler
app.use("*", (req, res) => {
  res.status(404).json({ message: "Route not found" })
})

const PORT = process.env.PORT || 5000
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
