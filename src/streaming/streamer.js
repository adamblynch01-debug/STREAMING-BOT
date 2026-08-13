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
  const selfMember = guild?.members.cache.get(streamer.client.user.id);

  // Check if already in the target voice channel
  if (selfMember?.voice?.channelId === channelId) {
    logger.info(`Already in voice channel ${channelId}, skipping join`);
    // Still try to undeafen/unmute
    if (selfMember.voice) {
      logger.info('Attempting to undeafen/unmute selfbot');
      await selfMember.voice.setDeaf(false);
      await selfMember.voice.setMute(false);
      logger.info('Selfbot undeafened/unmuted');
    }
    return;
  }

  logger.info(`Attempting to join voice channel ${channelId} in guild ${guildId}`);

  // Add timeout to prevent hanging forever
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('joinVoice timeout after 10s')), 10000)
  );

  const res = await Promise.race([
    streamer.joinVoice(guildId, channelId),
    timeout
  ]);

  logger.info(`joinVoice returned: ready=${res.ready}`);
  if (!res.ready) throw new Error('Failed to join voice channel');

  // Undeafen and unmute the selfbot
  const updatedSelfMember = guild?.members.cache.get(streamer.client.user.id);
  if (updatedSelfMember?.voice) {
    logger.info('Attempting to undeafen/unmute selfbot');
    await updatedSelfMember.voice.setDeaf(false);
    await updatedSelfMember.voice.setMute(false);
    logger.info('Selfbot undeafened/unmuted');
  }

  const ch = guild?.channels.cache.get(channelId);
  logger.info(`Joined voice: ${ch?.name || channelId} in ${guild?.name || guildId}`);
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
