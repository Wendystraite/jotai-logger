import {
  DEFAULT_ATOMS_LOGGER_COLORS,
  DEFAULT_ATOMS_LOGGER_DARK_COLORS,
  DEFAULT_ATOMS_LOGGER_LIGHT_COLORS,
} from '../consts/colors.js';

const COLORS_BY_SCHEME = {
  default: DEFAULT_ATOMS_LOGGER_COLORS,
  light: DEFAULT_ATOMS_LOGGER_LIGHT_COLORS,
  dark: DEFAULT_ATOMS_LOGGER_DARK_COLORS,
};

/**
 * Add a log to the logs array.
 *
 * @param logs - The logs array to add the log to.
 * @param options - The options for the log.
 * @param log - The log to add.
 *
 * @example
 * ```ts
 * const logs: [string, ...string[]] = [''];
 * const options = { plainTextOutput: false, colorScheme: 'default' };
 * addToLogs(logs, options, {
 *   plainText: 'Hello World',
 *   colored: ['%cHello %cWorld', ['red', 'bold'], "green"],
 * });
 * console.log(...logs); // Will log "Hello" in red and "World" in green.
 * ```
 */
export function addToLogs(
  logs: unknown[],
  options: {
    plainTextOutput: boolean;
    colorScheme: 'default' | 'light' | 'dark';
    concatToPrevious?: boolean;
  },
  log: {
    /**
     * Plain text output of the log.
     */
    plainText: string;
    /**
     * Colored output of the log. The first element of the array is the string
     * to be logged, and the rest are the colors to be applied.
     *
     * The string should start with `%c` to force the use of a least one color / one font weight.
     * This prevent a weird behavior in the devtools console where the
     * font-weight is "bold" by default in a console.group and not in a
     * console.log.
     */
    colored: [
      `%c${string}`,
      ...(
        | keyof typeof DEFAULT_ATOMS_LOGGER_COLORS
        | [keyof typeof DEFAULT_ATOMS_LOGGER_COLORS, 'normal' | 'light' | 'bold']
      )[],
    ];
  },
): void {
  const { plainTextOutput, colorScheme, concatToPrevious = false } = options;
  if (!logs.length) {
    logs.push('');
  }
  if (!concatToPrevious && (logs as [string])[0].length > 0) {
    (logs as [string])[0] += ' ';
  }
  if (plainTextOutput) {
    (logs as [string])[0] += log.plainText;
  } else {
    (logs as [string])[0] += log.colored.shift() as string;
    for (const style of log.colored) {
      let colorName: keyof typeof DEFAULT_ATOMS_LOGGER_COLORS;
      let fontWeight: 'normal' | 'light' | 'bold';
      if (typeof style === 'string') {
        colorName = style as keyof typeof DEFAULT_ATOMS_LOGGER_COLORS;
        fontWeight = 'normal';
      } else {
        colorName = style[0];
        fontWeight = style[1];
      }
      const color = COLORS_BY_SCHEME[colorScheme][colorName];
      logs.push(`color: ${color}; font-weight: ${fontWeight};`);
    }
  }
}
