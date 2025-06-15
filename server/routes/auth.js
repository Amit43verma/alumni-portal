const express = require("express")
const jwt = require("jsonwebtoken")
const { OAuth2Client } = require("google-auth-library")
const User = require("../models/User")
const { authenticate } = require("../middleware/auth")

const router = express.Router()
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: "7d" })
}

// Signup
router.post("/signup", async (req, res) => {
  try {
    const { name, email, phone, password, batch, center } = req.body

    // Validate required fields
    if (!name || !password || !batch || !center) {
      return res.status(400).json({ message: "Name, password, batch, and center are required" })
    }

    if (!email && !phone) {
      return res.status(400).json({ message: "Either email or phone number is required" })
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [...(email ? [{ email }] : []), ...(phone ? [{ phone }] : [])],
    })

    if (existingUser) {
      return res.status(400).json({ message: "User already exists with this email or phone" })
    }

    const user = new User({
      name,
      email,
      phone,
      passwordHash: password,
      batch,
      center,
    })

    await user.save()

    const token = generateToken(user._id)

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        batch: user.batch,
        center: user.center,
        avatarUrl: user.avatarUrl,
      },
    })
  } catch (error) {
    console.error("Signup error:", error)
    res.status(500).json({ message: error.message || "Server error" })
  }
})

// Login
router.post("/login", async (req, res) => {
  try {
    const { identifier, password } = req.body // identifier can be email or phone

    if (!identifier || !password) {
      return res.status(400).json({ message: "Email/phone and password are required" })
    }

    // Find user by email or phone
    const user = await User.findOne({
      $or: [{ email: identifier }, { phone: identifier }],
    })

    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" })
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" })
    }

    const token = generateToken(user._id)

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        batch: user.batch,
        center: user.center,
        avatarUrl: user.avatarUrl,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Google OAuth
router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body

    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    })

    const payload = ticket.getPayload()
    const { sub: googleId, email, name, picture } = payload

    let user = await User.findOne({ googleId })

    if (!user) {
      // Check if user exists with this email
      user = await User.findOne({ email })

      if (user) {
        // Link Google account to existing user
        user.googleId = googleId
        if (!user.avatarUrl) user.avatarUrl = picture
        await user.save()
      } else {
        // Create new user - but require additional info
        return res.status(400).json({
          message: "Additional information required",
          needsRegistration: true,
          googleData: { googleId, email, name, picture },
        })
      }
    }

    const token = generateToken(user._id)

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        batch: user.batch,
        center: user.center,
        avatarUrl: user.avatarUrl,
      },
    })
  } catch (error) {
    console.error("Google auth error:", error)
    res.status(500).json({ message: "Google authentication failed" })
  }
})

// Complete Google registration
router.post("/google/complete", async (req, res) => {
  try {
    const { googleId, email, name, picture, batch, center, phone } = req.body

    if (!batch || !center) {
      return res.status(400).json({ message: "Batch and center are required" })
    }

    const user = new User({
      name,
      email,
      phone,
      googleId,
      batch,
      center,
      avatarUrl: picture || "",
    })

    await user.save()

    const token = generateToken(user._id)

    res.status(201).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        batch: user.batch,
        center: user.center,
        avatarUrl: user.avatarUrl,
      },
    })
  } catch (error) {
    console.error("Google registration completion error:", error)
    res.status(500).json({ message: "Registration completion failed" })
  }
})

// Get current user
router.get("/me", authenticate, async (req, res) => {
  res.json({
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      phone: req.user.phone,
      batch: req.user.batch,
      center: req.user.center,
      avatarUrl: req.user.avatarUrl,
      bio: req.user.bio,
      skills: req.user.skills,
      socialLinks: req.user.socialLinks,
    },
  })
})

module.exports = router
