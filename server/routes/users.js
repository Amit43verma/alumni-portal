const express = require("express")
const User = require("../models/User")
const { authenticate } = require("../middleware/auth")
const upload = require("../middleware/upload")

const router = express.Router()

// Search users
router.get("/", authenticate, async (req, res) => {
  try {
    const { name, batch, center, page = 1, limit = 10 } = req.query

    const query = { _id: { $ne: req.user._id } } // Exclude current user
    if (name) {
      query.name = { $regex: name, $options: "i" }
    }
    if (batch) query.batch = batch
    if (center) query.center = center

    const users = await User.find(query)
      .select("name email batch center avatarUrl bio")
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ name: 1 })

    const total = await User.countDocuments(query)

    res.json({
      users,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    })
  } catch (error) {
    console.error("Search users error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Get user profile
router.get("/:id", authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash").populate("experiences")

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({ user })
  } catch (error) {
    console.error("Get user error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

// Update user profile
router.put("/:id", authenticate, upload.single("avatar"), async (req, res) => {
  try {
    if (req.params.id !== req.user._id.toString()) {
      return res.status(403).json({ message: "Access denied" })
    }

    const updates = req.body

    // Handle avatar upload
    if (req.file) {
      updates.avatarUrl = req.file.path // Cloudinary URL
    }

    // Parse experiences if it's a string
    if (updates.experiences && typeof updates.experiences === "string") {
      updates.experiences = JSON.parse(updates.experiences)
    }

    // Parse skills if it's a string
    if (updates.skills && typeof updates.skills === "string") {
      updates.skills = JSON.parse(updates.skills)
    }

    // Parse socialLinks if it's a string
    if (updates.socialLinks && typeof updates.socialLinks === "string") {
      updates.socialLinks = JSON.parse(updates.socialLinks)
    }

    const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).select(
      "-passwordHash",
    )

    if (!user) {
      return res.status(404).json({ message: "User not found" })
    }

    res.json({ user })
  } catch (error) {
    console.error("Update user error:", error)
    res.status(500).json({ message: error.message || "Server error" })
  }
})

// Get all batches and centers for filters
router.get("/meta/options", authenticate, async (req, res) => {
  try {
    const batches = await User.distinct("batch")
    const centers = await User.distinct("center")

    res.json({ batches, centers })
  } catch (error) {
    console.error("Get meta options error:", error)
    res.status(500).json({ message: "Server error" })
  }
})

module.exports = router
