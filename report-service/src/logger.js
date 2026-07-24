'use strict';

function createSafeLogger(target = console, level = 'info') {
  const enabled = level !== 'silent';
  const write = (method, event, fields = {}) => {
    if (!enabled) return;
    const safeFields = {};
    for (const key of ['orderId', 'status', 'provider', 'eventType', 'queueDepth']) {
      if (fields[key] !== undefined) safeFields[key] = fields[key];
    }
    if (fields.error) {
      safeFields.error = String(fields.error.code || fields.error.name || 'Error').slice(0, 80);
    }
    target[method](JSON.stringify({
      time: new Date().toISOString(),
      event,
      ...safeFields,
    }));
  };

  return {
    info: (event, fields) => write('info', event, fields),
    warn: (event, fields) => write('warn', event, fields),
    error: (event, fields) => write('error', event, fields),
  };
}

module.exports = {
  createSafeLogger,
};
