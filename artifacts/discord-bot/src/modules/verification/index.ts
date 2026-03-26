import {
  Client,
  GuildMember,
  ChannelType,
  PermissionsBitField,
  OverwriteType,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  TextChannel,
  Message,
} from "discord.js";
import { db } from "@workspace/db";
import {
  botConfigTable,
  verificationSessionsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";

const QUESTIONS = [
  "1️⃣ Wach nta mghribi ?",
  "2️⃣ Mnin dkhlti l server ?",
  "3️⃣ 3lach dkhlti l server ?",
  "4️⃣ Ch7al f3mrk ?",
  "5️⃣ Chno lhaja libghiti tl9aha f server ?",
];

function buildVerificationButtons(disabled = false): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("verify_accept")
      .setLabel("✅ Accept")
      .setStyle(ButtonStyle.Success)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId("verify_deny")
      .setLabel("❌ Deny")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId("verify_jail")
      .setLabel("⛓ Jail")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(disabled),
    new ButtonBuilder()
      .setCustomId("verify_ticket")
      .setLabel("🎫 Open Ticket")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(disabled)
  );
}

function buildLogEmbed(member: GuildMember, answers: string[]): EmbedBuilder {
  const questionLabels = [
    "Wach nta mghribi ?",
    "Mnin dkhlti l server ?",
    "3lach dkhlti l server ?",
    "Ch7al f3mrk ?",
    "Chno lhaja libghiti tl9aha f server ?",
  ];

  const embed = new EmbedBuilder()
    .setColor(0xf1c40f)
    .setTitle("New Verification Request")
    .addFields(
      { name: "Member", value: `<@${member.id}> (${member.user.tag})`, inline: true },
      { name: "ID", value: member.id, inline: true },
      {
        name: "Account Created",
        value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
        inline: true,
      }
    )
    .addFields({ name: "\u200B", value: "**Verification Answers**" });

  for (let i = 0; i < questionLabels.length; i++) {
    embed.addFields({
      name: `${i + 1}. ${questionLabels[i]}`,
      value: answers[i] || "_No answer provided_",
    });
  }

  embed
    .setFooter({ text: "Verificators: choose an action" })
    .setTimestamp();

  return embed;
}

async function getConfig(guildId: string) {
  const result = await db
    .select()
    .from(botConfigTable)
    .where(eq(botConfigTable.guildId, guildId))
    .limit(1);
  return result[0] ?? null;
}

export function registerVerificationModule(client: Client) {
  client.on("guildMemberAdd", async (member) => {
    if (member.user.bot) return;
    const guild = member.guild;
    const config = await getConfig(guild.id);
    if (!config) return;

    try {
      const overwrites: import("discord.js").OverwriteResolvable[] = [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        },
        {
          id: member.id,
          type: OverwriteType.Member,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
          ],
        },
        {
          id: guild.members.me!.id,
          type: OverwriteType.Member,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageChannels,
            PermissionsBitField.Flags.ManageMessages,
          ],
        },
      ];

      if (config.verificatorsRoleId) {
        overwrites.push({
          id: config.verificatorsRoleId,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ReadMessageHistory,
          ],
        });
      }

      const channel = await guild.channels.create({
        name: `verify-${member.user.username}`,
        type: ChannelType.GuildText,
        parent: config.verificationCategoryId ?? undefined,
        permissionOverwrites: overwrites,
      });

      await db.insert(verificationSessionsTable).values({
        guildId: guild.id,
        memberId: member.id,
        channelId: channel.id,
        currentQuestion: 0,
        status: "pending",
      });

      const welcomeEmbed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("Welcome to Night Stars!")
        .setDescription(
          `Hello <@${member.id}>! To gain access to the server, please answer the following questions.\n\nType your answer for each question in this channel.`
        )
        .setFooter({ text: "Take your time and answer honestly." });

      await channel.send({ embeds: [welcomeEmbed] });
      await channel.send(QUESTIONS[0]);
    } catch (err) {
      console.error("Verification: failed to set up channel", err);
    }
  });

  client.on("messageCreate", async (message: Message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (message.content.startsWith("=") || message.content.startsWith("-")) return;

    const guildId = message.guild.id;
    const session = await db
      .select()
      .from(verificationSessionsTable)
      .where(
        and(
          eq(verificationSessionsTable.guildId, guildId),
          eq(verificationSessionsTable.channelId, message.channel.id),
          eq(verificationSessionsTable.memberId, message.author.id),
          eq(verificationSessionsTable.status, "pending")
        )
      )
      .limit(1);

    if (!session.length) return;

    const s = session[0];
    const q = s.currentQuestion;

    const answerField = (`answer${q + 1}`) as
      | "answer1"
      | "answer2"
      | "answer3"
      | "answer4"
      | "answer5";

    await db
      .update(verificationSessionsTable)
      .set({
        [answerField]: message.content,
        currentQuestion: q + 1,
      })
      .where(eq(verificationSessionsTable.id, s.id));

    if (q + 1 < QUESTIONS.length) {
      await message.channel.send(QUESTIONS[q + 1]);
    } else {
      await message.channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x2ecc71)
            .setDescription("✅ Thank you for your answers! A staff member will review them shortly. Please wait."),
        ],
      });

      await db
        .update(verificationSessionsTable)
        .set({ status: "submitted" })
        .where(eq(verificationSessionsTable.id, s.id));

      const config = await getConfig(guildId);
      if (!config?.verificationLogsChannelId) return;

      const logsChannel = message.guild?.channels.cache.get(
        config.verificationLogsChannelId
      ) as TextChannel | undefined;
      if (!logsChannel) return;

      const member = message.guild?.members.cache.get(message.author.id);
      if (!member) return;

      const updated = await db
        .select()
        .from(verificationSessionsTable)
        .where(eq(verificationSessionsTable.id, s.id))
        .limit(1);

      const answers = [
        updated[0].answer1 ?? "",
        updated[0].answer2 ?? "",
        updated[0].answer3 ?? "",
        updated[0].answer4 ?? "",
        updated[0].answer5 ?? "",
      ];

      const logEmbed = buildLogEmbed(member, answers);
      const buttons = buildVerificationButtons(false);

      await logsChannel.send({
        content: config.verificatorsRoleId
          ? `<@&${config.verificatorsRoleId}>`
          : undefined,
        embeds: [logEmbed],
        components: [buttons],
      });
    }
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;
    if (!interaction.guild) return;

    const customId = interaction.customId;
    const validIds = ["verify_accept", "verify_deny", "verify_jail", "verify_ticket"];
    if (!validIds.includes(customId)) return;

    const config = await getConfig(interaction.guild.id);
    if (!config) return;

    const verificatorsRoleId = config.verificatorsRoleId;
    const guildMember = interaction.guild.members.cache.get(interaction.user.id);
    if (!guildMember) return;

    if (verificatorsRoleId && !guildMember.roles.cache.has(verificatorsRoleId)) {
      await interaction.reply({
        content: "You do not have permission to use these buttons.",
        ephemeral: true,
      });
      return;
    }

    await interaction.deferUpdate();

    const embed = interaction.message.embeds[0];
    const idField = embed?.fields?.find((f) => f.name === "ID");
    const memberId = idField?.value;
    if (!memberId) return;

    const targetMember = await interaction.guild.members.fetch(memberId).catch(() => null);

    const session = await db
      .select()
      .from(verificationSessionsTable)
      .where(
        and(
          eq(verificationSessionsTable.guildId, interaction.guild.id),
          eq(verificationSessionsTable.memberId, memberId)
        )
      )
      .limit(1);

    const verificationChannelId = session[0]?.channelId;

    const disabledRow = buildVerificationButtons(true);

    if (customId === "verify_accept") {
      await interaction.message.edit({
        embeds: [
          EmbedBuilder.from(embed)
            .setColor(0x2ecc71)
            .setFooter({ text: `✅ Accepted by ${interaction.user.tag}` }),
        ],
        components: [disabledRow],
      });

      if (verificationChannelId) {
        const vChannel = interaction.guild.channels.cache.get(verificationChannelId);
        if (vChannel) {
          setTimeout(() => vChannel.delete().catch(() => {}), 3000);
        }
      }
    } else if (customId === "verify_deny") {
      if (targetMember) {
        await targetMember
          .send({
            embeds: [
              new EmbedBuilder()
                .setColor(0xe74c3c)
                .setTitle("Verification Denied")
                .setDescription(
                  "Your verification request for Night Stars has been denied. You may rejoin and try again."
                ),
            ],
          })
          .catch(() => {});
      }

      await interaction.message.edit({
        embeds: [
          EmbedBuilder.from(embed)
            .setColor(0xe74c3c)
            .setFooter({ text: `❌ Denied by ${interaction.user.tag}` }),
        ],
        components: [disabledRow],
      });

      if (verificationChannelId) {
        const vChannel = interaction.guild.channels.cache.get(verificationChannelId);
        if (vChannel) {
          setTimeout(() => vChannel.delete().catch(() => {}), 3000);
        }
      }
    } else if (customId === "verify_jail") {
      await interaction.message.edit({
        embeds: [
          EmbedBuilder.from(embed)
            .setColor(0x95a5a6)
            .setFooter({ text: `⛓ Jailed by ${interaction.user.tag}` }),
        ],
        components: [disabledRow],
      });
    } else if (customId === "verify_ticket") {
      if (!config.assistanceCategoryId) {
        await interaction.followUp({
          content: "Assistance category is not configured.",
          ephemeral: true,
        });
        return;
      }

      const ticketOverwrites: import("discord.js").OverwriteResolvable[] = [
        { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
        {
          id: interaction.guild.members.me!.id,
          type: OverwriteType.Member,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
            PermissionsBitField.Flags.ManageChannels,
          ],
        },
      ];

      if (verificatorsRoleId) {
        ticketOverwrites.push({
          id: verificatorsRoleId,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
          ],
        });
      }

      if (targetMember) {
        ticketOverwrites.push({
          id: targetMember.id,
          type: OverwriteType.Member,
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.SendMessages,
          ],
        });
      }

      const ticketChannel = await interaction.guild.channels.create({
        name: `ticket-${targetMember?.user.username ?? memberId}`,
        type: ChannelType.GuildText,
        parent: config.assistanceCategoryId,
        permissionOverwrites: ticketOverwrites,
      });

      const answers = session[0]
        ? [
            session[0].answer1 ?? "",
            session[0].answer2 ?? "",
            session[0].answer3 ?? "",
            session[0].answer4 ?? "",
            session[0].answer5 ?? "",
          ]
        : [];

      const ticketEmbed = new EmbedBuilder()
        .setColor(0x3498db)
        .setTitle("Assistance Ticket")
        .setDescription(
          `Ticket opened for <@${memberId}> by <@${interaction.user.id}>`
        )
        .addFields(
          { name: "Member ID", value: memberId, inline: true },
          {
            name: "Verification Answers",
            value:
              answers.length
                ? answers.map((a, i) => `**Q${i + 1}:** ${a || "_No answer_"}`).join("\n")
                : "_Not available_",
          }
        )
        .setFooter({ text: "Ticket created from verification" })
        .setTimestamp();

      await ticketChannel.send({ embeds: [ticketEmbed] });

      await interaction.message.edit({
        embeds: [
          EmbedBuilder.from(embed).setFooter({
            text: `🎫 Ticket opened by ${interaction.user.tag} → #${ticketChannel.name}`,
          }),
        ],
        components: [disabledRow],
      });
    }

    await db
      .update(verificationSessionsTable)
      .set({ status: customId.replace("verify_", "") })
      .where(
        and(
          eq(verificationSessionsTable.guildId, interaction.guild.id),
          eq(verificationSessionsTable.memberId, memberId)
        )
      );
  });
}
