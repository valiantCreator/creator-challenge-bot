// src/api.js
// Purpose: Express web server to serve data to the dashboard frontend.
// Gemini: Updated to fix Session Cookie settings and add Session Check endpoint (v0.9.3).

const express = require("express");
const cors = require("cors");
const querystring = require("querystring");
const cookieSession = require("cookie-session");
const challengesService = require("./services/challenges");
const pointsService = require("./services/points");
const settingsService = require("./services/settings");
const { PermissionFlagsBits } = require("discord.js");

/**
 * Starts the Express API server.
 * @param {import('discord.js').Client} client The Discord client instance.
 */
function startServer(client) {
  const app = express();
  const PORT = process.env.PORT || 3000;
  const GUILD_ID = process.env.GUILD_ID;

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
  app.use(cors());
  app.use(express.json());

  // Gemini: Configure Session Middleware
  // This encrypts your user data and stores it in a browser cookie.
  app.use(
    cookieSession({
      name: "session",
      keys: [CLIENT_SECRET || "fallback_secret"], // Use your secret to sign the cookie so it can't be faked
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: false, // CRITICAL: Must be false for http://localhost development
      httpOnly: true,
      sameSite: "lax",
    })
  );

  // --- Endpoint: Health Check ---
  app.get("/api/status", (req, res) => {
    res.json({
      status: "online",
      bot: client.user.tag,
      uptime: process.uptime(),
      guildId: GUILD_ID,
      // Gemini: helpful for debugging auth state
      user: req.session.user ? req.session.user.username : "guest",
    });
  });

  // --- OAuth2 Endpoint: Login ---
  app.get("/api/auth/login", (req, res) => {
    // Gemini: We request 'identify' (profile) and 'guilds' (server list with permissions)
    const scope = "identify guilds";
    const params = querystring.stringify({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: "code",
      scope: scope,
    });
    res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
  });

  // --- OAuth2 Endpoint: Callback ---
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
      const [userRes, guildRes] = await Promise.all([
        fetch("https://discord.com/api/users/@me", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }),
        fetch("https://discord.com/api/users/@me/guilds", {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }),
      ]);

      const userData = await userRes.json();
      const guildsData = await guildRes.json();

      // 3. Security & Admin Check
      // Find the specific guild object for our server
      const targetGuild = guildsData.find((g) => g.id === GUILD_ID);

      if (!targetGuild) {
        // User is not in the server at all
        return res.redirect("/?error=not_a_member");
      }

      // Gemini: Check Permissions
      const permissions = BigInt(targetGuild.permissions);
      const MANAGE_GUILD = 0x20n;
      const ADMINISTRATOR = 0x8n;

      const isAdmin =
        (permissions & ADMINISTRATOR) === ADMINISTRATOR ||
        (permissions & MANAGE_GUILD) === MANAGE_GUILD;

      // 4. Create Session Object
      const sessionUser = {
        id: userData.id,
        username: userData.username,
        avatar: userData.avatar,
        isAdmin: isAdmin,
      };

      // Gemini: SAVE TO SECURE COOKIE
      req.session.user = sessionUser;

      // Manually enforce maxAge to ensure the browser respects it
      req.sessionOptions.maxAge = 24 * 60 * 60 * 1000;

      // 5. Success! Redirect to home (Frontend checks /api/auth/me)
      res.redirect("/");
    } catch (error) {
      console.error("OAuth Callback Error:", error);
      res.redirect("/?error=server_error");
    }
  });

  // --- Gemini: NEW Endpoint - Check Session (Fixes refresh logout) ---
  app.get("/api/auth/me", (req, res) => {
    if (req.session && req.session.user) {
      res.json(req.session.user);
    } else {
      res.status(401).json({ error: "Not logged in" });
    }
  });

  // --- Endpoint: Logout ---
  app.post("/api/auth/logout", (req, res) => {
    req.session = null; // Clear the cookie
    res.json({ success: true });
  });

  // --- Endpoint: Get All Active Challenges ---
  app.get("/api/challenges", (req, res) => {
    try {
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

  // --- ADMIN ACTION: DELETE SUBMISSION ---
  app.delete("/api/submissions/:id", (req, res) => {
    // 1. Security Check: Must have a session, must be logged in, must be admin
    if (!req.session || !req.session.user || !req.session.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized: Admins only." });
    }

    const submissionId = req.params.id;
    try {
      const success = challengesService.deleteSubmission(
        client.db,
        submissionId
      );
      if (success) {
        // Optional: Log this action or notify Discord channel
        console.log(
          `[Audit] Admin ${req.session.user.username} deleted submission ${submissionId}`
        );
        res.json({ success: true });
      } else {
        res.status(404).json({ error: "Submission not found" });
      }
    } catch (error) {
      console.error("Delete Error:", error);
      res.status(500).json({ error: "Database error" });
    }
  });

  // --- Start Listening ---
  app.listen(PORT, () => {
    console.log(`🌐 Web API running on http://localhost:${PORT}`);
  });
}

module.exports = { startServer };
