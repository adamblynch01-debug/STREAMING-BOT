const { Client } = require('discord.js-selfbot-v13');
const { Streamer } = require('@dank074/discord-video-stream');
const { config } = require('../config');
const { getLogger } = require('../logger');

const logger = getLogger();
const streamer = new Streamer(new Client());

async function initStreamer() {
  try {
    if (streamer.client.isReady()) return;
    await streamer.client.login(config.DISCORD_USER_TOKEN);
    logger.info('Streamer (selfbot) logged in');
  } catch (err) {
    logger.error(`Streamer login failed: ${err}`);
    throw err;
  }
}

async function joinVoice(guildId, channelId) {
  if (!streamer.client.isReady()) throw new Error('Streamer not ready');

  const guild = streamer.client.guilds.cache.get(guildId);
  if (!guild) throw new Error(`Guild ${guildId} not found`);

  const channel = guild.channels.cache.get(channelId);
  if (!channel) throw new Error(`Channel ${channelId} not found`);

  const selfMember = guild.members.cache.get(streamer.client.user.id);

  // Check if already in the target voice channel
  if (selfMember?.voice?.channelId === channelId) {
    logger.info(`Already in voice channel ${channelId}, skipping join`);
    // Still try to undeafen/unmute
    if (selfMember.voice) {
      logger.info('Attempting to undeafen/unmute selfbot');
      try {
        await selfMember.voice.setDeaf(false);
        await selfMember.voice.setMute(false);
        logger.info('Selfbot undeafened/unmuted');
      } catch (err) {
        logger.error(`Failed to undeafen/unmute: ${err.message}`);
      }
    }
    return;
  }

  logger.info(`Attempting to join voice channel ${channel.name} (${channelId}) in guild ${guild.name}`);

  // Use streamer.joinVoice() with a 30s timeout
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('joinVoice timeout after 30s (Discord gateway events not received)')), 30000)
  );

  try {
    const udpConn = await Promise.race([
      streamer.joinVoice(guildId, channelId),
      timeout
    ]);
    logger.info(`joinVoice succeeded, UDP connection established`);
  } catch (err) {
    logger.error(`joinVoice failed: ${err.message}`);
    throw new Error(`Failed to join voice: ${err.message}`);
  }

  // Undeafen and unmute the selfbot
  const updatedSelfMember = guild.members.cache.get(streamer.client.user.id);
  if (updatedSelfMember?.voice) {
    logger.info('Attempting to undeafen/unmute selfbot');
    try {
      await updatedSelfMember.voice.setDeaf(false);
      await updatedSelfMember.voice.setMute(false);
      logger.info('Selfbot undeafened/unmuted');
    } catch (err) {
      logger.error(`Failed to undeafen/unmute: ${err.message}`);
    }
  }

  logger.info(`Joined voice: ${channel.name} in ${guild.name}`);
}

async function leaveVoice() {
  if (!streamer.client.isReady()) return;
  try {
    streamer.leaveVoice();
    logger.info('Left voice channel');
  } catch (err) {
    logger.error(`Leave voice error: ${err}`);
  }
}

function getStreamer() { return streamer; }
function isStreamerReady() { return streamer.client.isReady(); }
function getCurrentVoiceChannelId() { return streamer.voiceConnection?.channelId || null; }

module.exports = { initStreamer, joinVoice, leaveVoice, getStreamer, isStreamerReady, getCurrentVoiceChannelId };
