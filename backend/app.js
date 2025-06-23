const express = require("express");
const cors = require("cors");
const surveyRoutes = require("./routes/survey");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public")); // Serve static files from public directory

// Routes
app.use("/api/survey", surveyRoutes);

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something broke!" });
});

module.exports = app;
