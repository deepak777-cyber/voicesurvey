const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const User = require("../models/User");

// Login without hashing
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await User.findOne({ username });

    if (!user) return res.status(400).json({ message: "User not found" });

    if (user.password !== password) {
      return res.status(401).json({ message: "Invalid password" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    res.json({ token });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Optional: Create plain-text user
router.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    const newUser = new User({ username, password }); // direct insert
    await newUser.save();
    res.json({ message: "User registered" });
  } catch (err) {
    res.status(500).json({ message: "Registration failed", error: err });
  }
});

module.exports = router;
