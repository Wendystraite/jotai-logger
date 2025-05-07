import type { DEFAULT_ATOMS_LOGGER_COLORS } from '../consts/colors.js';
import { addToLogs } from './add-to-logs.js';

export function addAtomIdToLogs(
  logs: unknown[],
  atomId: string,
  options: {
    plainTextOutput: boolean;
    colorScheme: 'default' | 'light' | 'dark';
  },
): void {
  if (options.plainTextOutput) {
    addToLogs(logs, options, {
      plainText: atomId,
      colored: [`%c${atomId}`, 'default'],
    });
  } else {
    const atomNameMatch = /^atom(?<atomNumber>\d+)(?::(?<atomDebugLabel>.+))?$/.exec(atomId);
    const atomNumber = atomNameMatch?.groups?.atomNumber;
    const atomDebugLabel = atomNameMatch?.groups?.atomDebugLabel;

    if (atomNumber) {
      addToLogs(logs, options, {
        plainText: `atom${atomNumber}`,
        colored: [`%catom%c${atomNumber}`, 'grey', 'default'],
      });
    }

    if (atomDebugLabel) {
      const atomNameNamespaces = atomDebugLabel.split('/');

      let atomNameNamespacesStr = '';
      const atomNameNamespacesColors: (keyof typeof DEFAULT_ATOMS_LOGGER_COLORS)[] = [];
      for (const [idx, ns] of atomNameNamespaces.entries()) {
        if (idx === 0) {
          atomNameNamespacesStr += `%c${ns}`;
          atomNameNamespacesColors.push('grey');
        } else if (idx < atomNameNamespaces.length - 1) {
          atomNameNamespacesStr += `%c/%c${ns}`;
          atomNameNamespacesColors.push('default', 'grey');
        } else {
          atomNameNamespacesStr += `%c/${ns}`;
          atomNameNamespacesColors.push('default');
        }
      }

      addToLogs(
        logs,
        { ...options, concatToPrevious: true },
        {
          plainText: atomDebugLabel,
          colored: [`%c:${atomNameNamespacesStr}`, 'grey', ...atomNameNamespacesColors],
        },
      );
    }
  }
}
