import { create } from "zustand"
import axios from "axios"
import toast from "react-hot-toast"

// Use Vite environment variables
const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api"

const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
  loading: false,

  login: async (identifier, password) => {
    set({ loading: true })
    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        identifier,
        password,
      })

      const { token, user } = response.data

      localStorage.setItem("token", token)
      localStorage.setItem("user", JSON.stringify(user))

      // Set default axios header
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`

      set({ user, token, loading: false })
      toast.success("Login successful!")

      return { success: true }
    } catch (error) {
      set({ loading: false })
      const message = error.response?.data?.message || "Login failed"
      toast.error(message)
      return { success: false, message }
    }
  },

  signup: async (userData) => {
    set({ loading: true })
    try {
      const response = await axios.post(`${API_URL}/auth/signup`, userData)

      const { token, user } = response.data

      localStorage.setItem("token", token)
      localStorage.setItem("user", JSON.stringify(user))

      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`

      set({ user, token, loading: false })
      toast.success("Account created successfully!")

      return { success: true }
    } catch (error) {
      set({ loading: false })
      const message = error.response?.data?.message || "Signup failed"
      toast.error(message)
      return { success: false, message }
    }
  },

  googleAuth: async (idToken) => {
    set({ loading: true })
    try {
      const response = await axios.post(`${API_URL}/auth/google`, { idToken })

      if (response.data.needsRegistration) {
        set({ loading: false })
        return {
          success: false,
          needsRegistration: true,
          googleData: response.data.googleData,
        }
      }

      const { token, user } = response.data

      localStorage.setItem("token", token)
      localStorage.setItem("user", JSON.stringify(user))

      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`

      set({ user, token, loading: false })
      toast.success("Login successful!")

      return { success: true }
    } catch (error) {
      set({ loading: false })
      const message = error.response?.data?.message || "Google authentication failed"
      toast.error(message)
      return { success: false, message }
    }
  },

  completeGoogleSignup: async (googleData, additionalData) => {
    set({ loading: true })
    try {
      const response = await axios.post(`${API_URL}/auth/google/complete`, {
        ...googleData,
        ...additionalData,
      })

      const { token, user } = response.data

      localStorage.setItem("token", token)
      localStorage.setItem("user", JSON.stringify(user))

      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`

      set({ user, token, loading: false })
      toast.success("Account created successfully!")

      return { success: true }
    } catch (error) {
      set({ loading: false })
      const message = error.response?.data?.message || "Registration failed"
      toast.error(message)
      return { success: false, message }
    }
  },

  logout: () => {
    localStorage.removeItem("token")
    localStorage.removeItem("user")
    delete axios.defaults.headers.common["Authorization"]
    set({ user: null, token: null })
    toast.success("Logged out successfully")
  },

  loadFromStorage: () => {
    const token = localStorage.getItem("token")
    const user = localStorage.getItem("user")

    if (token && user) {
      try {
        const parsedUser = JSON.parse(user)
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`
        set({ user: parsedUser, token })
      } catch (error) {
        console.error("Error parsing stored user data:", error)
        localStorage.removeItem("token")
        localStorage.removeItem("user")
      }
    }
  },

  updateUser: (userData) => {
    const updatedUser = { ...get().user, ...userData }
    localStorage.setItem("user", JSON.stringify(updatedUser))
    set({ user: updatedUser })
  },
}))

export { useAuthStore }
