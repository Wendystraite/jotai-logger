import type { AtomsLoggerTransaction } from './transaction.js';

/**
 * A formatter that receives a completed transaction and produces output (e.g. logs to console).
 */
export type AtomsLoggerFormatter = (transaction: AtomsLoggerTransaction) => void;
