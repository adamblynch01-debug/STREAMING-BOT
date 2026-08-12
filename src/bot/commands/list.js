const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { getChannels, getChannelCount, getChannelByName } = require('../../database');
const { joinVoice } = require('../../streaming/streamer');
const { startStream, stopStream } = require('../../streaming/pipeline');
const { getLogger } = require('../../logger');

const ACCENT = 0x00d4ff;
const PER_PAGE = 15;
const logger = getLogger();

async function list(interaction) {
  const group = interaction.options.getString('group') || null;
  const page  = Math.max(1, interaction.options.getInteger('page') || 1);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const total    = getChannels({ group, limit: 99999 }).length;
  const pages    = Math.max(1, Math.ceil(total / PER_PAGE));
  const safePage = Math.min(page, pages);
  const channels = getChannels({ group, limit: PER_PAGE, offset: (safePage - 1) * PER_PAGE });

  if (!channels.length) return interaction.editReply({ content: '📭 No channels found.' });

  const { embed, rows } = buildListPage(channels, safePage, pages, group);
  const msg = await interaction.editReply({ embeds: [embed], components: rows });

  const collector = msg.createMessageComponentCollector({ time: 30 * 60 * 1000 });
  collector.on('collect', async i => {
    if (i.customId.startsWith('list:play:')) {
      const name = i.customId.slice(10);
      if (!i.member?.voice?.channelId) return i.reply({ content: '❌ Join a voice channel first.', flags: MessageFlags.Ephemeral });
      const ch = getChannelByName(name);
      if (!ch) return i.reply({ content: '❌ Channel not found.', flags: MessageFlags.Ephemeral });
      await i.deferReply({ flags: MessageFlags.Ephemeral });
      await joinVoice(i.guildId, i.member.voice.channelId).catch(e => logger.error(e));
      startStream(ch).catch(e => logger.error(e));
      await i.editReply({ content: `▶ Starting **${ch.tvg_name}**...` });
    } else if (i.customId.startsWith('list:page:')) {
      const parts = i.customId.split(':');
      const newPage = parseInt(parts[2]);
      const newGroup = parts[3] || null;
      const chs = getChannels({ group: newGroup, limit: PER_PAGE, offset: (newPage - 1) * PER_PAGE });
      const tot = getChannels({ group: newGroup, limit: 99999 }).length;
      const pgs = Math.max(1, Math.ceil(tot / PER_PAGE));
      const { embed: e2, rows: r2 } = buildListPage(chs, newPage, pgs, newGroup);
      await i.update({ embeds: [e2], components: r2 });
    }
  });
}

function buildListPage(channels, page, pages, group) {
  const embed = new EmbedBuilder()
    .setColor(ACCENT)
    .setTitle(`📋 Channel List${group ? ` — ${group}` : ''}`)
    .setDescription(channels.map((c, i) => `**${(page - 1) * PER_PAGE + i + 1}.** ${c.tvg_name}${c.group_title ? ` \`${c.group_title}\`` : ''}`).join('\n'))
    .setFooter({ text: `Page ${page}/${pages} · ${getChannelCount()} channels total` });

  const playRows = [];
  for (let r = 0; r < 2; r++) {
    const slice = channels.slice(r * 5, r * 5 + 5);
    if (!slice.length) break;
    playRows.push(new ActionRowBuilder().addComponents(
      slice.map(c => new ButtonBuilder().setCustomId(`list:play:${c.tvg_name.slice(0, 70)}`).setLabel(`▶ ${c.tvg_name.slice(0, 18)}`).setStyle(ButtonStyle.Primary))
    ));
  }

  const navRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`list:page:${page - 1}:${group || ''}`).setLabel('◀ Prev').setStyle(ButtonStyle.Secondary).setDisabled(page <= 1),
    new ButtonBuilder().setCustomId(`list:page:${page + 1}:${group || ''}`).setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(page >= pages),
  );

  return { embed, rows: [...playRows, navRow] };
}

module.exports = { list };
