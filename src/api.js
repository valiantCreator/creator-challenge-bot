// src/api.js
// Purpose: Express web server to serve data to the dashboard frontend.
// Gemini: Created to support the v0.7 Web Dashboard architecture.

const express = require("express");
const cors = require("cors");
const challengesService = require("./services/challenges");
const pointsService = require("./services/points");
const settingsService = require("./services/settings");

/**
 * Starts the Express API server.
 * @param {import('discord.js').Client} client The Discord client instance.
 */
function startServer(client) {
  const app = express();
  // Gemini: Use the PORT from env or default to 3000
  const PORT = process.env.PORT || 3000;
  // Gemini: The Guild ID is needed to scope data queries to your specific server
  const GUILD_ID = process.env.GUILD_ID;

  if (!GUILD_ID) {
    console.warn(
      "⚠️ [API] GUILD_ID not found in .env. API may return empty results."
    );
  }

  // --- Middleware ---
  // Gemini: CORS allows the React frontend (running on a different port in dev) to talk to this API.
  app.use(cors());
  app.use(express.json());

  // --- Endpoint: Health Check ---
  app.get("/api/status", (req, res) => {
    res.json({
      status: "online",
      bot: client.user.tag,
      uptime: process.uptime(),
      guildId: GUILD_ID,
    });
  });

  // --- Endpoint: Get All Active Challenges ---
  app.get("/api/challenges", (req, res) => {
    try {
      // Gemini: Fetch active challenges using the existing service
      const challenges = challengesService.listActiveChallenges(
        client.db,
        GUILD_ID
      );
      res.json(challenges);
    } catch (error) {
      console.error("[API Error] /api/challenges:", error);
      res.status(500).json({ error: "Failed to fetch challenges" });
    }
  });

  // --- Endpoint: Get a Single Challenge ---
  app.get("/api/challenges/:id", (req, res) => {
    try {
      const challengeId = req.params.id;
      const challenge = challengesService.getChallengeById(
        client.db,
        challengeId
      );

      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }
      res.json(challenge);
    } catch (error) {
      console.error(`[API Error] /api/challenges/${req.params.id}:`, error);
      res.status(500).json({ error: "Failed to fetch challenge" });
    }
  });

  // --- Endpoint: Get Submissions for a Challenge ---
  app.get("/api/challenges/:id/submissions", (req, res) => {
    try {
      const challengeId = req.params.id;
      // Gemini: Use the new function we just added to services/challenges.js
      const submissions = challengesService.getSubmissionsByChallengeId(
        client.db,
        challengeId
      );
      res.json(submissions);
    } catch (error) {
      console.error(
        `[API Error] /api/challenges/${req.params.id}/submissions:`,
        error
      );
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  });

  // --- Endpoint: Leaderboard ---
  app.get("/api/leaderboard", (req, res) => {
    try {
      // Gemini: Support the 'period' query param (weekly, monthly, all-time)
      const period = req.query.period || "all-time";
      const limit = parseInt(req.query.limit) || 50;

      const leaderboard = pointsService.getLeaderboard(
        client.db,
        GUILD_ID,
        limit,
        period
      );
      res.json(leaderboard);
    } catch (error) {
      console.error("[API Error] /api/leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // --- Start Listening ---
  app.listen(PORT, () => {
    console.log(`🌐 Web API running on http://localhost:${PORT}`);
  });
}

module.exports = { startServer };
