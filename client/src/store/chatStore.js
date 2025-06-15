import { create } from "zustand"
import { io } from "socket.io-client"
import axios from "axios"
import toast from "react-hot-toast"

// Use Vite environment variables
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api"
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000"

const useChatStore = create((set, get) => ({
  socket: null,
  rooms: [],
  currentRoom: null,
  messages: [],
  onlineUsers: new Set(),
  loading: false,

  initializeSocket: () => {
    const token = localStorage.getItem("token")
    if (!token) return

    const socket = io(SOCKET_URL, {
      auth: { token },
    })

    socket.on("connect", () => {
      console.log("Connected to chat server")
    })

    socket.on("newMessage", (message) => {
      set((state) => {
        // Only add message if it's for the current room
        if (state.currentRoom && message.roomId === state.currentRoom._id) {
          return {
            messages: [...state.messages, message],
          }
        }
        return state
      })

      // Update room's last message
      set((state) => ({
        rooms: state.rooms.map((room) =>
          room._id === message.roomId ? { ...room, lastMessage: message, updatedAt: new Date() } : room,
        ),
      }))
    })

    socket.on("userOnline", (userId) => {
      set((state) => ({
        onlineUsers: new Set([...state.onlineUsers, userId]),
      }))
    })

    socket.on("userOffline", (userId) => {
      set((state) => {
        const newOnlineUsers = new Set(state.onlineUsers)
        newOnlineUsers.delete(userId)
        return { onlineUsers: newOnlineUsers }
      })
    })

    socket.on("error", (error) => {
      toast.error(error.message || "Chat error occurred")
    })

    set({ socket })
  },

  disconnectSocket: () => {
    const { socket } = get()
    if (socket) {
      socket.disconnect()
      set({ socket: null, onlineUsers: new Set() })
    }
  },

  loadRooms: async () => {
    set({ loading: true })
    try {
      const response = await axios.get(`${API_URL}/chat/rooms`)
      set({ rooms: response.data.rooms, loading: false })
    } catch (error) {
      set({ loading: false })
      toast.error("Failed to load chat rooms")
    }
  },

  createRoom: async (name, memberIds, isGroup = false) => {
    try {
      const response = await axios.post(`${API_URL}/chat/rooms`, {
        name,
        memberIds,
        isGroup,
      })

      const { room } = response.data

      set((state) => ({
        rooms: [room, ...state.rooms],
      }))

      return { success: true, room }
    } catch (error) {
      const message = error.response?.data?.message || "Failed to create chat room"
      toast.error(message)
      return { success: false }
    }
  },

  joinRoom: (roomId) => {
    const { socket, rooms } = get()
    const room = rooms.find((r) => r._id === roomId)

    if (socket && room) {
      socket.emit("joinRoom", roomId)
      set({ currentRoom: room, messages: [] })
      get().loadMessages(roomId)
    }
  },

  leaveRoom: () => {
    const { socket, currentRoom } = get()

    if (socket && currentRoom) {
      socket.emit("leaveRoom", currentRoom._id)
      set({ currentRoom: null, messages: [] })
    }
  },

  loadMessages: async (roomId, page = 1) => {
    try {
      const response = await axios.get(`${API_URL}/chat/rooms/${roomId}/messages?page=${page}&limit=50`)
      const { messages } = response.data

      set((state) => ({
        messages: page === 1 ? messages : [...messages, ...state.messages],
      }))
    } catch (error) {
      toast.error("Failed to load messages")
    }
  },

  sendMessage: async (text, mediaFile = null) => {
    const { socket, currentRoom } = get()

    if (!socket || !currentRoom) return

    try {
      if (mediaFile) {
        // Send message with media via HTTP
        const formData = new FormData()
        formData.append("text", text)
        formData.append("media", mediaFile)

        await axios.post(`${API_URL}/chat/rooms/${currentRoom._id}/messages`, formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        })
      } else {
        // Send text message via socket
        socket.emit("sendMessage", {
          roomId: currentRoom._id,
          text,
        })
      }

      return { success: true }
    } catch (error) {
      toast.error("Failed to send message")
      return { success: false }
    }
  },

  addMembersToGroup: async (roomId, memberIds) => {
    try {
      const response = await axios.post(`${API_URL}/chat/rooms/${roomId}/members`, {
        memberIds,
      })

      const { room } = response.data

      set((state) => ({
        rooms: state.rooms.map((r) => (r._id === roomId ? room : r)),
        currentRoom: state.currentRoom?._id === roomId ? room : state.currentRoom,
      }))

      toast.success("Members added successfully")
      return { success: true }
    } catch (error) {
      toast.error("Failed to add members")
      return { success: false }
    }
  },

  leaveGroup: async (roomId) => {
    try {
      await axios.delete(`${API_URL}/chat/rooms/${roomId}/leave`)

      set((state) => ({
        rooms: state.rooms.filter((room) => room._id !== roomId),
        currentRoom: state.currentRoom?._id === roomId ? null : state.currentRoom,
        messages: state.currentRoom?._id === roomId ? [] : state.messages,
      }))

      toast.success("Left group successfully")
      return { success: true }
    } catch (error) {
      toast.error("Failed to leave group")
      return { success: false }
    }
  },
}))

export { useChatStore }
