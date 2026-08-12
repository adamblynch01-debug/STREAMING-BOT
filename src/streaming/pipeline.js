const { prepareStream, playStream, Utils } = require('@dank074/discord-video-stream');
const { config } = require('../config');
const { getLogger } = require('../logger');
const { getStreamer, isStreamerReady, leaveVoice } = require('./streamer');

const logger = getLogger();
let abortCtrl = new AbortController();
let currentChannel = null;
let monitorInterval = null;
let aloneSeconds = 0;
const startTime = Date.now();

function getCurrentChannel() { return currentChannel; }
function getUptime() { return Math.floor((Date.now() - startTime) / 1000); }

async function startStream(channel) {
  if (!isStreamerReady()) throw new Error('Streamer not ready');
  await stopStream();

  const streamer = getStreamer();
  const bufSize = config.BITRATE_VIDEO * 3;

  const { command, output } = prepareStream(channel.url, {
    noTranscoding:    config.DISABLE_TRANSCODE,
    minimizeLatency:  config.MINIMIZE_LATENCY,
    bitrateVideo:     config.BITRATE_VIDEO,
    bitrateVideoMax:  config.BITRATE_VIDEO_MAX,
    videoCodec:       Utils.normalizeVideoCodec('H264'),
    h26xPreset:       'veryfast',
    customFfmpegFlags: [
      '-reconnect', '1',
      '-reconnect_streamed', '1',
      '-reconnect_delay_max', '5',
      '-fflags', 'nobuffer',
      '-flags', 'low_delay',
      '-buffer_size', `${bufSize}k`,
      '-max_delay', '500000',
    ],
  }, abortCtrl.signal);

  currentChannel = channel;

  command.on('error', async (err) => {
    if (!String(err).includes('255')) logger.error(`FFmpeg error: ${err}`);
    currentChannel = null;
  });

  command.on('end', async () => {
    currentChannel = null;
  });

  _startMonitor();

  try {
    logger.info(`Streaming: ${channel.tvg_name || channel.url}`);
    await playStream(output, streamer, { type: 'go-live' }, abortCtrl.signal);
  } finally {
    _stopMonitor();
    currentChannel = null;
  }
}

async function stopStream() {
  _stopMonitor();
  abortCtrl.abort();
  await new Promise(r => setTimeout(r, 800));
  abortCtrl = new AbortController();
  if (currentChannel) {
    logger.info(`Stopped stream: ${currentChannel.tvg_name}`);
    currentChannel = null;
  }
}

function _startMonitor() {
  aloneSeconds = 0;
  if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; }
  monitorInterval = setInterval(() => {
    try {
      const streamer = getStreamer();
      const chId = streamer.voiceConnection?.channelId;
      if (!chId) return;
      const ch = streamer.client.channels.cache.get(chId);
      if (!ch?.isVoice?.()) return;
      const selfId = streamer.client.user?.id;
      const humans = ch.members.filter(m => !m.user.bot && m.id !== selfId).size;
      if (humans === 0) {
        aloneSeconds += 15;
        if (aloneSeconds >= config.STREAM_TIMEOUT * 60) {
          logger.info('Auto-stop: alone in voice channel too long');
          stopStream().then(() => leaveVoice()).catch(e => logger.error(e));
        }
      } else {
        aloneSeconds = 0;
      }
    } catch (err) { logger.error(`Monitor error: ${err}`); }
  }, 15_000);
}

function _stopMonitor() {
  if (monitorInterval) { clearInterval(monitorInterval); monitorInterval = null; aloneSeconds = 0; }
}

module.exports = { startStream, stopStream, getCurrentChannel, getUptime };
