import {
  Client,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  ChannelSelectMenuInteraction,
  RoleSelectMenuInteraction,
  ModalSubmitInteraction,
  PermissionsBitField,
  REST,
  Routes,
  SlashCommandBuilder,
  ChatInputCommandInteraction,
} from "discord.js";
import {
  openVerifyPanel,
  handleVerifyPanelSelect,
  handleVerifyPanelSave,
  handleVerifyPanelReset,
} from "./verification.js";
import {
  openPvsPanel,
  handlePvsPanelSelect,
  handlePvsPanelSave,
  handlePvsPanelReset,
} from "./pvs.js";
import {
  openCtpPanel,
  handleCtpPanelSelect,
  openCtpDetailsModal,
  handleCtpDetailsModalSubmit,
  handleCtpPanelSave,
  handleCtpPanelReset,
} from "./ctp.js";

function buildMainPanel() {
  const embed = new EmbedBuilder()
    .setColor(0x2c2f33)
    .setTitle("⭐ Night Stars — Control Panel")
    .setDescription(
      "Welcome to the Night Stars Bot control panel.\nSelect a system below to configure it."
    )
    .addFields(
      {
        name: "🛡️ Verification System",
        value: "Configure verificator roles, logs channel, verification and assistance categories.",
      },
      {
        name: "🎙️ Private Voice System (PVS)",
        value: "Set the create channel and category for private voice rooms.",
      },
      {
        name: "🎮 Call to Play (CTP)",
        value: "Link a voice category to a game role for quick player call-outs.",
      }
    )
    .setFooter({ text: "Only staff with Administrator permission can use this panel." });

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("panel_open_verify")
      .setLabel("🛡️ Verification Setup")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("panel_open_pvs")
      .setLabel("🎙️ PVS Setup")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("panel_open_ctp")
      .setLabel("🎮 CTP Setup")
      .setStyle(ButtonStyle.Success)
  );

  return { embed, row };
}

export async function registerPanelCommands(client: Client) {
  const token = process.env.DISCORD_TOKEN;
  if (!token) throw new Error("DISCORD_TOKEN is missing");

  const panelCommand = new SlashCommandBuilder()
    .setName("panel")
    .setDescription("Open the Night Stars Bot control panel")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .toJSON();

  const rest = new REST().setToken(token);

  for (const guild of client.guilds.cache.values()) {
    try {
      const existing = (await rest.get(
        Routes.applicationGuildCommands(client.user!.id, guild.id)
      )) as { name: string }[];

      const alreadyExists = existing.some((c) => c.name === "panel");
      if (!alreadyExists) {
        await rest.post(Routes.applicationGuildCommands(client.user!.id, guild.id), {
          body: panelCommand,
        });
      }
    } catch (err) {
      console.error(`Failed to register /panel for guild ${guild.name}:`, err);
    }
  }

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.guild) return;

    if (interaction.isChatInputCommand() && interaction.commandName === "panel") {
      await handlePanelCommand(interaction as ChatInputCommandInteraction);
      return;
    }

    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
      return;
    }

    if (interaction.isRoleSelectMenu()) {
      await handleRoleSelectInteraction(interaction);
      return;
    }

    if (interaction.isChannelSelectMenu()) {
      await handleChannelSelectInteraction(interaction);
      return;
    }

    if (interaction.isModalSubmit()) {
      await handleModalSubmit(interaction);
      return;
    }
  });
}

async function handlePanelCommand(interaction: ChatInputCommandInteraction) {
  const member = interaction.guild!.members.cache.get(interaction.user.id);
  if (!member?.permissions.has(PermissionsBitField.Flags.Administrator)) {
    await interaction.reply({ content: "You need Administrator permission to use this.", ephemeral: true });
    return;
  }

  const { embed, row } = buildMainPanel();
  await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
}

async function handleButtonInteraction(interaction: ButtonInteraction) {
  const { customId } = interaction;

  try {
    if (customId === "panel_open_verify") {
      await openVerifyPanel(interaction);
    } else if (customId === "panel_open_pvs") {
      await openPvsPanel(interaction);
    } else if (customId === "panel_open_ctp") {
      await openCtpPanel(interaction);
    } else if (customId === "vp_save") {
      await handleVerifyPanelSave(interaction);
    } else if (customId === "vp_reset") {
      await handleVerifyPanelReset(interaction);
    } else if (customId === "pp_save") {
      await handlePvsPanelSave(interaction);
    } else if (customId === "pp_reset") {
      await handlePvsPanelReset(interaction);
    } else if (customId === "cp_open_details") {
      await openCtpDetailsModal(interaction);
    } else if (customId === "cp_save") {
      await handleCtpPanelSave(interaction);
    } else if (customId === "cp_reset") {
      await handleCtpPanelReset(interaction);
    }
  } catch (err) {
    console.error("Panel button error:", err);
  }
}

async function handleRoleSelectInteraction(interaction: RoleSelectMenuInteraction) {
  const { customId } = interaction;
  try {
    if (customId.startsWith("vp_")) {
      await handleVerifyPanelSelect(interaction);
    } else if (customId.startsWith("cp_")) {
      await handleCtpPanelSelect(interaction);
    }
  } catch (err) {
    console.error("Panel role select error:", err);
  }
}

async function handleChannelSelectInteraction(interaction: ChannelSelectMenuInteraction) {
  const { customId } = interaction;
  try {
    if (customId.startsWith("vp_")) {
      await handleVerifyPanelSelect(interaction);
    } else if (customId.startsWith("pp_")) {
      await handlePvsPanelSelect(interaction);
    } else if (customId.startsWith("cp_")) {
      await handleCtpPanelSelect(interaction);
    }
  } catch (err) {
    console.error("Panel channel select error:", err);
  }
}

async function handleModalSubmit(interaction: ModalSubmitInteraction) {
  try {
    if (interaction.customId === "cp_details_modal") {
      await handleCtpDetailsModalSubmit(interaction);
    }
  } catch (err) {
    console.error("Panel modal submit error:", err);
  }
}
