// src/utils/embeds.js
// Purpose: A centralized utility for creating consistent, styled embeds.

const { EmbedBuilder } = require("discord.js");

// Define a consistent color palette for embeds.
const COLORS = {
  primary: "#5865F2", // Discord Blurple
  success: "#57F287", // Discord Green
  error: "#ED4245", // Discord Red
  warning: "#FEE75C", // Discord Yellow
};

/**
 * Creates a standardized error embed.
 * @param {string} description - The error message to display to the user.
 * @returns {EmbedBuilder} A pre-configured EmbedBuilder instance for errors.
 */
const createErrorEmbed = (description) => {
  return new EmbedBuilder()
    .setColor(COLORS.error)
    .setTitle("❌ An Error Occurred")
    .setDescription(description)
    .setTimestamp(new Date());
};

/**
 * Creates a standardized success embed.
 * @param {string} description - The success message to display.
 * @returns {EmbedBuilder} A pre-configured EmbedBuilder instance for success messages.
 */
const createSuccessEmbed = (description) => {
  return new EmbedBuilder()
    .setColor(COLORS.success)
    .setTitle("✅ Success!")
    .setDescription(description)
    .setTimestamp(new Date());
};

module.exports = {
  COLORS,
  createErrorEmbed,
  createSuccessEmbed,
};
