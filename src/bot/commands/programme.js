const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const { getChannels, getChannelByName, getProgrammes } = require('../../database');

const ACCENT = 0x00d4ff;
const PER_PAGE = 20;

async function programme(interaction) {
  const channelName = interaction.options.getString('channel');
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (channelName) {
    const ch = getChannelByName(channelName);
    if (!ch) return interaction.editReply({ content: `❌ Channel not found: **${channelName}**` });
    const progs = ch.tvg_id ? getProgrammes(ch.tvg_id, Math.floor(Date.now()/1000)) : [];
    return interaction.editReply({ embeds: [buildProgEmbed(ch, progs)] });
  }

  // Paginated channel picker
  const channels = getChannels({ limit: PER_PAGE });
  const total = getChannels({ limit: 99999 }).length;
  const pages = Math.max(1, Math.ceil(total / PER_PAGE));
  const { embed, rows } = buildPickerPage(channels, 1, pages);
  const msg = await interaction.editReply({ embeds: [embed], components: rows });

  const collector = msg.createMessageComponentCollector({ time: 10 * 60 * 1000 });
  collector.on('collect', async i => {
    if (i.customId.startsWith('prog:ch:')) {
      const name = i.customId.slice(8);
      const ch = getChannelByName(name);
      if (!ch) return i.reply({ content: '❌ Not found.', flags: MessageFlags.Ephemeral });
      const progs = ch.tvg_id ? getProgrammes(ch.tvg_id, Math.floor(Date.now()/1000)) : [];
      await i.reply({ embeds: [buildProgEmbed(ch, progs)], flags: MessageFlags.Ephemeral });
    } else if (i.customId.startsWith('prog:page:')) {
      const p = parseInt(i.customId.slice(10));
      const chs = getChannels({ limit: PER_PAGE, offset: (p - 1) * PER_PAGE });
      const tot = getChannels({ limit: 99999 }).length;
      const pgs = Math.max(1, Math.ceil(tot / PER_PAGE));
      const { embed: e2, rows: r2 } = buildPickerPage(chs, p, pgs);
      await i.update({ embeds: [e2], components: r2 });
    }
  });
}

function buildProgEmbed(ch, progs) {
  const embed = new EmbedBuilder().setColor(ACCENT).setTitle(`📺 ${ch.tvg_name}`);
  if (!progs.length) return embed.setDescription('No programme data available.');
  const now = Math.floor(Date.now() / 1000);
  for (const p of progs.slice(0, 10)) {
    const live = p.start_ts <= now && p.stop_ts > now;
    const dur = Math.round((p.stop_ts - p.start_ts) / 60);
    embed.addFields({ name: `${live ? '🔴 LIVE' : '⏰'} ${p.title}`, value: `<t:${p.start_ts}:t>–<t:${p.stop_ts}:t> (${dur}min)${p.description ? `\n${p.description.slice(0,100)}` : ''}`, inline: false });
  }
  return embed;
}

function buildPickerPage(channels, page, pages) {
  const embed = new EmbedBuilder().setColor(ACCENT).setTitle('📺 Programme Guide — Pick a Channel')
    .setDescription(channels.map((c, i) => `**${(page-1)*PER_PAGE+i+1}.** ${c.tvg_name}`).join('\n'))
    .setFooter({ text: `Page ${page}/${pages}` });
  const rows = [];
  for (let r = 0; r < 2; r++) {
    const slice = channels.slice(r * 5, r * 5 + 5);
    if (!slice.length) break;
    rows.push(new ActionRowBuilder().addComponents(slice.map(c =>
      new ButtonBuilder().setCustomId(`prog:ch:${c.tvg_name.slice(0,70)}`).setLabel(c.tvg_name.slice(0,20)).setStyle(ButtonStyle.Secondary)
    )));
  }
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`prog:page:${page-1}`).setLabel('◀ Prev').setStyle(ButtonStyle.Secondary).setDisabled(page<=1),
    new ButtonBuilder().setCustomId(`prog:page:${page+1}`).setLabel('Next ▶').setStyle(ButtonStyle.Secondary).setDisabled(page>=pages),
  ));
  return { embed, rows };
}

module.exports = { programme };
