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
  const conn = streamer.voiceConnection;
  if (conn?.channelId === channelId) return; // already there
  const res = await streamer.joinVoice(guildId, channelId);
  if (!res.ready) throw new Error('Failed to join voice channel');
  const guild = streamer.client.guilds.cache.get(guildId);
  const ch    = guild?.channels.cache.get(channelId);
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
