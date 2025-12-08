// src/api.js
// Purpose: Express web server to serve data to the dashboard frontend.
// Gemini: Updated to "Single Origin" architecture (v3.0.0) - Serving React from Express.

const express = require("express");
const cors = require("cors");
const querystring = require("querystring");
const cookieSession = require("cookie-session");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const challengesService = require("./services/challenges");
const pointsService = require("./services/points");
const settingsService = require("./services/settings");
const { PermissionFlagsBits } = require("discord.js");

// Configure Multer (Temporary storage for uploads)
const upload = multer({ dest: "uploads/" });

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

  // Gemini: In Single Origin mode, FRONTEND_URL isn't strictly needed for CORS,
  // but we keep the logic clean.
  const RAW_FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
  const FRONTEND_URL = RAW_FRONTEND_URL.replace(/\/$/, "");

  if (!GUILD_ID) {
    console.warn("⚠️ [API] GUILD_ID not found in .env.");
  }

  // --- Gemini: CRITICAL FIX for Render Cookies ---
  // Render uses a load balancer (proxy), so the request looks like HTTP to Node.
  // We must trust the proxy so Express knows it's actually HTTPS.
  app.set("trust proxy", 1);

  // --- Middleware ---

  // Gemini: Strict CORS policy for credentials
  // (Less critical in Single Origin, but good practice if local dev is split)
  app.use(
    cors({
      origin: FRONTEND_URL, // Allow only this specific frontend
      credentials: true, // Allow cookies/sessions
    })
  );

  app.use(express.json());

  // Configure Session Middleware
  app.use(
    cookieSession({
      name: "session",
      keys: [CLIENT_SECRET || "fallback_secret"],
      maxAge: 24 * 60 * 60 * 1000,

      // Gemini: Single Origin Cookie Settings
      // Since API and Frontend are now same-domain, we can use standard settings.
      secure: true, // Still required for Render (HTTPS)
      sameSite: "lax", // 'lax' is perfect for same-domain navigation
      httpOnly: true,
    })
  );

  // --- Endpoint: Health Check ---
  app.get("/api/status", (req, res) => {
    res.json({
      status: "online",
      bot: client.user.tag,
      uptime: process.uptime(),
      guildId: GUILD_ID,
      user: req.session.user ? req.session.user.username : "guest",
    });
  });

  // --- OAuth2 Endpoint: Login ---
  app.get("/api/auth/login", (req, res) => {
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
      // Gemini: Redirect back to root on error
      return res.redirect(`/?error=no_code`);
    }

    try {
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
        return res.redirect(`/?error=token_exchange_failed`);
      }

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

      const targetGuild = guildsData.find((g) => g.id === GUILD_ID);

      if (!targetGuild) {
        return res.redirect(`/?error=not_a_member`);
      }

      const permissions = BigInt(targetGuild.permissions);
      const MANAGE_GUILD = 0x20n;
      const ADMINISTRATOR = 0x8n;

      const isAdmin =
        (permissions & ADMINISTRATOR) === ADMINISTRATOR ||
        (permissions & MANAGE_GUILD) === MANAGE_GUILD;

      const sessionUser = {
        id: userData.id,
        username: userData.username,
        avatar: userData.avatar,
        isAdmin: isAdmin,
      };

      req.session.user = sessionUser;
      req.sessionOptions.maxAge = 24 * 60 * 60 * 1000;

      // Gemini: CRITICAL FIX - Pass user data in URL for immediate frontend hydration
      const userString = encodeURIComponent(JSON.stringify(sessionUser));
      // Redirect to root (/) which now serves the React app
      res.redirect(`/?user=${userString}`);
    } catch (error) {
      console.error("OAuth Callback Error:", error);
      res.redirect(`/?error=server_error`);
    }
  });

  // --- Endpoint: Check Session ---
  app.get("/api/auth/me", (req, res) => {
    if (req.session && req.session.user) {
      res.json(req.session.user);
    } else {
      res.status(401).json({ error: "Not logged in" });
    }
  });

  // --- Endpoint: Logout ---
  app.post("/api/auth/logout", (req, res) => {
    req.session = null;
    res.json({ success: true });
  });

  // --- DATA ENDPOINTS ---
  app.get("/api/challenges", async (req, res) => {
    try {
      const challenges = await challengesService.listActiveChallenges(
        client.db,
        GUILD_ID
      );
      res.json(challenges);
    } catch (error) {
      console.error("[API Error] /api/challenges:", error);
      res.status(500).json({ error: "Failed to fetch challenges" });
    }
  });

  app.get("/api/challenges/:id", async (req, res) => {
    try {
      const challengeId = req.params.id;
      const challenge = await challengesService.getChallengeById(
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

  app.get("/api/challenges/:id/submissions", async (req, res) => {
    try {
      const challengeId = req.params.id;
      const submissions = await challengesService.getSubmissionsByChallengeId(
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

  app.get("/api/leaderboard", async (req, res) => {
    try {
      const period = req.query.period || "all-time";
      const limit = parseInt(req.query.limit) || 50;
      const leaderboard = await pointsService.getLeaderboard(
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

  // --- ADMIN ACTION: DELETE ---
  app.delete("/api/submissions/:id", async (req, res) => {
    if (!req.session || !req.session.user || !req.session.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized: Admins only." });
    }

    const submissionId = req.params.id;
    try {
      const success = await challengesService.deleteSubmission(
        client.db,
        submissionId
      );
      if (success) {
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

  // --- USER ACTION: SUBMIT (NEW) ---
  app.post(
    "/api/challenges/:id/submit",
    upload.single("file"),
    async (req, res) => {
      // 1. Auth Check
      if (!req.session || !req.session.user) {
        return res.status(401).json({ error: "Must be logged in to submit." });
      }

      const challengeId = req.params.id;
      const user = req.session.user;
      const caption = req.body.caption || "";
      const link = req.body.link || "";
      const file = req.file;

      try {
        // 2. Get Challenge Info (Async)
        const challenge = await challengesService.getChallengeById(
          client.db,
          challengeId
        );
        if (!challenge) {
          return res.status(404).json({ error: "Challenge not found" });
        }
        if (!challenge.channel_id) {
          return res.status(400).json({ error: "Challenge has no channel." });
        }

        // 3. Post to Discord Thread/Channel
        const channel = await client.channels.fetch(challenge.channel_id);
        const threadId = challenge.thread_id || challenge.message_id;

        let targetChannel = channel;
        if (threadId) {
          try {
            targetChannel = await channel.threads.fetch(threadId);
          } catch (e) {
            console.warn("Could not fetch thread, falling back to channel.");
          }
        }

        // Prepare the payload for Discord
        const messageContent = [
          `**Submission by ${user.username}**`,
          caption,
          link ? `\n🔗 ${link}` : "",
        ]
          .join("\n")
          .trim();

        const messagePayload = {
          content: messageContent,
          files: [],
        };

        if (file) {
          messagePayload.files.push({
            attachment: file.path,
            name: file.originalname,
          });
        }

        const discordMessage = await targetChannel.send(messagePayload);

        // 4. Record in Database
        let attachmentUrl = null;
        if (discordMessage.attachments.size > 0) {
          attachmentUrl = discordMessage.attachments.first().url;
        }

        const submissionId = await challengesService.recordSubmission(
          client.db,
          {
            challenge_id: challengeId,
            guild_id: GUILD_ID,
            user_id: user.id,
            username: user.username,
            channel_id: discordMessage.channelId,
            message_id: discordMessage.id,
            thread_id: discordMessage.channelId,
            content_text: caption,
            attachment_url: attachmentUrl,
            link_url: link || null,
          }
        );

        // 5. Cleanup
        if (file) {
          fs.unlinkSync(file.path);
        }

        res.json({ success: true, submissionId });
      } catch (error) {
        console.error("Submission Error:", error);
        res.status(500).json({ error: "Failed to process submission." });
      }
    }
  );

  // --- Gemini: SERVE REACT FRONTEND (FINAL FALLBACK) ---
  // This must be AFTER all API routes so we don't block them.

  // 1. Serve static files from the 'client/dist' folder
  const clientDistPath = path.join(__dirname, "../client/dist");
  app.use(express.static(clientDistPath));

  /// 2. Handle React Routing (Wildcard)
  // If a request comes in for "/dashboard" or "/challenge/5" (and wasn't an API call),
  // send the index.html so React Router can take over.
  // Gemini: Switched to Regex /.*/ to fix "Missing parameter name" error on Render
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(clientDistPath, "index.html"));
  });

  // --- Start Listening ---
  app.listen(PORT, () => {
    console.log(`🌐 Web API + Frontend running on http://localhost:${PORT}`);
  });
}

module.exports = { startServer };
