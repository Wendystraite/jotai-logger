import { addToLogs } from './add-to-logs.js';

export function addElapsedTimeToLogs(
  logs: unknown[],
  startTimestamp: number,
  endTimestamp: number,
  options: {
    formattedOutput: boolean;
    colorScheme: 'default' | 'light' | 'dark';
  },
) {
  const ms = endTimestamp - startTimestamp;
  const msRounded = (Math.round(ms * 100) / 100).toFixed(2);

  addToLogs(logs, options, {
    plainText: () => `${msRounded} ms`,
    formatted: () => [`%c${msRounded} ms`, 'grey'],
  });
}
