export function previewExpiresSoon(value, now = Date.now()) {
  try {
    const token = new URL(value).searchParams.get('hdnea') || '';
    const match = token.match(/(?:^|~)exp=(\d+)/);
    return Boolean(match && Number(match[1]) <= Math.floor(now / 1000) + 60);
  } catch {
    return false;
  }
}

export class PreviewRequestLifecycle {
  constructor(emit = () => {}) {
    this.emit = emit;
    this.sequence = 0;
    this.current = null;
  }

  request(detail = {}) {
    const previous = this.current;
    const request = { ...detail, requestId: ++this.sequence, phase: 'requested' };
    this.current = request;
    this.emit('requested', { ...request });
    if (previous) this.emit('cancelled', { ...previous, phase: 'cancelled', reason: 'replaced' });
    return request.requestId;
  }

  isCurrent(requestId) {
    return Boolean(this.current && this.current.requestId === requestId);
  }

  started(requestId, detail = {}) {
    if (!this.isCurrent(requestId)) return false;
    this.current = { ...this.current, ...detail, phase: 'started' };
    this.emit('started', { ...this.current });
    return true;
  }

  terminal(requestId, phase, detail = {}) {
    if (!['failed', 'ended'].includes(phase) || !this.isCurrent(requestId)) return false;
    const terminal = { ...this.current, ...detail, phase };
    this.current = null;
    this.emit(phase, terminal);
    return true;
  }

  cancel(reason = 'cancelled', { emit = true } = {}) {
    if (!this.current) return false;
    const cancelled = { ...this.current, phase: 'cancelled', reason };
    this.current = null;
    if (emit) this.emit('cancelled', cancelled);
    return true;
  }
}

export class PreviewOwnershipLifecycle {
  constructor({ deactivate = () => {}, restorePaused = () => {}, onChange = () => {} } = {}) {
    this.deactivate = deactivate;
    this.restorePaused = restorePaused;
    this.onChange = onChange;
    this.session = null;
  }

  begin(session) {
    if (!this.session) {
      this.session = { ...session, requestId: null, phase: 'awaiting-request' };
      this.onChange(this.session);
    }
    return this.session;
  }

  requested(requestId) {
    if (!this.session || !Number.isInteger(requestId)) return false;
    this.session.requestId = requestId;
    this.session.phase = 'requested';
    this.onChange(this.session);
    return true;
  }

  started(requestId) {
    if (!this.accepts(requestId)) return false;
    this.session.phase = 'started';
    this.onChange(this.session);
    return true;
  }

  accepts(requestId) {
    return Boolean(this.session && this.session.requestId === requestId);
  }

  finish(requestId, { restore = true, reason = 'ended', emitCancelled = false } = {}) {
    if (!this.session || (requestId !== null && requestId !== undefined && !this.accepts(requestId))) return null;
    const session = this.session;
    this.session = null;
    this.onChange(null);
    this.deactivate({ reason, emitCancelled });
    if (restore) this.restorePaused(session);
    return session;
  }

  supersede(reason = 'superseded') {
    return this.finish(null, { restore: false, reason, emitCancelled: true });
  }
}
