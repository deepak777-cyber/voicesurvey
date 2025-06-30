require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

console.log("MONGO_URI from .env:", process.env.MONGO_URI); // TEMP DEBUG

const surveyRoutes = require('./routes/surveyRoutes');
const auth = require("./routes/auth");

const app = express();

// ✅ Define allowed frontend origins
const allowedOrigins = [
  "http://localhost:5173", // Allow Vite dev server
  "http://localhost:8080",
  "https://chhatsurvey.excavateservices.com",
  "https://testingchhatsurvey.excavateservices.com"
];

// ✅ Setup CORS with dynamic origin validation
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));

// ✅ Optional: Log preflight OPTIONS requests for debugging
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    console.log("CORS Preflight for:", req.path);
  }
  next();
});

// ✅ Parse JSON request bodies (must come after CORS)
app.use(express.json());

// ✅ Mount routes after middleware
app.use('/api/survey', surveyRoutes);
app.use('/api/auth', auth);

// ✅ Root route
app.get('/', (req, res) => {
  res.send('Welcome to the Survey API');
});

// ✅ Connect to MongoDB and start server
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("MongoDB connected");
  app.listen(process.env.PORT, () =>
    console.log(`Server running on port ${process.env.PORT}`)
  );
}).catch(err => console.error(err));
