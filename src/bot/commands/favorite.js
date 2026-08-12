const { EmbedBuilder, MessageFlags } = require('discord.js');
const { getFavorites, addFavorite, removeFavorite, getChannelByName } = require('../../database');

const ACCENT = 0x00d4ff;

async function favorite(interaction) {
  const action  = interaction.options.getString('action', true);
  const chName  = interaction.options.getString('channel');
  const userId  = interaction.user.id;
  const guildId = interaction.guildId;

  if (action === 'list') {
    const favs = getFavorites(userId, guildId);
    const embed = new EmbedBuilder().setColor(ACCENT).setTitle('⭐ Your Favorites');
    if (!favs.length) embed.setDescription('No favorites yet. Use `/favorite add channel:<name>`');
    else embed.setDescription(favs.map((c, i) => `**${i+1}.** ${c.tvg_name}${c.group_title ? ` \`${c.group_title}\`` : ''}`).join('\n'));
    return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  if (!chName) return interaction.reply({ content: '❌ Provide a channel name.', flags: MessageFlags.Ephemeral });
  const ch = getChannelByName(chName);
  if (!ch) return interaction.reply({ content: `❌ Channel not found: **${chName}**`, flags: MessageFlags.Ephemeral });

  if (action === 'add') {
    const ok = addFavorite(userId, guildId, ch.id);
    return interaction.reply({ content: ok ? `⭐ Added **${ch.tvg_name}** to favorites.` : `Already in favorites.`, flags: MessageFlags.Ephemeral });
  }

  if (action === 'remove') {
    const ok = removeFavorite(userId, guildId, ch.id);
    return interaction.reply({ content: ok ? `🗑 Removed **${ch.tvg_name}** from favorites.` : `Not in your favorites.`, flags: MessageFlags.Ephemeral });
  }
}

module.exports = { favorite };
