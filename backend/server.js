require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

console.log("MONGO_URI from .env:", process.env.MONGO_URI); // TEMP DEBUG

const surveyRoutes = require('./routes/surveyRoutes');
const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/survey', surveyRoutes);

app.get('/', (req, res) => {
  res.send('Welcome to the Survey API');
});

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log("MongoDB connected");
  app.listen(process.env.PORT, () =>
    console.log(`Server running on port ${process.env.PORT}`)
  );
}).catch(err => console.error(err));
