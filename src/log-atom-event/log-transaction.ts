import type { AtomsLoggerState, AtomsLoggerTransaction } from '../types/atoms-logger.js';
import { logEvent } from './log-event.js';
import { TransactionLogPipeline } from './transaction-log-pipeline.js';

export function logTransaction(
  transaction: AtomsLoggerTransaction,
  options: AtomsLoggerState,
): void {
  const { logger, collapseTransactions } = options;

  let { groupLogs } = options;

  const {
    logs,
    additionalDataToLog,
    transaction: { events = [] },
  } = TransactionLogPipeline.execute({ transaction, options });

  if (Object.keys(additionalDataToLog).length > 0) {
    logs.push(additionalDataToLog);
  }

  if (collapseTransactions ? !logger.groupCollapsed : !logger.group) {
    groupLogs = false;
  } else if (!logger.groupEnd) {
    groupLogs = false;
  }

  try {
    if (logs.length > 0) {
      if (!groupLogs) {
        logger.log(...logs);
      } else if (collapseTransactions) {
        logger.groupCollapsed?.(...logs);
      } else {
        logger.group?.(...logs);
      }
    }
    for (const event of events) {
      logEvent(event, options);
    }
  } finally {
    if (logs.length > 0 && groupLogs) {
      logger.groupEnd?.();
    }
  }
}
