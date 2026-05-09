/**
 * Options for the console formatter.
 */
export interface ConsoleFormatterOptions {
  /**
   * Domain to use for the logger.
   *
   * The domain is used to identify the logger in the console.
   * It is prefixed to the transaction number.
   *
   * - If not provided, the transaction log will look like : `transaction 1 - 12:00:00 - 2.00ms`
   * - If provided, the transaction log will look like : `domain - transaction 1 - 12:00:00 - 2.00ms`
   */
  domain?: string;

  /**
   * Custom logger to use.
   *
   * By default, it uses the `console` global object.
   *
   * @default console
   */
  logger?: Pick<Console, 'log'> & Partial<Pick<Console, 'group' | 'groupCollapsed' | 'groupEnd'>>;

  /**
   * Whether to group transaction logs.
   *
   * @default true
   */
  groupTransactions?: boolean;

  /**
   * Whether to group event logs.
   *
   * @default false
   */
  groupEvents?: boolean;

  /**
   * Number of spaces for each level of indentation.
   *
   * @default 0
   */
  indentSpaces?: number;

  /**
   * Whether to use colors/formatting in the console.
   *
   * @default true
   */
  formattedOutput?: boolean;

  /**
   * Color scheme to use for the logger.
   *
   * @default "default"
   */
  colorScheme?: 'default' | 'light' | 'dark';

  /**
   * Maximum length of any logged stringified data. Use 0 for no limit.
   *
   * @default 50
   */
  stringifyLimit?: number;

  /**
   * Whether to stringify data in the logs.
   *
   * @default true
   */
  stringifyValues?: boolean;

  /**
   * Custom function to stringify data in the logs.
   */
  stringify?(this: void, value: unknown): string;

  /**
   * Whether to show the transaction number.
   *
   * @default true
   */
  showTransactionNumber?: boolean;

  /**
   * Whether to show the number of events in a transaction.
   *
   * @default true
   */
  showTransactionEventsCount?: boolean;

  /**
   * Whether to show when a transaction started.
   *
   * @default false
   */
  showTransactionLocaleTime?: boolean;

  /**
   * Whether to show the elapsed time of a transaction.
   *
   * @default true
   */
  showTransactionElapsedTime?: boolean;

  /**
   * Automatically align transaction logs by padding fields to consistent widths.
   *
   * @default true
   */
  autoAlignTransactions?: boolean;

  /**
   * Whether to collapse grouped transaction logs by default.
   *
   * @default false
   */
  collapseTransactions?: boolean;

  /**
   * Whether to collapse grouped event logs by default.
   *
   * @default false
   */
  collapseEvents?: boolean;

  /**
   * Limit the number of components shown in the owner stack.
   *
   * @default 2
   */
  ownerStackLimit?: number;
}

/**
 * Internal resolved state for the console formatter, including derived and mutable fields.
 */
export interface ConsoleFormatterState {
  domain: string | undefined;
  logger: Pick<Console, 'log'> & Partial<Pick<Console, 'group' | 'groupCollapsed' | 'groupEnd'>>;
  groupTransactions: boolean;
  groupEvents: boolean;
  indentSpaces: number;
  indentSpacesDepth1: string;
  indentSpacesDepth2: string;
  formattedOutput: boolean;
  colorScheme: 'default' | 'light' | 'dark';
  stringifyLimit: number;
  stringifyValues: boolean;
  stringify: ((this: void, value: unknown) => string) | undefined;
  showTransactionNumber: boolean;
  showTransactionEventsCount: boolean;
  showTransactionLocaleTime: boolean;
  showTransactionElapsedTime: boolean;
  autoAlignTransactions: boolean;
  collapseTransactions: boolean;
  collapseEvents: boolean;
  ownerStackLimit: number;
  /** Mutable state for auto-alignment tracking across transactions */
  maxWidths: { eventsCount: number; elapsedTime: number };
}
