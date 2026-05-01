import { addToLogs } from './add-to-logs.js';

export function addDashToLogs(
  logs: unknown[],
  options: {
    formattedOutput: boolean;
    colorScheme: 'default' | 'light' | 'dark';
  },
) {
  addToLogs(logs, options, {
    plainText: () => '-',
    formatted: () => [`%c-`, 'grey'],
  });
}
