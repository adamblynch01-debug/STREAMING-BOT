const { EmbedBuilder, MessageFlags } = require('discord.js');
const { getChannels, getChannelCount, getProgrammeCount } = require('../../database');
const { getCurrentChannel, getUptime } = require('../../streaming/pipeline');
const { getCurrentVoiceChannelId, isStreamerReady } = require('../../streaming/streamer');

const ACCENT = 0x00d4ff;

async function status(interaction) {
  const current = getCurrentChannel();
  const uptime  = getUptime();
  const h = Math.floor(uptime / 3600), m = Math.floor((uptime % 3600) / 60), s = uptime % 60;

  const embed = new EmbedBuilder()
    .setColor(ACCENT)
    .setTitle('📊 Luminary Status')
    .addFields(
      { name: '🤖 Bot',        value: '🟢 Online',                  inline: true },
      { name: '📡 Streamer',   value: isStreamerReady() ? '🟢 Ready' : '🔴 Offline', inline: true },
      { name: '⏱ Uptime',     value: `${h}h ${m}m ${s}s`,          inline: true },
      { name: '📺 Channels',   value: `${getChannelCount()}`,        inline: true },
      { name: '📋 Programmes', value: `${getProgrammeCount()}`,      inline: true },
      { name: '🔴 Streaming',  value: current ? `**${current.tvg_name}**` : 'Nothing', inline: true },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
}

module.exports = { status };
