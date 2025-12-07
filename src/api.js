// src/api.js
// Purpose: Express web server to serve data to the dashboard frontend.
// Gemini: Created to support the v0.7 Web Dashboard architecture.
// Gemini: Updated to include OAuth2 Authentication endpoints (v0.9).

const express = require("express");
const cors = require("cors");
const querystring = require("querystring"); // Gemini: Added for OAuth2 URL formatting
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

  // Gemini: OAuth2 Configuration
  const CLIENT_ID = process.env.CLIENT_ID;
  const CLIENT_SECRET = process.env.CLIENT_SECRET;
  const REDIRECT_URI = process.env.REDIRECT_URI;

  if (!GUILD_ID) {
    console.warn(
      "⚠️ [API] GUILD_ID not found in .env. API may return empty results."
    );
  }
  if (!CLIENT_SECRET || !REDIRECT_URI) {
    console.warn(
      "⚠️ [API] CLIENT_SECRET or REDIRECT_URI missing. Authentication will fail."
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

  // --- OAuth2 Endpoint: Login ---
  // Gemini: Redirects the user to Discord's authorization page.
  app.get("/api/auth/login", (req, res) => {
    const scope = "identify guilds"; // We need 'guilds' to check if they are in your server
    const params = querystring.stringify({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: scope,
    });
    // Redirect the browser to Discord
    res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
  });

  // --- OAuth2 Endpoint: Callback ---
  // Gemini: Handles the return trip from Discord. Exchanges code for token, verifies guild, returns user.
  app.get("/api/auth/callback", async (req, res) => {
    const code = req.query.code;

    if (!code) {
      return res.redirect("/?error=no_code");
    }

    try {
      // 1. Exchange the code for an Access Token
      const tokenResponse = await fetch(
        "https://discord.com/api/oauth2/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: "authorization_code",
            code: code,
            redirect_uri: REDIRECT_URI,
          }).toString(),
        }
      );

      const tokenData = await tokenResponse.json();
      if (tokenData.error) {
        console.error("OAuth Token Error:", tokenData);
        return res.redirect("/?error=token_exchange_failed");
      }

      // 2. Fetch the User's Profile
      const userResponse = await fetch("https://discord.com/api/users/@me", {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
        },
      });
      const userData = await userResponse.json();

      // 3. Fetch the User's Guilds (to check membership)
      const guildsResponse = await fetch(
        "https://discord.com/api/users/@me/guilds",
        {
          headers: {
            Authorization: `Bearer ${tokenData.access_token}`,
          },
        }
      );
      const guildsData = await guildsResponse.json();

      // 4. Security Check: Is the user in our specific GUILD_ID?
      const isMember = guildsData.some((guild) => guild.id === GUILD_ID);

      if (!isMember) {
        return res.redirect("/?error=not_a_member");
      }

      // 5. Success! Encode user data to send back to frontend
      // Note: In a production app, we would set a secure HTTP-only cookie here.
      // For this MVP, we will pass the basic user info in a query param to the dashboard.
      const userPayload = JSON.stringify({
        id: userData.id,
        username: userData.username,
        avatar: userData.avatar,
        // Check if they are an admin (we'll trust the bot's check later, but for UI we can check permissions if needed)
        // For now, we'll just pass their ID and let the frontend/API validate actions.
      });

      const encodedUser = encodeURIComponent(userPayload);

      // Redirect back to the Dashboard (Frontend) with the user data
      res.redirect(`/?user=${encodedUser}`);
    } catch (error) {
      console.error("OAuth Callback Error:", error);
      res.redirect("/?error=server_error");
    }
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
