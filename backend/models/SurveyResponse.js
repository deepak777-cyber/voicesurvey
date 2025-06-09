const mongoose = require("mongoose");

const responseSchema = new mongoose.Schema(
  {
    unique_id: String,
    sys_start_time: Date,
    sys_end_time: Date,
    sys_device: String,
    survey_status: String,
    elapsed_time: Number,
    language: String,
    // Dynamic fields like q1, q2 will be automatically handled by strict: false
  },
  { timestamps: true, strict: false }
);

module.exports = mongoose.model("SurveyResponse", responseSchema);
