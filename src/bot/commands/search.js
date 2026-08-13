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
      slice.map(c => new ButtonBuilder().setCustomId(`search:${c.id}`).setLabel(`▶ ${c.tvg_name.slice(0, 18)}`).setStyle(ButtonStyle.Primary))
    ));
  }

  const msg = await interaction.editReply({ embeds: [embed], components: rows });

  const collector = msg.createMessageComponentCollector({ time: 10 * 60 * 1000 });
  collector.on('collect', async i => {
    try {
      logger.info(`Button clicked: ${i.customId}`);
      if (!i.customId.startsWith('search:')) return;
      if (!i.member?.voice?.channelId) {
        logger.info('User not in voice channel');
        return i.reply({ content: '❌ Join a voice channel first.', flags: MessageFlags.Ephemeral });
      }
      const channelId = parseInt(i.customId.slice(7), 10);
      logger.info(`Looking up channel ID: ${channelId}`);
      const ch = getChannels({ id: channelId })[0];
      if (!ch) {
        logger.warn(`Channel ${channelId} not found in database`);
        return i.reply({ content: '❌ Channel not found.', flags: MessageFlags.Ephemeral });
      }
      logger.info(`Found channel: ${ch.tvg_name}`);
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      await joinVoice(i.guildId, i.member.voice.channelId);
      await startStream(ch);
      await i.editReply({ content: `▶ Now streaming **${ch.tvg_name}**` });
    } catch (err) {
      logger.error(`Button handler error: ${err.stack}`);
      try {
        if (i.deferred) await i.editReply({ content: `❌ Error: ${err.message}` });
        else await i.reply({ content: `❌ Error: ${err.message}`, flags: MessageFlags.Ephemeral });
      } catch {}
    }
  });
}

module.exports = { search };
