const express = require("express")
const ChatRoom = require("../models/ChatRoom")
const Message = require("../models/Message")
const User = require("../models/User")
const { authenticate } = require("../middleware/auth")
const upload = require("../middleware/upload")

const router = express.Router()

// Get user's chat rooms
router.get("/rooms", authenticate, async (req, res) => {
  try {
    const rooms = await ChatRoom.find({
      members: req.user._id,
    })
      .populate("members", "name avatarUrl")
      .populate("lastMessage")
      .populate({
        path: "lastMessage",
        populate: {
          path: "sender",
          select: "name",
        },
      })
      .sort({ updatedAt: -1 })

    res.json({ rooms })
  } catch (error) {
    console.error("Get rooms error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Create chat room (direct or group)
router.post("/rooms", authenticate, async (req, res) => {
  try {
    const { name, memberIds, isGroup = false } = req.body

    if (!memberIds || memberIds.length === 0) {
      return res.status(400).json({ message: "At least one member is required" })
    }

    // Add current user to members
    const allMembers = [...new Set([req.user._id.toString(), ...memberIds])]

    // For direct chats, check if room already exists
    if (!isGroup && allMembers.length === 2) {
      const existingRoom = await ChatRoom.findOne({
        isGroup: false,
        members: { $all: allMembers, $size: 2 },
      })

      if (existingRoom) {
        await existingRoom.populate("members", "name avatarUrl")
        return res.json({ room: existingRoom })
      }
    }

    const room = new ChatRoom({
      name: name || (isGroup ? "Group Chat" : "Direct Chat"),
      members: allMembers,
      isGroup,
      admin: isGroup ? req.user._id : null,
    })

    await room.save()
    await room.populate("members", "name avatarUrl")

    res.status(201).json({ room })
  } catch (error) {
    console.error("Create room error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Get messages for a room
router.get("/rooms/:roomId/messages", authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query
    const { roomId } = req.params

    // Check if user is member of the room
    const room = await ChatRoom.findOne({
      _id: roomId,
      members: req.user._id,
    })

    if (!room) {
      return res.status(403).json({ message: "Access denied" })
    }

    const messages = await Message.find({ roomId })
      .populate("sender", "name avatarUrl")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)

    res.json({ messages: messages.reverse() })
  } catch (error) {
    console.error("Get messages error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Send message with media
router.post("/rooms/:roomId/messages", authenticate, upload.single("media"), async (req, res) => {
  try {
    const { roomId } = req.params
    const { text } = req.body

    // Check if user is member of the room
    const room = await ChatRoom.findOne({
      _id: roomId,
      members: req.user._id,
    })

    if (!room) {
      return res.status(403).json({ message: "Access denied" })
    }

    if (!text && !req.file) {
      return res.status(400).json({ message: "Message text or media is required" })
    }

    const messageData = {
      roomId,
      sender: req.user._id,
      text: text || "",
    }

    if (req.file) {
      messageData.mediaUrl = req.file.path // Cloudinary URL
      messageData.messageType = req.file.mimetype.startsWith("image/") ? "image" : "video"
    }

    const message = new Message(messageData)
    await message.save()
    await message.populate("sender", "name avatarUrl")

    // Update room's last message
    room.lastMessage = message._id
    room.updatedAt = new Date()
    await room.save()

    res.status(201).json({ message })
  } catch (error) {
    console.error("Send message error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Add members to group
router.post("/rooms/:roomId/members", authenticate, async (req, res) => {
  try {
    const { roomId } = req.params
    const { memberIds } = req.body

    const room = await ChatRoom.findOne({
      _id: roomId,
      admin: req.user._id,
      isGroup: true,
    })

    if (!room) {
      return res.status(403).json({ message: "Access denied or room not found" })
    }

    // Add new members
    const newMembers = memberIds.filter((id) => !room.members.includes(id))
    room.members.push(...newMembers)
    await room.save()

    await room.populate("members", "name avatarUrl")

    res.json({ room })
  } catch (error) {
    console.error("Add members error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Leave group
router.delete("/rooms/:roomId/leave", authenticate, async (req, res) => {
  try {
    const { roomId } = req.params

    const room = await ChatRoom.findById(roomId)

    if (!room || !room.members.includes(req.user._id)) {
      return res.status(404).json({ message: "Room not found" })
    }

    // Remove user from members
    room.members = room.members.filter((id) => id.toString() !== req.user._id.toString())

    // If admin leaves, assign new admin
    if (room.admin && room.admin.toString() === req.user._id.toString() && room.members.length > 0) {
      room.admin = room.members[0]
    }

    // Delete room if no members left
    if (room.members.length === 0) {
      await ChatRoom.findByIdAndDelete(roomId)
      await Message.deleteMany({ roomId })
    } else {
      await room.save()
    }

    res.json({ message: "Left room successfully" })
  } catch (error) {
    console.error("Leave room error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router
