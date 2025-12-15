// src/api.js
// Purpose: Express web server to serve data to the dashboard frontend.
// Gemini: Removed redundant "Notes" field from submission embed to prevent duplication.

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
// Gemini: Added EmbedBuilder for structured messages
const {
  PermissionFlagsBits,
  EmbedBuilder,
  ChannelType,
  AttachmentBuilder, // Gemini: Added for memory uploads
} = require("discord.js");
const { scheduleChallenge } = require("./services/scheduler");
const cron = require("node-cron");

// Configure Multer (Temporary storage for uploads)
// Gemini: Switched to memoryStorage to avoid Windows file locks & allow "Double-Tap" hosting
const upload = multer({ storage: multer.memoryStorage() });

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

  // Gemini: Determine environment for Cookie Security
  const isProduction = process.env.NODE_ENV === "production";

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

      // Gemini: Dynamic Cookie Settings
      // secure: true required for Render (HTTPS).
      // secure: false required for Localhost (HTTP).
      secure: isProduction,
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
      isProduction: isProduction, // Helpful for debugging
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

  // --- Endpoint: Check Session (Enriched with Stats) ---
  app.get("/api/auth/me", async (req, res) => {
    if (req.session && req.session.user) {
      try {
        // Gemini: Fetch live stats for the "Me" Center
        const userId = req.session.user.id;
        const [pointsData, rankData] = await Promise.all([
          pointsService.getUserPoints(client.db, GUILD_ID, userId),
          pointsService.getUserRank(client.db, GUILD_ID, userId),
        ]);

        const enrichedUser = {
          ...req.session.user,
          points: pointsData.points,
          rank: rankData ? rankData.rank : null,
          totalParticipants: rankData ? rankData.total : 0,
        };

        res.json(enrichedUser);
      } catch (error) {
        console.error("Error fetching user stats:", error);
        // Fallback to basic session data if DB fails
        res.json(req.session.user);
      }
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
      // Gemini: Support filtering for Admin Archive
      const status = req.query.status;
      let challenges;

      console.log(
        `[API] Fetching challenges. Status filter: ${status || "active"}`
      );

      if (status === "all") {
        challenges = await challengesService.listAllChallenges(
          client.db,
          GUILD_ID
        );
      } else {
        challenges = await challengesService.listActiveChallenges(
          client.db,
          GUILD_ID
        );
      }

      console.log(`[API] Found ${challenges.length} challenges.`);
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
      // Gemini: We now also need to know if the current user voted for each submission
      const submissions = await challengesService.getSubmissionsByChallengeId(
        client.db,
        challengeId
      );

      // If user is logged in, attach 'hasVoted' status (Optimization)
      // For MVP, we handle this on the frontend or let the user click to toggle
      // Ideally, we'd loop through and check 'hasVoted' for each, but let's keep it simple.

      res.json(submissions);
    } catch (error) {
      console.error(
        `[API Error] /api/challenges/${req.params.id}/submissions:`,
        error
      );
      res.status(500).json({ error: "Failed to fetch submissions" });
    }
  });

  // --- NEW: Get User Submissions (For Profile) ---
  app.get("/api/my-submissions", async (req, res) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: "Not logged in" });
    }
    try {
      const submissions = await challengesService.getSubmissionsByUser(
        client.db,
        req.session.user.id,
        GUILD_ID
      );
      res.json(submissions);
    } catch (error) {
      console.error("Error fetching user submissions:", error);
      res.status(500).json({ error: "Failed to fetch history" });
    }
  });

  app.get("/api/leaderboard", async (req, res) => {
    try {
      const period = req.query.period || "all-time";
      const limit = parseInt(req.query.limit) || 50;
      // Gemini: Pass 'client' to service for data enrichment (Avatar/Username)
      const leaderboard = await pointsService.getLeaderboard(
        client.db,
        GUILD_ID,
        limit,
        period,
        client
      );
      res.json(leaderboard);
    } catch (error) {
      console.error("[API Error] /api/leaderboard:", error);
      res.status(500).json({ error: "Failed to fetch leaderboard" });
    }
  });

  // --- VOTE ENDPOINT (UPDATED: TOGGLE & SYNC) ---
  app.post("/api/submissions/:id/vote", async (req, res) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: "Must be logged in to vote." });
    }

    const submissionId = req.params.id;
    const userId = req.session.user.id;

    try {
      // 1. Get submission details to check owner
      const submission = await challengesService.getSubmissionById(
        client.db,
        submissionId
      );
      if (!submission)
        return res.status(404).json({ error: "Submission not found." });

      // 2. Prevent Self-Voting
      if (submission.user_id === userId) {
        return res
          .status(400)
          .json({ error: "You cannot vote for your own submission." });
      }

      // 3. Check existing vote (Toggle Logic)
      const hasVoted = await challengesService.checkUserVote(
        client.db,
        submissionId,
        userId
      );

      let action = "";
      if (hasVoted) {
        await challengesService.removeVote(client.db, { submissionId, userId });
        action = "removed";
      } else {
        await challengesService.addVote(client.db, {
          submissionId,
          userId,
          guildId: GUILD_ID,
        });
        action = "added";
      }

      // 4. SYNC WITH DISCORD
      // We need to update the Embed footer in Discord to reflect the new count.
      try {
        const channel = await client.channels.fetch(submission.channel_id);
        const message = await channel.messages.fetch(submission.message_id);

        // Get the new vote count
        const updatedSub = await challengesService.getSubmissionById(
          client.db,
          submissionId
        );
        const settings = await settingsService.getGuildSettings(
          client.db,
          GUILD_ID
        );

        // Rebuild/Update the Embed
        const embed = EmbedBuilder.from(message.embeds[0]);
        embed.setFooter({
          text: `Submission ID: ${submissionId} • Vote with ${settings.vote_emoji} • Votes: ${updatedSub.votes}`,
        });

        await message.edit({ embeds: [embed] });
      } catch (discordError) {
        console.warn("Failed to sync vote count to Discord:", discordError);
        // Don't fail the request if Discord sync fails, just log it.
      }

      res.json({ success: true, action: action });
    } catch (error) {
      console.error("Vote Error:", error);
      res.status(500).json({ error: "Failed to process vote." });
    }
  });

  // --- NEW: EDIT SUBMISSION ENDPOINT ---
  app.patch("/api/submissions/:id", async (req, res) => {
    if (!req.session || !req.session.user) {
      return res.status(401).json({ error: "Must be logged in." });
    }

    const submissionId = req.params.id;
    const { caption, link } = req.body;
    const userId = req.session.user.id;

    try {
      // 1. Verify Ownership
      const submission = await challengesService.getSubmissionById(
        client.db,
        submissionId
      );
      if (!submission) {
        return res.status(404).json({ error: "Submission not found." });
      }
      if (submission.user_id !== userId) {
        return res
          .status(403)
          .json({ error: "You can only edit your own submissions." });
      }

      // 2. Update Database
      await challengesService.updateSubmission(client.db, submissionId, {
        contentText: caption,
        linkUrl: link,
      });

      // 3. Update Discord Message (Sync)
      try {
        const channel = await client.channels.fetch(submission.channel_id);
        const message = await channel.messages.fetch(submission.message_id);

        const embed = EmbedBuilder.from(message.embeds[0]);

        // Update Description (This is the main caption)
        embed.setDescription(caption || "*No caption provided*");

        // Gemini Fix: Safe access to fields. If undefined, default to empty array.
        const currentFields = embed.data.fields || [];

        // Filter out BOTH "🔗 Link" AND "📝 Notes" to prevent duplication.
        const newFields = currentFields.filter(
          (f) => f.name !== "🔗 Link" && f.name !== "📝 Notes"
        );

        if (link) {
          newFields.push({ name: "🔗 Link", value: link });
        }

        embed.setFields(newFields);

        await message.edit({ embeds: [embed] });
      } catch (discordError) {
        console.warn("Failed to sync edit to Discord:", discordError);
        // We still return success because the DB was updated
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Edit Submission Error:", error);
      res.status(500).json({ error: "Failed to update submission." });
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

  // --- ADMIN ROUTES (PATH B) ---

  // 1. Get Available Channels (For Dropdown)
  app.get("/api/admin/channels", async (req, res) => {
    // Auth Check
    if (!req.session || !req.session.user || !req.session.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    try {
      const guild = client.guilds.cache.get(GUILD_ID);
      if (!guild) return res.status(500).json({ error: "Guild not found" });

      // Filter for text channels where the bot can send messages
      const channels = guild.channels.cache
        .filter(
          (c) =>
            c.type === ChannelType.GuildText &&
            c.permissionsFor(client.user).has(PermissionFlagsBits.SendMessages)
        )
        .map((c) => ({ id: c.id, name: c.name }));

      res.json(channels);
    } catch (error) {
      console.error("[API Error] /api/admin/channels:", error);
      res.status(500).json({ error: "Failed to fetch channels" });
    }
  });

  // 2. Create Challenge (Matches Slash Command Logic)
  app.post("/api/admin/challenges", async (req, res) => {
    // Auth Check
    if (!req.session || !req.session.user || !req.session.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const {
      title,
      description,
      type,
      channelId,
      schedule, // cron string
      endsAt, // timestamp or ISO string (from date picker)
    } = req.body;

    if (!title || !description || !type || !channelId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    try {
      // Logic Path 1: Recurring Challenge (Template)
      if (schedule) {
        if (!cron.validate(schedule)) {
          return res.status(400).json({ error: "Invalid Cron Schedule" });
        }

        const newTemplateId = await challengesService.createChallenge(
          client.db,
          {
            guildId: GUILD_ID,
            title,
            description,
            type,
            createdBy: req.session.user.id,
            channelId,
            isTemplate: 1,
            cronSchedule: schedule,
          }
        );

        const newTemplate = await challengesService.getChallengeById(
          client.db,
          newTemplateId
        );
        if (newTemplate) {
          scheduleChallenge(client.db, newTemplate, client);
        }

        return res.json({ success: true, challengeId: newTemplateId });
      }

      // Logic Path 2: One-Time Challenge
      const postChannel = client.channels.cache.get(channelId);
      if (!postChannel) {
        return res.status(404).json({ error: "Channel not found in cache." });
      }

      // Gemini: TIMEZONE FIX (BULLETPROOF)
      // 1. Manually parse "YYYY-MM-DD" to avoid UTC shifting issues.
      // 2. Create a timestamp for 23:59:59 UTC on that specific date.
      let finalEndsAt = null;
      if (endsAt) {
        const [year, month, day] = endsAt.split("-").map(Number);
        // Date.UTC(year, monthIndex, day, hours, minutes, seconds)
        // monthIndex is 0-based (0 = Jan, 11 = Dec)
        finalEndsAt = Date.UTC(year, month - 1, day, 23, 59, 59);
      }

      const newChallengeId = await challengesService.createChallenge(
        client.db,
        {
          guildId: GUILD_ID,
          title,
          description,
          type,
          createdBy: req.session.user.id,
          channelId,
          endsAt: finalEndsAt, // Use the fixed timestamp
        }
      );

      // Create Embed
      const challengeEmbed = new EmbedBuilder()
        .setColor("#0099ff")
        .setTitle(`🏁 New Challenge: ${title}`)
        .setDescription(description)
        .addFields(
          {
            name: "Challenge ID",
            value: `\`${newChallengeId}\``,
            inline: true,
          },
          { name: "Type", value: type, inline: true },
          {
            name: "How to participate",
            value: `Use the \`/submit challenge_id:${newChallengeId}\` command in this thread, or submit via the Dashboard!`,
          }
        )
        .setFooter({
          text: "Community members can vote with 👍 to award points!",
        })
        .setTimestamp();

      if (finalEndsAt) {
        // Gemini: Use Discord's Native Timestamp formatting <t:TIMESTAMP:D>
        // This forces the CLIENT (User's App) to render the date in THEIR local time.
        // / 1000 to convert ms to seconds.
        const discordTimestamp = Math.floor(finalEndsAt / 1000);
        challengeEmbed.addFields({
          name: "Deadline",
          value: `<t:${discordTimestamp}:D> (<t:${discordTimestamp}:R>)`,
          // Displays as: "December 11, 2025 (in 5 days)"
        });
      }

      const challengeMessage = await postChannel.send({
        embeds: [challengeEmbed],
      });

      const thread = await challengeMessage.startThread({
        name: `Submissions for Challenge #${newChallengeId}: ${title}`,
        autoArchiveDuration: 1440,
      });

      // Update DB with message/thread IDs
      const updated = await challengesService.attachMessageAndThread(
        client.db,
        {
          challengeId: newChallengeId,
          messageId: challengeMessage.id,
          threadId: thread.id,
        }
      );

      if (!updated) {
        // Rollback attempt (delete thread/message)
        await thread.delete().catch(console.error);
        await challengeMessage.delete().catch(console.error);
        return res
          .status(500)
          .json({ error: "Database error linking thread." });
      }

      res.json({ success: true, challengeId: newChallengeId });
    } catch (error) {
      console.error("Error creating challenge via API:", error);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // --- Gemini: NEW DELETE CHALLENGE ROUTE ---
  // Deletes challenge + submissions + votes + (optional) discord thread + (optional) points
  app.delete("/api/admin/challenges/:id", async (req, res) => {
    if (!req.session || !req.session.user || !req.session.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized: Admins only." });
    }

    const challengeId = req.params.id;
    // Flags passed from the frontend modal
    const { deleteThread, revokePoints } = req.body;

    try {
      const db = client.db;
      // 1. Get Challenge Details
      const challenge = await challengesService.getChallengeById(
        db,
        challengeId
      );
      if (!challenge) {
        return res.status(404).json({ error: "Challenge not found" });
      }

      // 2. Revoke Points (Optional)
      // This subtracts points based on the tracking logs we added in Phase 1
      if (revokePoints) {
        await pointsService.revokeChallengePoints(db, challengeId);
      }

      // 3. Delete Discord Thread (Cleanup)
      // Deleting the thread automatically removes all submission messages inside it.
      if (deleteThread && challenge.thread_id) {
        try {
          const channel = await client.channels.fetch(challenge.channel_id);
          const thread = await channel.threads.fetch(challenge.thread_id);
          if (thread) await thread.delete("Admin deleted challenge");
        } catch (e) {
          console.warn(
            "Could not delete thread (may be already gone):",
            e.message
          );
        }
      }

      // 4. Delete Announcement Message (Cleanup)
      if (deleteThread && challenge.channel_id && challenge.message_id) {
        try {
          const channel = await client.channels.fetch(challenge.channel_id);
          const msg = await channel.messages.fetch(challenge.message_id);
          if (msg) await msg.delete();
        } catch (e) {
          console.warn("Could not delete announcement msg:", e.message);
        }
      }

      // 5. Delete Database Records (The Cascade)
      // This wipes submissions, votes, and the challenge itself
      await challengesService.deleteChallenge(db, challengeId);

      res.json({ success: true });
    } catch (e) {
      console.error("Delete Challenge Error:", e);
      res.status(500).json({ error: "Failed to delete challenge" });
    }
  });

  // --- Gemini: NEW PICK WINNER ROUTE (FIXED REASON) ---
  app.post("/api/admin/challenges/:id/winner", async (req, res) => {
    if (!req.session || !req.session.user || !req.session.user.isAdmin) {
      return res.status(403).json({ error: "Unauthorized: Admins only." });
    }

    const challengeId = req.params.id;
    const { submissionId, bonusPoints } = req.body;

    console.log(
      `[API] Pick Winner Request: Challenge ${challengeId}, Sub ${submissionId}, Bonus ${bonusPoints}`
    );

    try {
      const db = client.db;

      // 1. Get Data
      const challenge = await challengesService.getChallengeById(
        db,
        challengeId
      );
      const submission = await challengesService.getSubmissionById(
        db,
        submissionId
      );

      if (!challenge || !submission) {
        return res
          .status(404)
          .json({ error: "Challenge or Submission not found" });
      }

      // 2. Award Points (Wrapped in Try/Catch to prevent blocking)
      const points = parseInt(bonusPoints) || 0;
      if (points > 0) {
        try {
          console.log(`[API] Attempting to award ${points} points...`);
          // Gemini Fix: Use "WINNER_BONUS" to satisfy database CHECK constraint
          // Also ensuring challengeId is passed as integer
          await pointsService.addPoints(
            db,
            GUILD_ID,
            submission.user_id,
            points,
            "WINNER_BONUS",
            client,
            parseInt(challengeId)
          );
        } catch (pointError) {
          console.error(
            "[API Warning] Could not award points due to DB constraint:",
            pointError.message
          );
          // We continue execution so the challenge still closes!
        }
      }

      // 3. Close Challenge
      console.log(`[API] Closing challenge ${challengeId}`);
      await challengesService.closeChallenge(db, challengeId);

      // 4. Announce in Discord
      try {
        const channel = await client.channels.fetch(challenge.channel_id);
        const threadId = challenge.thread_id || challenge.message_id;
        let targetChannel = channel;

        if (threadId) {
          try {
            targetChannel = await channel.threads.fetch(threadId);
          } catch (e) {
            console.warn("Thread not found, posting to channel.");
          }
        }

        const winnerEmbed = new EmbedBuilder()
          .setColor("#FFD700") // Gold
          .setTitle("🏆 We have a Winner!")
          .setDescription(
            `Congratulations <@${submission.user_id}> for winning **${challenge.title}**!`
          )
          .addFields({
            name: "Bonus Points Awarded",
            value: `${points} pts`,
            inline: true,
          })
          .setImage(submission.attachment_url)
          .setTimestamp();

        await targetChannel.send({ embeds: [winnerEmbed] });

        // Optional: Update original challenge message to say [CLOSED]
        if (challenge.message_id) {
          try {
            const originalMsg = await channel.messages.fetch(
              challenge.message_id
            );
            const editedEmbed = EmbedBuilder.from(originalMsg.embeds[0]);
            editedEmbed.setTitle(`🏁 [CLOSED] ${challenge.title}`);
            editedEmbed.setColor("#99aab5"); // Grey out
            await originalMsg.edit({ embeds: [editedEmbed] });
          } catch (msgErr) {
            console.warn("Could not edit original message:", msgErr.message);
          }
        }
      } catch (discordError) {
        console.error("Failed to post winner announcement:", discordError);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Pick Winner Error (Full Stack):", error);
      res.status(500).json({ error: "Failed to process winner." });
    }
  });

  // --- USER ACTION: SUBMIT (DOUBLE-TAP FIX) ---
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

        // Gemini: Check if challenge is active
        if (!challenge.is_active) {
          return res.status(400).json({ error: "This challenge is closed." });
        }

        if (!challenge.channel_id) {
          return res.status(400).json({ error: "Challenge has no channel." });
        }

        // 3. Get Settings (Need vote emoji for Embed Footer)
        const settings = await settingsService.getGuildSettings(
          client.db,
          GUILD_ID
        );

        // 4. Post to Discord Thread/Channel
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

        // Gemini: "Double-Tap" Logic (Fixes Ghost Attachments)
        // Step 1: Send the file alone to force Discord to host it.
        const filesToSend = [];
        if (file) {
          console.log("[API] File Buffer Size:", file.size);
          // Sanitize filename
          const safeName = `submission_${Date.now()}_${file.originalname.replace(
            /[^a-zA-Z0-9.]/g,
            ""
          )}`;
          const attachment = new AttachmentBuilder(file.buffer, {
            name: safeName,
          });
          filesToSend.push(attachment);
        }

        // Send Initial Message (Content + Files only)
        const msgOptions = {
          content: `**Submission from ${user.username}**`,
          files: filesToSend,
        };

        const discordMsg = await targetChannel.send(msgOptions); // variable name: discordMsg
        console.log("[API] Sent Initial Message ID:", discordMsg.id);

        // Step 2: Capture URL and Build Embed
        let attachmentUrl = null;
        if (discordMsg.attachments.size > 0) {
          attachmentUrl = discordMsg.attachments.first().url;
          console.log("[API] Captured URL:", attachmentUrl);
        }

        const embed = new EmbedBuilder()
          .setAuthor({
            name: `Submission from ${user.username}`,
            iconURL: user.avatar
              ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
              : undefined,
          })
          .setTitle(`Entry for: #${challenge.id} — ${challenge.title}`)
          .setDescription(caption || "*No caption provided*")
          .setColor("#0099ff")
          .setTimestamp();

        // Gemini: Removed the redundant "Notes" field here!
        if (link) embed.addFields({ name: "🔗 Link", value: link });

        // Use the captured URL if we have one
        if (attachmentUrl) {
          embed.setImage(attachmentUrl);
        }

        // Step 3: Edit the message to show the Embed
        await discordMsg.edit({ content: null, embeds: [embed] });

        // Gemini: AUTO-REACT FIX
        try {
          await discordMsg.react(settings.vote_emoji);
        } catch (reactError) {
          console.error("Failed to auto-react:", reactError);
        }

        // 5. Record in Database
        // Gemini: Using discordMsg variable to match the object returned by .send()
        const submissionId = await challengesService.recordSubmission(
          client.db,
          {
            challenge_id: challengeId,
            guild_id: GUILD_ID,
            user_id: user.id,
            username: user.username,
            channel_id: discordMsg.channelId,
            message_id: discordMsg.id,
            thread_id: discordMsg.channelId,
            content_text: caption,
            attachment_url: attachmentUrl,
            link_url: link || null,
          }
        );

        // 6. Update Footer with Submission ID (Consistency)
        try {
          embed.setFooter({
            text: `Submission ID: ${submissionId} • Vote with ${settings.vote_emoji} • Votes: 0`,
          });
          await discordMsg.edit({ embeds: [embed] });
        } catch (editError) {
          console.warn("Could not update footer with ID:", editError);
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
