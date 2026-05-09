/**
 * Default colors for the atoms logger.
 *
 * Using a colorblind-friendly palette known as the Okabe-Ito color palette.
 *
 * @see https://siegal.bio.nyu.edu/color-palette/
 */
export const DEFAULT_ATOMS_LOGGER_COLORS = {
  default: 'default', // #000000 or #ffffff
  grey: '#757575',
  yellow: '#E69F00',
  lightBlue: '#56B4E9',
  green: '#009E73',
  blue: '#0072B2',
  red: '#D55E00',
  pink: '#CC79A7',
};

/**
 * Default light theme colors for the atoms logger.
 *
 * Using a slightly modified colorblind-friendly palette known as the Okabe-Ito color palette.
 * Contrast ratio respect WCAG AA for normal text with a minimum contrast of 5:1 on a white background (#ffffff).
 *
 * @see https://webaim.org/resources/contrastchecker/
 * @see https://siegal.bio.nyu.edu/color-palette/
 */
export const DEFAULT_ATOMS_LOGGER_LIGHT_COLORS: Record<
  keyof typeof DEFAULT_ATOMS_LOGGER_COLORS,
  string
> = {
  default: 'default', // #000000
  grey: '#6E6E6E',
  yellow: '#946500',
  lightBlue: '#1675AC',
  green: '#007A5A',
  blue: '#0072B2',
  red: '#B85000',
  pink: '#B54583',
};

/**
 * Default dark theme colors for the atoms logger.
 *
 * Using a slightly modified colorblind-friendly palette known as the Okabe-Ito color palette.
 * Contrast ratio respect WCAG AA for normal text with a minimum contrast of 5:1 on a dark background (#282828).
 *
 * @see https://webaim.org/resources/contrastchecker/
 * @see https://siegal.bio.nyu.edu/color-palette/
 */
export const DEFAULT_ATOMS_LOGGER_DARK_COLORS: Record<
  keyof typeof DEFAULT_ATOMS_LOGGER_COLORS,
  string
> = {
  default: 'default', // #ffffff
  grey: '#999999',
  yellow: '#E69F00',
  lightBlue: '#56B4E9',
  green: '#00AD7F',
  blue: '#009EFA',
  red: '#FA6C00',
  pink: '#CE7EAA',
};
