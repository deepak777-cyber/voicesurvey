const mongoose = require("mongoose");

const responseSchema = new mongoose.Schema(
  {
    respid: {
      type: Number,
      required: true,
      unique: true, // optional: helps prevent duplicates
    },
    unique_id: {
      type: String,
      required: true,
      unique: true,
    },
    sys_start_time: Date,
    sys_end_time: Date,
    sys_device: String,
    survey_status: String,
    elapsed_time_in_second: String,
    language: String,
    // Dynamic fields like q1, q2 will be automatically handled by strict: false
  },
  { timestamps: true, strict: false }
);

module.exports = mongoose.model("surveydb", responseSchema);
