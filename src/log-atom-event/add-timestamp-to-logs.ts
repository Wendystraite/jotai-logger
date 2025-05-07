import { addToLogs } from './add-to-logs.js';

export function addTimestampToLogs(
  logs: unknown[],
  startTimestamp: number | undefined,
  endTimestamp: number | undefined,
  options: {
    showTransactionLocaleTime: boolean;
    showTransactionElapsedTime: boolean;
    plainTextOutput: boolean;
    colorScheme: 'default' | 'light' | 'dark';
  },
) {
  if (startTimestamp === undefined || endTimestamp === undefined) {
    return;
  }

  if (!options.showTransactionLocaleTime && !options.showTransactionElapsedTime) {
    return;
  }

  addToLogs(logs, options, {
    plainText: '-',
    colored: [`%c-`, 'grey'],
  });

  if (options.showTransactionLocaleTime) {
    const date = new Date(performance.timeOrigin + startTimestamp);
    const localeTimeString = date.toLocaleTimeString();

    addToLogs(logs, options, {
      plainText: localeTimeString,
      colored: [`%c${localeTimeString}`, 'grey'],
    });

    if (options.showTransactionElapsedTime) {
      addToLogs(logs, options, {
        plainText: '-',
        colored: [`%c-`, 'grey'],
      });
    }
  }

  if (options.showTransactionElapsedTime) {
    const ms = endTimestamp - startTimestamp;
    const msRounded = (Math.round(ms * 100) / 100).toFixed(2);

    addToLogs(logs, options, {
      plainText: `${msRounded} ms`,
      colored: [`%c${msRounded} ms`, 'grey'],
    });
  }
}
