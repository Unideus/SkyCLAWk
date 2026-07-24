'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { validOrderId } = require('./validation');

class OrderStore {
  constructor({
    ordersDir,
    outputDir,
    retentionMs = 7 * 24 * 60 * 60 * 1000,
    clock = () => Date.now(),
    logger,
  }) {
    this.ordersDir = ordersDir;
    this.outputDir = outputDir;
    this.clock = clock;
    this.retentionMs = retentionMs;
    this.logger = logger;
    this.cleanupTimer = null;
    this.initializeDirectories();
  }

  initializeDirectories() {
    for (const directory of [this.ordersDir, this.outputDir]) {
      fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
      try {
        fs.chmodSync(directory, 0o700);
      } catch (_error) {
        // Some mounted filesystems do not expose POSIX permissions.
      }
    }
  }

  orderPath(orderId) {
    if (!validOrderId(orderId)) return null;
    return path.join(this.ordersDir, `${orderId}.json`);
  }

  get(orderId) {
    const filePath = this.orderPath(orderId);
    if (!filePath || !fs.existsSync(filePath)) return null;
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (_error) {
      this.logger.error('order_read_failed', { orderId, error: _error });
      return null;
    }
  }

  write(order) {
    const filePath = this.orderPath(order?.id);
    if (!filePath) throw new Error('Invalid order identifier');
    const next = {
      ...order,
      updatedAt: new Date(this.clock()).toISOString(),
    };
    const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(next, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    fs.renameSync(temporaryPath, filePath);
    return next;
  }

  update(orderId, transform) {
    const current = this.get(orderId);
    if (!current) return null;
    const next = transform({ ...current });
    if (!next) return current;
    return this.write(next);
  }

  remove(orderId) {
    const order = this.get(orderId);
    if (order?.pdfFilename) this.removePdf(order.pdfFilename);
    const filePath = this.orderPath(orderId);
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  removePdf(filename) {
    if (!filename) return;
    const safeName = path.basename(filename);
    const filePath = path.join(this.outputDir, safeName);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }

  list() {
    const orders = [];
    for (const filename of fs.readdirSync(this.ordersDir)) {
      if (!filename.endsWith('.json')) continue;
      const orderId = filename.slice(0, -5);
      const order = this.get(orderId);
      if (order) orders.push(order);
    }
    return orders;
  }

  cleanupExpired() {
    const now = this.clock();
    let removed = 0;
    let scrubbed = 0;
    const referencedPdfs = new Set();
    for (const filename of fs.readdirSync(this.ordersDir)) {
      if (!filename.endsWith('.json')) continue;
      const filePath = path.join(this.ordersDir, filename);
      let order;
      try {
        order = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      } catch (_error) {
        const stat = fs.statSync(filePath);
        if (now - stat.mtimeMs < this.retentionMs) continue;
        fs.unlinkSync(filePath);
        removed += 1;
        continue;
      }
      if (order.pdfFilename) referencedPdfs.add(path.basename(order.pdfFilename));
      if (order.status === 'generating' && validOrderId(order.id)) {
        referencedPdfs.add(`${order.id}.partial.pdf`);
      }
      if (new Date(order.expiresAt).getTime() > now) continue;
      if (['paid', 'generating'].includes(order.status)) {
        const scrubbedOrder = {
          ...order,
          status: 'expired_unfulfilled',
          expiredAt: new Date(now).toISOString(),
          birthDataScrubbedAt: new Date(now).toISOString(),
          failureCode: 'retention_window_expired',
        };
        delete scrubbedOrder.birthData;
        delete scrubbedOrder.pdfFilename;
        this.removePdf(`${order.id}.partial.pdf`);
        this.removePdf(`${order.id}.pdf`);
        this.write(scrubbedOrder);
        scrubbed += 1;
        this.logger.error('paid_order_expired_unfulfilled', { orderId: order.id });
        continue;
      }
      if (order.pdfFilename) this.removePdf(order.pdfFilename);
      fs.unlinkSync(filePath);
      removed += 1;
    }

    // Remove renderer leftovers and PDFs whose order file was already lost.
    // Active and retained ready-order PDFs are excluded by the reference set.
    for (const filename of fs.readdirSync(this.outputDir)) {
      if (!/^[0-9a-f-]{36}(?:\.partial)?\.pdf$/i.test(filename)) continue;
      if (referencedPdfs.has(filename)) continue;
      const filePath = path.join(this.outputDir, filename);
      const stat = fs.statSync(filePath);
      if (now - stat.mtimeMs < this.retentionMs) continue;
      fs.unlinkSync(filePath);
      removed += 1;
    }
    if (removed) this.logger.info('retention_cleanup_completed', { status: String(removed) });
    if (scrubbed) this.logger.error('retention_birth_data_scrubbed', { status: String(scrubbed) });
    return removed;
  }

  startCleanup(intervalMs) {
    this.cleanupExpired();
    this.cleanupTimer = setInterval(() => {
      try {
        this.cleanupExpired();
      } catch (error) {
        this.logger.error('retention_cleanup_failed', { error });
      }
    }, intervalMs);
    this.cleanupTimer.unref();
  }

  stopCleanup() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
  }
}

module.exports = {
  OrderStore,
};
