const { MessageFlags } = require('discord.js');
const { stopStream } = require('../../streaming/pipeline');
const { leaveVoice } = require('../../streaming/streamer');

async function stop(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await stopStream();
  await leaveVoice();
  await interaction.editReply({ content: '⏹ Stream stopped and left voice channel.' });
}

module.exports = { stop };
