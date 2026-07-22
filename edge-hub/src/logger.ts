import pino from 'pino';

const level = process.env.PETSENSE_LOG_LEVEL ?? 'info';

export const log = pino({
  level,
  formatters: {
    level(label: string) {
      return { level: label };
    },
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function child(name: string) {
  return log.child({ module: name });
}
