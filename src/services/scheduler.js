// src/services/scheduler.js
// Purpose: Manages all scheduled tasks (cron jobs) for the bot.
// Gemini: Refactored for PostgreSQL (Async/Await).

const cron = require("node-cron");
const { EmbedBuilder } = require("discord.js");
const challengesService = require("./challenges");

const scheduledJobs = new Map();

async function runScheduledChallenge(db, challengeTemplate, client) {
  console.log(
    `[Scheduler] Running job for template #${challengeTemplate.id}: "${challengeTemplate.title}"`
  );
  try {
    // Gemini: createChallenge now returns JUST the ID (number), not the full object
    const newChallengeId = await challengesService.createChallenge(db, {
      guildId: challengeTemplate.guild_id,
      title: challengeTemplate.title,
      description: challengeTemplate.description,
      type: challengeTemplate.type,
      createdBy: challengeTemplate.created_by,
      channelId: challengeTemplate.channel_id,
      isTemplate: 0,
      cronSchedule: null,
    });

    const guild = await client.guilds.fetch(challengeTemplate.guild_id);
    const announceChannel = await guild.channels.fetch(
      challengeTemplate.channel_id
    );

    if (!announceChannel) {
      console.error(
        `[Scheduler] Announce channel ${challengeTemplate.channel_id} not found.`
      );
      return;
    }

    // Gemini: Use template data for title/desc, and the NEW ID for the footer
    const challengeEmbed = new EmbedBuilder()
      .setTitle(`🏁 New Challenge: ${challengeTemplate.title}`)
      .setDescription(challengeTemplate.description)
      .setColor("#0099ff") // Gemini: Matched API color
      .addFields(
        {
          name: "Challenge ID",
          value: `\`${newChallengeId}\``, // Use the new ID
          inline: true,
        },
        { name: "Type", value: challengeTemplate.type, inline: true },
        {
          name: "How to participate",
          value: `Use the \`/submit challenge_id:${newChallengeId}\` command in this thread, or submit via the Dashboard!`,
        }
      )
      .setFooter({
        text: "Community members can vote with 👍 to award points!",
      })
      .setTimestamp(); // Gemini: Added timestamp

    const challengeMessage = await announceChannel.send({
      embeds: [challengeEmbed],
    });

    const thread = await challengeMessage.startThread({
      name: `Submissions for Challenge #${newChallengeId}: ${challengeTemplate.title}`,
      autoArchiveDuration: 10080, // 1 week
      reason: `Submissions and discussion for challenge #${newChallengeId}`, // Gemini: Restored reason
    });

    // Gemini: Await this async call
    await challengesService.attachMessageAndThread(db, {
      challengeId: newChallengeId,
      messageId: challengeMessage.id,
      threadId: thread.id,
    });

    console.log(
      `[Scheduler] Successfully created new challenge #${newChallengeId}`
    );
  } catch (error) {
    console.error(
      `[Scheduler] Failed to run job for template #${challengeTemplate.id}:`,
      error
    );
  }
}

function scheduleChallenge(db, template, client) {
  if (
    !cron.validate(template.cron_schedule) ||
    scheduledJobs.has(template.id)
  ) {
    return;
  }

  const job = cron.schedule(template.cron_schedule, () => {
    runScheduledChallenge(db, template, client);
  });
  scheduledJobs.set(template.id, job);
}

function cancelChallenge(challengeId) {
  const job = scheduledJobs.get(challengeId);
  if (job) {
    job.stop();
    scheduledJobs.delete(challengeId);
    console.log(
      `[Scheduler] Canceled and removed job for challenge #${challengeId}.`
    );
  }
}

// Gemini: Made async to await database call
async function initializeScheduler(db, client) {
  console.log("[Scheduler] Initializing...");

  // Gemini: Await the database fetch
  const templates = await challengesService.getAllRecurringChallenges(db);

  if (templates.length === 0) {
    console.log("[Scheduler] No recurring challenges found.");
    return;
  }

  for (const template of templates) {
    scheduleChallenge(db, template, client);
  }

  console.log(
    `[Scheduler] Initialization complete. ${scheduledJobs.size} jobs scheduled.`
  );
}

module.exports = {
  initializeScheduler,
  scheduleChallenge,
  cancelChallenge,
};
