import type { Atom } from 'jotai';

import type { DEFAULT_ATOMS_LOGGER_COLORS } from '../consts/colors.js';
import { addToLogs } from './add-to-logs.js';

export function addAtomToLogs(
  logs: unknown[],
  atom: Atom<unknown> | ReturnType<Atom<unknown>['toString']>,
  options: {
    formattedOutput: boolean;
    colorScheme: 'default' | 'light' | 'dark';
  },
): void {
  const { formattedOutput, colorScheme } = options;

  const atomString = typeof atom === 'string' ? atom : atom.toString();

  if (!formattedOutput) {
    addToLogs(logs, { formattedOutput, colorScheme }, { plainText: () => atomString });
  } else {
    const atomNameMatch = /^atom(?<atomNumber>\d+)(?::(?<atomDebugLabel>.+))?$/.exec(atomString);

    if (!atomNameMatch) {
      // Parsing can fail if the atom has a custom toString method
      addToLogs(
        logs,
        { formattedOutput, colorScheme },
        { formatted: () => [`%c${atomString}`, 'default'] },
      );
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- this group is always present due to the regex
    const atomNumber = atomNameMatch.groups!.atomNumber!;
    const atomDebugLabel = atomNameMatch.groups?.atomDebugLabel;

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

      addToLogs(
        logs,
        { formattedOutput, colorScheme },
        {
          formatted: () => [
            `%catom%c${atomNumber}%c:${atomNameNamespacesStr}`,
            'grey',
            'default',
            'grey',
            ...atomNameNamespacesColors,
          ],
        },
      );
    } else {
      addToLogs(
        logs,
        { formattedOutput, colorScheme },
        { formatted: () => [`%catom%c${atomNumber}`, 'grey', 'default'] },
      );
    }
  }
}
