const { createLogger, format, transports } = require('winston');
const { combine, timestamp, printf, colorize } = format;

let _logger;

function getLogger() {
  if (_logger) return _logger;
  const { config } = require('./config');
  const fmt = printf(({ level, message, timestamp }) => `${timestamp} [${level}] ${message}`);
  _logger = createLogger({
    level: config.DEBUG ? 'debug' : 'info',
    format: combine(timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }), fmt),
    transports: [
      new transports.Console({
        format: combine(colorize(), timestamp({ format: 'HH:mm:ss' }), fmt)
      })
    ]
  });
  return _logger;
}

module.exports = { getLogger };
