const { MessageFlags } = require('discord.js');
const { downloadAndSync, syncPlaylist, syncXMLTV } = require('../../iptv/sync');
const { getLogger } = require('../../logger');

const logger = getLogger();

async function refresh(interaction) {
  if (!interaction.memberPermissions?.has('Administrator')) {
    return interaction.reply({ content: '❌ Admin only.', flags: MessageFlags.Ephemeral });
  }
  const type = interaction.options.getString('type', true);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    if (type === 'all')       await downloadAndSync(true);
    else if (type === 'channels') await syncPlaylist(true);
    else if (type === 'programme') await syncXMLTV(true);
    await interaction.editReply({ content: `✅ Refreshed **${type}** successfully.` });
  } catch (err) {
    logger.error(`Refresh error: ${err}`);
    await interaction.editReply({ content: `❌ Refresh failed: ${err.message}` });
  }
}

module.exports = { refresh };
