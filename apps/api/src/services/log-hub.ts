import { EventEmitter } from 'node:events';

export type LogEvent = {
  ts: number;
  level: string | number;
  message: string;
  data?: unknown;
};

export type LogHubOptions = {
  bufferSize?: number;
};

export function createLogHub(opts: LogHubOptions = {}) {
  const bufferSize = opts.bufferSize ?? 500;
  const emitter = new EventEmitter();
  const buffer: LogEvent[] = [];

  const publish = (evt: LogEvent) => {
    buffer.push(evt);
    if (buffer.length > bufferSize) buffer.shift();
    emitter.emit('log', evt);
  };

  const subscribe = (fn: (evt: LogEvent) => void) => {
    buffer.forEach((evt) => fn(evt));
    emitter.on('log', fn);
    return () => emitter.off('log', fn);
  };

  return { publish, subscribe, bufferSize };
}

