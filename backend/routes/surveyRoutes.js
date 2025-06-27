const express = require("express");
const router = express.Router();
const SurveyResponse = require("../models/SurveyResponse");

router.post("/save", async (req, res) => {
  try {
    console.log("Received survey data:", req.body); // Debug log

    // Extract system fields
    const {
      unique_id,
      sys_start_time,
      sys_end_time,
      sys_device,
      survey_status,
      elapsed_time,
      language,
      ...questionResponses // This will contain all the q1, q2, q4_1, q4_2, etc. fields
    } = req.body;

    // Create response data object
    const responseData = {
      unique_id,
      sys_start_time,
      sys_end_time: sys_end_time || new Date(),
      sys_device,
      survey_status: survey_status || "completed",
      elapsed_time,
      language,
      ...questionResponses, // All question responses including numbered multi-select answers
    };

    console.log("Saving survey data:", responseData); // Debug log

    const newResponse = new SurveyResponse(responseData);
    const savedResponse = await newResponse.save();

    console.log("Saved survey response:", savedResponse); // Debug log

    res.status(201).json({
      message: "Survey saved successfully.",
      savedData: savedResponse,
    });
  } catch (error) {
    console.error("Error saving survey:", error);
    res.status(500).json({ error: "Failed to save survey response." });
  }
});

router.get("/responses", async (req, res) => {
  try {   
    const responses = await SurveyResponse.find().lean();
    res.status(200).json(responses);
  } catch (error) {
    console.error("Error fetching responses:", error);
    res.status(500).json({ error: "Failed to fetch survey responses." });
  } 
});

module.exports = router;
