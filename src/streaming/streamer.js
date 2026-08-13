const { Client } = require('discord.js-selfbot-v13');
const { Streamer } = require('@dank074/discord-video-stream');
const { config } = require('../config');
const { getLogger } = require('../logger');

const logger = getLogger();

// Create client with all intents for gateway events
const client = new Client({
  checkUpdate: false,
  ws: { properties: { browser: 'Discord Client' } }
});

// Enable raw event debugging
client.on('raw', (packet) => {
  if (packet.t === 'VOICE_STATE_UPDATE' || packet.t === 'VOICE_SERVER_UPDATE') {
    const safeData = packet.t === 'VOICE_SERVER_UPDATE'
      ? { guild_id: packet.d?.guild_id, channel_id: packet.d?.channel_id, endpoint: packet.d?.endpoint ? 'REDACTED' : null }
      : { guild_id: packet.d?.guild_id, channel_id: packet.d?.channel_id, user_id: packet.d?.user_id, session_id: packet.d?.session_id ? 'REDACTED' : null };
    logger.info(`[Gateway] Received ${packet.t}: guild=${safeData.guild_id} channel=${safeData.channel_id} user=${safeData.user_id || 'N/A'}`);
  }
});

const streamer = new Streamer(client);

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
  logger.info(`[JoinVoice] Calling streamer.joinVoice(${guildId}, ${channelId}) now...`);

  // WORKAROUND: @dank074/discord-video-stream v5 filters out VOICE_SERVER_UPDATE
  // when channel_id is missing (Discord doesn't always send it for guild voice).
  // We intercept the raw event and inject the channel_id if missing.
  const rawPatcher = (packet) => {
    if (packet.t === 'VOICE_SERVER_UPDATE' && packet.d?.guild_id === guildId) {
      if (!packet.d.channel_id) {
        logger.info(`[JoinVoice] Patching missing channel_id into VOICE_SERVER_UPDATE`);
        packet.d.channel_id = channelId;
      }
    }
  };
  client.on('raw', rawPatcher);

  // Use streamer.joinVoice() with a 30s timeout
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error('joinVoice timeout after 30s')), 30000)
  );

  try {
    const udpConn = await Promise.race([
      streamer.joinVoice(guildId, channelId),
      timeout
    ]);
    logger.info(`[JoinVoice] SUCCESS — UDP connection established`);
  } catch (err) {
    logger.error(`joinVoice failed: ${err.message}`);
    throw new Error(`Failed to join voice: ${err.message}`);
  } finally {
    client.off('raw', rawPatcher);
  }
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
