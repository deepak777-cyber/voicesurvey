const mongoose = require('mongoose');

const responseSchema = new mongoose.Schema({
  unique_id: String,
  sys_start_time: Date,
  sys_end_time: Date,
  sys_device: String,
  survey_status: String,
  elapsed_time: Number,
  language: String,
  responses: [
    {
      questionId: String,
      answer: String
    }
  ]
}, { timestamps: true });

module.exports = mongoose.model('SurveyResponse', responseSchema);
