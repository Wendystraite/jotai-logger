import type { AtomTransaction } from './transaction.js';

/**
 * A formatter that receives a completed transaction and produces output (e.g. logs to console).
 */
export type AtomLoggerFormatter = (transaction: AtomTransaction) => void;
