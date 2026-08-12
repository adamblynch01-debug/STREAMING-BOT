const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { getChannels, getChannelByName } = require('../../database');
const { joinVoice } = require('../../streaming/streamer');
const { startStream } = require('../../streaming/pipeline');
const { getLogger } = require('../../logger');

const ACCENT = 0x00d4ff;
const logger = getLogger();

async function search(interaction) {
  const query = interaction.options.getString('query', true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const results = getChannels({ search: query, limit: 20 });
  if (!results.length) return interaction.editReply({ content: `🔍 No results for **${query}**` });

  const embed = new EmbedBuilder()
    .setColor(ACCENT)
    .setTitle(`🔍 Search: ${query}`)
    .setDescription(results.map((c, i) => `**${i + 1}.** ${c.tvg_name}${c.group_title ? ` \`${c.group_title}\`` : ''}`).join('\n'))
    .setFooter({ text: `${results.length} result${results.length !== 1 ? 's' : ''}` });

  const rows = [];
  for (let r = 0; r < Math.min(2, Math.ceil(results.length / 5)); r++) {
    const slice = results.slice(r * 5, r * 5 + 5);
    rows.push(new ActionRowBuilder().addComponents(
      slice.map(c => new ButtonBuilder().setCustomId(`search:play:${c.tvg_name.slice(0, 70)}`).setLabel(`▶ ${c.tvg_name.slice(0, 18)}`).setStyle(ButtonStyle.Primary))
    ));
  }

  const msg = await interaction.editReply({ embeds: [embed], components: rows });

  const collector = msg.createMessageComponentCollector({ time: 10 * 60 * 1000 });
  collector.on('collect', async i => {
    if (!i.customId.startsWith('search:play:')) return;
    if (!i.member?.voice?.channelId) return i.reply({ content: '❌ Join a voice channel first.', flags: MessageFlags.Ephemeral });
    const name = i.customId.slice(12);
    const ch = getChannelByName(name);
    if (!ch) return i.reply({ content: '❌ Channel not found.', flags: MessageFlags.Ephemeral });
    await i.deferReply({ flags: MessageFlags.Ephemeral });
    await joinVoice(i.guildId, i.member.voice.channelId).catch(e => logger.error(e));
    startStream(ch).catch(e => logger.error(e));
    await i.editReply({ content: `▶ Starting **${ch.tvg_name}**...` });
  });
}

module.exports = { search };
