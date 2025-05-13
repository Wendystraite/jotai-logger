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
 * const options = { formattedOutput: true, colorScheme: 'default' };
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
    formattedOutput: boolean;
    colorScheme: 'default' | 'light' | 'dark';
  },
  log: {
    /**
     * Plain text output of the log.
     *
     * If the output is a string, it is the string to be logged.
     * If the output is an array, these are the javascript objects to be logged.
     *
     * The string should NOT contain any string substitutions like `%c` or `%o`.
     */
    plainText: () => string | unknown[];

    /**
     * Formatted output of the log.
     *
     * - The first element of the array is the string to be logged
     *   - The string should start with `%c` to force the use of a least one
     *     color / one font weight.
     *   - This prevent a weird behavior in the devtools console where the
     *     font-weight is "bold" by default in a console.group and not in a
     *     console.log.
     * - The rest of the elements are the formatting options to be applied.
     *   - If the element is a string, it is the name of the color to be used.
     *   - If the element is a tuple, the first element is the name of the color
     *     and the second the font weight.
     *   - If the element is an object, it is a javascript object to be logged.
     */
    formatted: () => readonly [
      `%c${string}`,
      ...(readonly (
        | keyof typeof DEFAULT_ATOMS_LOGGER_COLORS
        | readonly [keyof typeof DEFAULT_ATOMS_LOGGER_COLORS, 'normal' | 'light' | 'bold']
        | { data: unknown }
      )[]),
    ];
  },
): void {
  const { formattedOutput, colorScheme } = options;

  if (!formattedOutput) {
    // In plain text mode all logs are added one after the other since it can
    // contain raw data like objects or arrays in-between.

    const plainText = log.plainText();
    const toLogs = typeof plainText === 'string' ? [plainText] : plainText;

    for (const toLog of toLogs) {
      // If the last log is a string, we can just append the new log to it.
      if (logs.length && typeof toLog === 'string' && typeof logs[logs.length - 1] === 'string') {
        (logs[logs.length - 1] as string) += ' ' + toLog;
      } else {
        logs.push(toLog);
      }
    }
  } else {
    // In colored mode, the first log is always a string with substitution
    // strings like %c and the rest are the formatting options.

    if (!logs.length) {
      logs.push('');
    } else {
      (logs as [string])[0] += ' ';
    }

    const colored = log.formatted();

    (logs as [string])[0] += colored[0];

    for (let formattingOptionIdx = 1; formattingOptionIdx < colored.length; ++formattingOptionIdx) {
      const formattingOption = colored[formattingOptionIdx] as
        | keyof typeof DEFAULT_ATOMS_LOGGER_COLORS
        | [keyof typeof DEFAULT_ATOMS_LOGGER_COLORS, 'normal' | 'light' | 'bold']
        | { data: unknown };

      if (typeof formattingOption === 'object' && 'data' in formattingOption) {
        logs.push(formattingOption.data);
        continue;
      }

      let colorName: keyof typeof DEFAULT_ATOMS_LOGGER_COLORS;
      let fontWeight: 'normal' | 'light' | 'bold';
      if (typeof formattingOption === 'string') {
        colorName = formattingOption;
        fontWeight = 'normal';
      } else {
        colorName = formattingOption[0];
        fontWeight = formattingOption[1];
      }
      const color = COLORS_BY_SCHEME[colorScheme][colorName];
      logs.push(`color: ${color}; font-weight: ${fontWeight};`);
    }
  }
}
