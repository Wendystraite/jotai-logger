import type { AtomsLoggerTransaction, AtomsLoggerTransactionMap } from '../types/atoms-logger.js';

export function getTransactionMapTransaction(
  transactionMap: AtomsLoggerTransactionMap,
): AtomsLoggerTransaction {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- should be always present
  return Object.values(transactionMap)[0]!;
}
