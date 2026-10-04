// Runs in the main process, even when the renderer is hidden or throttled.
// SQLite owns the cutoff and idempotency; this clock only requests a check.
class RegisterClosingController {
  constructor({ read, notify = () => {}, onError = () => {}, powerMonitor,
    timers = { setTimeout, clearTimeout }, now = Date.now }) {
    this.read = read;
    this.notify = notify;
    this.onError = onError;
    this.powerMonitor = powerMonitor;
    this.timers = timers;
    this.now = now;
    this.version = null;
    this.running = false;
    this.pending = null;
    this.timer = null;
    this.resume = () => { void this.check(); };
  }
  start() {
    if (this.running) return;
    this.running = true;
    this.powerMonitor?.on("resume", this.resume);
    void this.check();
  }
  check() {
    if (!this.running) return Promise.resolve();
    if (this.pending) return this.pending;
    if (this.timer !== null) this.timers.clearTimeout(this.timer);
    this.timer = null;
    this.pending = Promise.resolve().then(async () => {
      let deadline = null;
      try {
        const data = await this.read();
        if (!this.running) return;
        if (this.version !== null && data.version !== this.version) this.notify(data);
        this.version = data.version;
        deadline = data.nextRegisterCloseAt;
      } catch (error) { if (this.running) this.onError(error); }
      finally {
        this.pending = null;
        if (this.running) {
          const clock = this.now();
          const until = deadline ? Date.parse(deadline) - clock : Infinity;
          const delay = Math.max(100, Math.min(60_000 - clock % 60_000, Number.isFinite(until) ? until : 60_000));
          this.timer = this.timers.setTimeout(() => { this.timer = null; void this.check(); }, delay);
          this.timer?.unref?.();
        }
      }
    });
    return this.pending;
  }
  stop() {
    this.running = false;
    if (this.timer !== null) this.timers.clearTimeout(this.timer);
    this.timer = null;
    this.powerMonitor?.removeListener("resume", this.resume);
  }
}
module.exports = { RegisterClosingController };
