// src/commands/addBadgeRole.js
// Purpose: Command to create a new badge role milestone.

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const challengesService = require("../services/challenges");
const { createErrorEmbed, createSuccessEmbed } = require("../utils/embeds");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("add-badge-role")
    .setDescription(
      "Set a role to be automatically awarded at a point milestone."
    )
    .addRoleOption((option) =>
      option
        .setName("role")
        .setDescription("The role to award as a badge.")
        .setRequired(true)
    )
    .addIntegerOption((option) =>
      option
        .setName("points")
        .setDescription("The number of points required to earn this role.")
        .setRequired(true)
        .setMinValue(1)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .setDMPermission(false),

  async execute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    // (FIX) Get the database connection from the client.
    const db = interaction.client.db;

    const role = interaction.options.getRole("role");
    const points = interaction.options.getInteger("points");
    const guild = interaction.guild;

    try {
      const botMember = await guild.members.fetch(interaction.client.user.id);
      if (botMember.roles.highest.position <= role.position) {
        const errorEmbed = createErrorEmbed(
          "Permission Error",
          `I cannot assign the ${role} role because it is higher than or equal to my own role in the server's hierarchy. Please move my role higher than the badge roles.`
        );
        return interaction.editReply({ embeds: [errorEmbed] });
      }

      if (role.managed) {
        const errorEmbed = createErrorEmbed(
          "Invalid Role",
          `The ${role} role is managed by an external integration and cannot be assigned by me.`
        );
        return interaction.editReply({ embeds: [errorEmbed] });
      }

      // (FIX) Pass the database connection to the service.
      const result = challengesService.addBadgeRole(db, {
        guildId: guild.id,
        roleId: role.id,
        pointsRequired: points,
      });

      if (!result) {
        const errorEmbed = createErrorEmbed(
          "Database Error",
          `Failed to add the badge role. It's possible this role has already been added as a badge.`
        );
        return interaction.editReply({ embeds: [errorEmbed] });
      }

      const successEmbed = createSuccessEmbed(
        "Badge Role Added",
        `Successfully configured the bot to award the ${role} role to members who reach **${points}** points.`
      );
      await interaction.editReply({ embeds: [successEmbed] });
    } catch (error) {
      console.error("Error in /add-badge-role command:", error);
      const errorEmbed = createErrorEmbed(
        "An unexpected error occurred. Please try again."
      );
      await interaction.editReply({ embeds: [errorEmbed] });
    }
  },
};
