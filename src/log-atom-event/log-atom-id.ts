import type { DEFAULT_ATOMS_LOGGER_COLORS } from '../consts/colors.js';
import { addToLogs } from './add-to-logs.js';

export function addAtomIdToLogs(
  logs: unknown[],
  atomId: string,
  options: {
    formattedOutput: boolean;
    colorScheme: 'default' | 'light' | 'dark';
  },
): void {
  if (!options.formattedOutput) {
    addToLogs(logs, options, {
      plainText: () => atomId,
      formatted: () => [`%c${atomId}`, 'default'],
    });
  } else {
    const atomNameMatch = /^atom(?<atomNumber>\d+)(?::(?<atomDebugLabel>.+))?$/.exec(atomId);
    const atomNumber = atomNameMatch?.groups?.atomNumber ?? ''; // should be always defined
    const atomDebugLabel = atomNameMatch?.groups?.atomDebugLabel;

    if (atomDebugLabel) {
      const atomNameNamespaces = atomDebugLabel.split('/');

      let atomNameNamespacesStr = '';
      const atomNameNamespacesColors: (keyof typeof DEFAULT_ATOMS_LOGGER_COLORS)[] = [];
      if (atomNameNamespaces.length === 1 && atomNameNamespaces[0] !== undefined) {
        atomNameNamespacesStr = `%c${atomNameNamespaces[0]}`;
        atomNameNamespacesColors.push('default');
      } else {
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
      }

      addToLogs(logs, options, {
        plainText: () => `atom${atomNumber}:${atomDebugLabel}`,
        formatted: () => [
          `%catom%c${atomNumber}%c:${atomNameNamespacesStr}`,
          'grey',
          'default',
          'grey',
          ...atomNameNamespacesColors,
        ],
      });
    } else {
      addToLogs(logs, options, {
        plainText: () => `atom${atomNumber}`,
        formatted: () => [`%catom%c${atomNumber}`, 'grey', 'default'],
      });
    }
  }
}
