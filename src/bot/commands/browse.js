const { EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { getGroups, getChannels, getChannelByName } = require('../../database');
const { joinVoice } = require('../../streaming/streamer');
const { startStream } = require('../../streaming/pipeline');
const { getLogger } = require('../../logger');

const ACCENT = 0x00d4ff;
const PER_PAGE = 15;
const logger = getLogger();

async function browse(interaction) {
  const groups = getGroups();
  if (!groups.length) return interaction.reply({ content: '📭 No categories available.', flags: MessageFlags.Ephemeral });

  const options = groups.slice(0, 25).map(g => ({ label: g.slice(0, 100), value: g.slice(0, 100) }));
  const select = new StringSelectMenuBuilder().setCustomId('browse:group').setPlaceholder('Pick a category...').addOptions(options);
  const row = new ActionRowBuilder().addComponents(select);

  const embed = new EmbedBuilder().setColor(ACCENT).setTitle('📂 Browse by Category')
    .setDescription(groups.slice(0, 25).map((g, i) => `**${i + 1}.** ${g}`).join('\n'))
    .setFooter({ text: `${groups.length} categories` });

  const msg = await interaction.reply({ embeds: [embed], components: [row], flags: MessageFlags.Ephemeral, fetchReply: true });

  const collector = msg.createMessageComponentCollector({ time: 15 * 60 * 1000 });
  collector.on('collect', async i => {
    if (i.customId === 'browse:group') {
      const group = i.values[0];
      const channels = getChannels({ group, limit: PER_PAGE });
      const total = getChannels({ group, limit: 99999 }).length;
      const pages = Math.max(1, Math.ceil(total / PER_PAGE));
      const listEmbed = buildGroupPage(channels, group, 1, pages);
      const rows = buildGroupRows(channels, group, 1, pages);
      await i.update({ embeds: [listEmbed], components: rows });
    } else if (i.customId.startsWith('browse:page:')) {
      const parts = i.customId.split(':');
      const group = parts[2]; const page = parseInt(parts[3]);
      const channels = getChannels({ group, limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
      const total = getChannels({ group, limit: 99999 }).length;
      const pages = Math.max(1, Math.ceil(total / PER_PAGE));
      await i.update({ embeds: [buildGroupPage(channels, group, page, pages)], components: buildGroupRows(channels, group, page, pages) });
    } else if (i.customId.startsWith('browse:play:')) {
      if (!i.member?.voice?.channelId) return i.reply({ content: '❌ Join a voice channel first.', flags: MessageFlags.Ephemeral });
      const name = i.customId.slice(12);
      const ch = getChannelByName(name);
      if (!ch) return i.reply({ content: '❌ Not found.', flags: MessageFlags.Ephemeral });
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      await joinVoice(i.guildId, i.member.voice.channelId).catch(e => logger.error(e));
      startStream(ch).catch(e => logger.error(e));
      await i.editReply({ content: `▶ Starting **${ch.tvg_name}**...` });
    }
  });
}

function buildGroupPage(channels, group, page, pages) {
  return new EmbedBuilder().setColor(ACCENT).setTitle(`📂 ${group}`)
    .setDescription(channels.map((c, i) => `**${(page-1)*PER_PAGE+i+1}.** ${c.tvg_name}`).join('\n'))
    .setFooter({ text: `Page ${page}/${pages}` });
}

function buildGroupRows(channels, group, page, pages) {
  const rows = [];
  for (let r = 0; r < 2; r++) {
    const slice = channels.slice(r * 5, r * 5 + 5);
    if (!slice.length) break;
    rows.push(new ActionRowBuilder().addComponents(slice.map(c =>
      new ButtonBuilder().setCustomId(`browse:play:${c.tvg_name.slice(0,70)}`).setLabel(`▶ ${c.tvg_name.slice(0,18)}`).setStyle(ButtonStyle.Primary)
    )));
  }
  const gEncoded = group.slice(0, 50).replace(/:/g, '_');
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`browse:page:${gEncoded}:${page-1}`).setLabel('◀ Prev').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId(`browse:page:${gEncoded}:${page+1}`).setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= pages),
  ));
  return rows;
}

module.exports = { browse };
