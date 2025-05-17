import { addToLogs } from './add-to-logs.js';

export function addLocaleTimeToLogs(
  logs: unknown[],
  startTimestamp: number,
  options: {
    formattedOutput: boolean;
    colorScheme: 'default' | 'light' | 'dark';
  },
) {
  const date = new Date(performance.timeOrigin + startTimestamp);
  const localeTimeString = date.toLocaleTimeString();

  addToLogs(logs, options, {
    plainText: () => localeTimeString,
    formatted: () => [`%c${localeTimeString}`, 'grey'],
  });
}
