const express = require('express');
const router = express.Router();
const SurveyResponse = require('../models/SurveyResponse');

router.post('/save', async (req, res) => {
  try {
    const responseData = {
      unique_id: req.body.unique_id,
      sys_start_time: req.body.sys_start_time,
      sys_end_time: new Date(),
      sys_device: req.body.sys_device,
      survey_status: req.body.survey_status || 'completed',
      elapsed_time: req.body.elapsed_time,
      language: req.body.language,
      responses: req.body.responses
    };

    const newResponse = new SurveyResponse(responseData);
    await newResponse.save();

    res.status(201).json({ message: "Survey saved successfully." });
  } catch (error) {
    console.error("Error saving survey:", error);
    res.status(500).json({ error: "Failed to save survey response." });
  }
});

module.exports = router;
