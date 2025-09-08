require('dotenv').config();

module.exports = {
  token: process.env.DISCORD_TOKEN,
  clientId: process.env.CLIENT_ID,
  guildId: process.env.GUILD_ID || null,
  announceChannelId: process.env.ANNOUNCE_CHANNEL_ID || null,
  submissionsChannelId: process.env.SUBMISSIONS_CHANNEL_ID || null,
  points: {
    perSubmission: 1,
    perUpvote: 1, // 👍 adds one point to the author of the submission
  },
};
