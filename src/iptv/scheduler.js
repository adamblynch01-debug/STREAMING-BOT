const { config } = require('../config');
const { getLogger } = require('../logger');

const logger = getLogger();
let intervalId = null;

function scheduleRefresh() {
  if (intervalId) return;
  const ms = config.REFRESH_INTERVAL * 60 * 1000;
  intervalId = setInterval(async () => {
    logger.info('Scheduled IPTV refresh starting...');
    const { downloadAndSync } = require('./sync');
    await downloadAndSync(false).catch(err => logger.error(`Refresh error: ${err}`));
  }, ms);
  logger.info(`IPTV refresh scheduled every ${config.REFRESH_INTERVAL} minutes`);
}

function stopRefresh() {
  if (intervalId) { clearInterval(intervalId); intervalId = null; logger.info('IPTV refresh stopped'); }
}

module.exports = { scheduleRefresh, stopRefresh };
