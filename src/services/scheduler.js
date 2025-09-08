// src/services/scheduler.js
// Purpose: Manages all scheduled tasks (cron jobs) for the bot.

const cron = require("node-cron");
const { EmbedBuilder } = require("discord.js");
const challengesService = require("./challenges");

const scheduledJobs = new Map();

async function runScheduledChallenge(db, challengeTemplate, client) {
  console.log(
    `[Scheduler] Running job for template #${challengeTemplate.id}: "${challengeTemplate.title}"`
  );
  try {
    // (FIX) Pass db to the service function.
    const newChallengeData = await challengesService.createChallenge(db, {
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

    // (FIX) Create thread after posting the message
    const challengeEmbed = new EmbedBuilder()
      .setTitle(`🏁 New Challenge: ${newChallengeData.title}`)
      .setDescription(newChallengeData.description)
      .setColor("#5865F2")
      .addFields(
        {
          name: "Challenge ID",
          value: `\`${newChallengeData.id}\``,
          inline: true,
        },
        { name: "Type", value: newChallengeData.type, inline: true }
      )
      .setFooter({ text: "Use the /submit command in this thread!" });

    const challengeMessage = await announceChannel.send({
      embeds: [challengeEmbed],
    });

    const thread = await challengeMessage.startThread({
      name: `Challenge #${newChallengeData.id} - ${newChallengeData.title}`,
      autoArchiveDuration: 10080, // 1 week
      reason: `Submissions and discussion for challenge #${newChallengeData.id}`,
    });

    // (FIX) Pass db to the service function.
    challengesService.attachMessageAndThread(db, {
      challengeId: newChallengeData.id,
      messageId: challengeMessage.id,
      threadId: thread.id,
    });

    console.log(
      `[Scheduler] Successfully created new challenge #${newChallengeData.id}`
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

// (FIX) Accept db and client as arguments.
function initializeScheduler(db, client) {
  console.log("[Scheduler] Initializing...");
  // (FIX) Pass db to the service function.
  const templates = challengesService.getAllRecurringChallenges(db);

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
