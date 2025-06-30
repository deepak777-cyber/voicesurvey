const express = require("express");
const router = express.Router();
const SurveyResponse = require("../models/SurveyResponse");

router.post("/save", async (req, res) => {
  try {
    const {
      unique_id,
      sys_start_time,
      sys_end_time,
      sys_device,
      survey_status,
      elapsed_time_in_second,
      language,
      ...questionResponses
    } = req.body;

    if (!unique_id) {
      return res.status(400).json({ error: "unique_id is required" });
    }

    // 🔍 Step 1: Check if a record with this unique_id already exists
    let existing = await SurveyResponse.findOne({ unique_id });

    if (existing) {
      // ✅ Step 2: Update the existing response (merge new question responses)
      const updated = await SurveyResponse.findOneAndUpdate(
        { unique_id },
        {
          $set: {
            ...questionResponses,
            sys_end_time: sys_end_time || existing.sys_end_time,
            sys_device,
            survey_status: survey_status || existing.survey_status,
            elapsed_time_in_second,
            language,
          },
        },
        { new: true }
      );

      return res.status(200).json({
        message: "Survey response updated.",
        savedData: updated,
      });
    } else {
      // 🆕 Step 3: Create a new response with a new respid
      const lastEntry = await SurveyResponse.findOne()
        .sort({ respid: -1 })
        .select("respid");

      const nextRespid = lastEntry?.respid ? lastEntry.respid + 1 : 1;

      const newResponse = new SurveyResponse({
        respid: nextRespid,
        unique_id,
        sys_start_time,
        sys_end_time: sys_end_time || new Date(),
        sys_device,
        survey_status: survey_status || "incomplete",
        elapsed_time_in_second,
        language,
        ...questionResponses,
      });

      const savedResponse = await newResponse.save();

      return res.status(201).json({
        message: "Survey response saved.",
        savedData: savedResponse,
      });
    }
  } catch (error) {
    console.error("Error saving survey:", error);
    res.status(500).json({ error: "Failed to save survey response." });
  }
});

router.get("/responses", async (req, res) => {
  try {
    const responses = await SurveyResponse.find().select("-__v").lean();
    res.status(200).json(responses);
  } catch (error) {
    console.error("Error fetching responses:", error);
    res.status(500).json({ error: "Failed to fetch survey responses." });
  }
});

module.exports = router;
