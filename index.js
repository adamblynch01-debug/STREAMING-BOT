require('dotenv').config();
const { config } = require('./src/config');
const { getLogger } = require('./src/logger');
const { initDatabase } = require('./src/database');
const { downloadAndSync, stopRefresh } = require('./src/iptv/sync');
const { initStreamer } = require('./src/streaming/streamer');
const { buildClient } = require('./src/bot/client');

const logger = getLogger();
let botClient;

async function start() {
  logger.info('╔══════════════════════════════╗');
  logger.info('║   LUMINARY  —  IPTV Bot      ║');
  logger.info('╚══════════════════════════════╝');
  try {
    initDatabase();
    await initStreamer();
    await downloadAndSync();
    botClient = buildClient();
    await botClient.login(config.DISCORD_BOT_TOKEN);
  } catch (err) {
    logger.error(`Startup failed: ${err}`);
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info(`${signal} — shutting down`);
  try {
    stopRefresh();
    if (botClient?.isReady()) await botClient.destroy();
    process.exit(0);
  } catch (err) {
    logger.error(`Shutdown error: ${err}`);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('unhandledRejection', r => logger.error(`Unhandled rejection: ${r}`));
process.on('uncaughtException',  e => logger.error(`Uncaught exception: ${e}`));

start();
