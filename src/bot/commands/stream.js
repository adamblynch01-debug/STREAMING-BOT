const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { getChannelByName, getProgrammes } = require('../../database');
const { joinVoice, getCurrentVoiceChannelId } = require('../../streaming/streamer');
const { startStream, stopStream, getCurrentChannel } = require('../../streaming/pipeline');
const { config } = require('../../config');
const { getLogger } = require('../../logger');

const logger = getLogger();
const ACCENT = 0x00d4ff;

async function stream(interaction) {
  const voiceState = interaction.member?.voice;
  if (!voiceState?.channelId) {
    return interaction.reply({ content: '❌ Join a voice channel first.', flags: MessageFlags.Ephemeral });
  }

  const channelName = interaction.options.getString('channel', true);
  const channel = getChannelByName(channelName);
  if (!channel) {
    return interaction.reply({ content: `❌ Channel not found: **${channelName}**`, flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    await joinVoice(interaction.guildId, voiceState.channelId);
  } catch (err) {
    logger.error(`joinVoice failed: ${err}`);
    return interaction.editReply({ content: `❌ Could not join your voice channel.` });
  }

  const now = Math.floor(Date.now() / 1000);
  const progs = channel.tvg_id ? getProgrammes(channel.tvg_id, now) : [];
  const current = progs.find(p => p.start_ts <= now && p.stop_ts > now) || null;
  const upcoming = progs.filter(p => p.start_ts > now).slice(0, 5);

  const embed = buildStreamEmbed(channel, current, upcoming);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('stream:stop').setLabel('⏹ Stop').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`stream:prog:${channel.tvg_name}`).setLabel('📺 Programme').setStyle(ButtonStyle.Secondary),
  );

  const msg = await interaction.editReply({ embeds: [embed], components: [row] });

  // Start stream in background — report error if it fails within 4s
  let errored = false;
  const streamPromise = startStream(channel).catch(err => {
    errored = true;
    logger.error(`Stream error: ${err}`);
    interaction.followUp({ content: `❌ Stream failed: ${err.message}`, flags: MessageFlags.Ephemeral }).catch(() => {});
  });

  await new Promise(r => setTimeout(r, 4000));
  if (!errored) {
    interaction.followUp({ content: `▶ Now streaming **${channel.tvg_name}**`, flags: MessageFlags.Ephemeral }).catch(() => {});
  }

  const collector = msg.createMessageComponentCollector({ time: 4 * 60 * 60 * 1000 });
  collector.on('collect', async i => {
    if (i.customId === 'stream:stop') {
      await stopStream();
      const { leaveVoice } = require('../../streaming/streamer');
      await leaveVoice();
      await i.reply({ content: '⏹ Stream stopped.', flags: MessageFlags.Ephemeral });
    } else if (i.customId.startsWith('stream:prog:')) {
      const name = i.customId.slice(12);
      const ch = getChannelByName(name);
      if (!ch?.tvg_id) return i.reply({ content: 'No programme data.', flags: MessageFlags.Ephemeral });
      const p = getProgrammes(ch.tvg_id, Math.floor(Date.now()/1000));
      await i.reply({ embeds: [buildProgEmbed(ch, p)], flags: MessageFlags.Ephemeral });
    }
  });
}

function buildStreamEmbed(ch, current, upcoming) {
  const embed = new EmbedBuilder().setColor(ACCENT).setTitle(`📡 ${ch.tvg_name}`);
  if (ch.tvg_logo?.startsWith('https')) embed.setThumbnail(ch.tvg_logo);
  if (ch.group_title) embed.addFields({ name: 'Category', value: ch.group_title, inline: true });
  if (current) embed.addFields({ name: '🔴 Now', value: `**${current.title}**${current.description ? `\n${current.description.slice(0,100)}` : ''}`, inline: false });
  if (upcoming.length) embed.addFields({ name: '📋 Up Next', value: upcoming.map(p => `• **${p.title}** <t:${p.start_ts}:t>`).join('\n'), inline: false });
  embed.setFooter({ text: 'Use /stop to end the stream' }).setTimestamp();
  return embed;
}

function buildProgEmbed(ch, progs) {
  const embed = new EmbedBuilder().setColor(ACCENT).setTitle(`📺 ${ch.tvg_name} — Programme`);
  const now = Math.floor(Date.now()/1000);
  for (const p of progs.slice(0, 8)) {
    const live = p.start_ts <= now && p.stop_ts > now;
    embed.addFields({ name: `${live ? '🔴 LIVE' : '⏰'} ${p.title}`, value: `<t:${p.start_ts}:t> – <t:${p.stop_ts}:t>${p.description ? `\n${p.description.slice(0,80)}` : ''}`, inline: false });
  }
  return embed;
}

module.exports = { stream };
