const mongoose = require("mongoose")
const bcrypt = require("bcryptjs")
const validator = require("validator")

const experienceSchema = new mongoose.Schema({
  title: { type: String, required: true },
  company: { type: String, required: true },
  from: { type: Date, required: true },
  to: { type: Date },
  current: { type: Boolean, default: false },
  description: String,
})

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      validate: [validator.isEmail, "Invalid email"],
    },
    phone: {
      type: String,
      unique: true,
      sparse: true,
      validate: {
        validator: (v) => validator.isMobilePhone(v, "any"),
        message: "Invalid phone number",
      },
    },
    passwordHash: {
      type: String,
      required: function () {
        return !this.googleId
      },
    },
    googleId: String,
    batch: {
      type: String,
      required: true,
    },
    center: {
      type: String,
      required: true,
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    experiences: [experienceSchema],
    bio: {
      type: String,
      maxlength: 500,
    },
    skills: [String],
    socialLinks: {
      linkedin: String,
      github: String,
      twitter: String,
    },
  },
  {
    timestamps: true,
  },
)

// Ensure at least email or phone is provided
userSchema.pre("validate", function (next) {
  if (!this.email && !this.phone) {
    next(new Error("Either email or phone number is required"))
  } else {
    next()
  }
})

userSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.passwordHash)
}

userSchema.pre("save", async function (next) {
  if (!this.isModified("passwordHash")) return next()

  try {
    const salt = await bcrypt.genSalt(10)
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt)
    next()
  } catch (error) {
    next(error)
  }
})

module.exports = mongoose.model("User", userSchema)
