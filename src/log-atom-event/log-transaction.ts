import { INTERNAL_isActuallyWritableAtom } from 'jotai/vanilla/internals';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import { DEFAULT_ATOMS_LOGGER_COLORS } from '../consts/colors.js';
import type {
  AtomsLoggerTransaction,
  AtomsLoggerTransactionMap,
  StoreWithAtomsLogger,
} from '../types/atoms-logger.js';
import { hasAtomCustomWriteMethod } from '../utils/has-atom-custom-write-method.js';
import { shouldShowAtom } from '../utils/should-show-atom.js';
import { stringifyValue } from '../utils/stringify-value.js';
import { addTimestampToLogs } from './add-timestamp-to-logs.js';
import { addToLogs } from './add-to-logs.js';
import { addAtomIdToLogs } from './log-atom-id.js';
import { logEvent } from './log-event.js';

export const TransactionLabelMapping: Record<
  keyof AtomsLoggerTransactionMap,
  {
    label: string;
    coloredLabel: `%c${string}`;
    colors: (
      | keyof typeof DEFAULT_ATOMS_LOGGER_COLORS
      | [keyof typeof DEFAULT_ATOMS_LOGGER_COLORS, 'bold' | 'normal' | 'light']
    )[];
  }
> = {
  unknown: { label: '', coloredLabel: '%c', colors: [] },
  storeSet: { label: '', coloredLabel: '%c', colors: [] },
  storeSubscribe: {
    label: 'subscribed to',
    coloredLabel: '%csubscribed %cto',
    colors: [['green', 'bold'], 'grey'],
  },
  storeUnsubscribe: {
    label: 'unsubscribed from',
    coloredLabel: '%cunsubscribed %cfrom',
    colors: [['red', 'bold'], 'grey'],
  },
  storeGet: {
    label: 'retrieved value of',
    coloredLabel: '%cretrieved value %cof',
    colors: [['blue', 'bold'], 'grey'],
  },
  promiseResolved: {
    label: 'resolved promise of',
    coloredLabel: '%cresolved %cpromise %cof',
    colors: [['green', 'bold'], ['pink', 'bold'], 'grey'],
  },
  promiseRejected: {
    label: 'rejected promise of',
    coloredLabel: '%crejected %cpromise %cof',
    colors: [['red', 'bold'], ['pink', 'bold'], 'grey'],
  },
};

// eslint-disable-next-line complexity -- TODO : to refactor
export function logTransaction(
  store: StoreWithAtomsLogger,
  transactionMap: AtomsLoggerTransactionMap,
): void {
  const options = store[ATOMS_LOGGER_SYMBOL];

  const {
    domain,
    logger,
    stringifyLimit,
    showTransactionNumber,
    showTransactionLocaleTime,
    showTransactionElapsedTime,
    collapseTransactions,
  } = options;
  let { groupLogs } = options;

  const [transactionType, transaction] = (Object.entries(transactionMap)[0] ?? []) as [
    keyof AtomsLoggerTransactionMap,
    AtomsLoggerTransaction | undefined,
  ];

  const eventsToShow = transaction?.events?.filter((eventMap) => {
    const event = Object.values(eventMap)[0] ?? undefined;
    return event !== undefined && (!('atom' in event) || shouldShowAtom(store, event.atom));
  });

  if (!transaction || !eventsToShow || eventsToShow.length <= 0) {
    return;
  }

  const transactionNumber = (store[ATOMS_LOGGER_SYMBOL].transactionNumber += 1);

  const showDomain = domain !== undefined && domain.length > 0;

  const showStackTrace =
    transaction.stackTrace !== undefined &&
    (transaction.stackTrace.componentName !== undefined ||
      transaction.stackTrace.hooks !== undefined ||
      transaction.stackTrace.filePath !== undefined ||
      transaction.stackTrace.fileName !== undefined);

  const showAtom = !transaction.atom || shouldShowAtom(store, transaction.atom);

  const showEvent = showAtom && !transactionMap.unknown;

  let showArgs = showAtom && 'args' in transaction && transaction.args.length > 0;
  const args = 'args' in transaction ? transaction.args : [];

  const showResult = showAtom && 'result' in transaction && transaction.result !== undefined;

  const hasDefaultWriteMethod =
    transaction.atom !== undefined &&
    INTERNAL_isActuallyWritableAtom(transaction.atom) &&
    !hasAtomCustomWriteMethod(transaction.atom);

  const hasCustomWriteMethod =
    transaction.atom !== undefined &&
    INTERNAL_isActuallyWritableAtom(transaction.atom) &&
    hasAtomCustomWriteMethod(transaction.atom);

  if (
    // Don't show the arguments if the atom is a primitive atom with a previous
    // state function passed as the first argument
    hasDefaultWriteMethod &&
    typeof args[0] === 'function'
  ) {
    showArgs = false;
  }

  const logs: unknown[] = [];
  const additionalDataToLog: Record<string, unknown> = {};

  if (showDomain) {
    addToLogs(logs, options, {
      plainText: `${domain} -`,
      colored: [`%c${domain} %c-`, 'grey', 'default'],
    });
  }

  if (showTransactionNumber) {
    addToLogs(logs, options, {
      plainText: `transaction ${transactionNumber.toString()}`,
      colored: [`%ctransaction %c${transactionNumber.toString()}`, 'grey', 'default'],
    });
  }

  if (showTransactionLocaleTime || showTransactionElapsedTime) {
    addTimestampToLogs(logs, transaction.startTimestamp, transaction.endTimestamp, options);
  }

  if (
    (showDomain ||
      showTransactionNumber ||
      showTransactionLocaleTime ||
      showTransactionElapsedTime) &&
    (showStackTrace || showEvent || showAtom || showArgs || showResult)
  ) {
    addToLogs(logs, options, {
      plainText: ':',
      colored: [`%c:`, 'grey'],
    });
  }

  if (showStackTrace && transaction.stackTrace) {
    const { componentName, hooks, filePath, fileName } = transaction.stackTrace;
    const fileNameOrPath = fileName ?? filePath;
    if (fileNameOrPath) {
      addToLogs(logs, options, {
        plainText: `[${fileNameOrPath}]`,
        colored: [`%c[${fileNameOrPath}]`, 'grey'],
      });
    }
    if (componentName && hooks) {
      const hooksNames = hooks.join('.');
      addToLogs(logs, options, {
        plainText: `${componentName}.${hooksNames}`,
        colored: [`%c${componentName}%c.${hooksNames}`, 'default', 'grey'],
      });
    } else {
      if (componentName) {
        addToLogs(logs, options, {
          plainText: componentName,
          colored: [`%c${componentName}`, 'default'],
        });
      }
      if (hooks) {
        const hooksNames = hooks.join('.');
        addToLogs(logs, options, {
          plainText: hooksNames,
          colored: [`%c${hooksNames}`, 'grey'],
        });
      }
    }
  }

  if (showEvent) {
    let eventLabel: string;
    let eventColoredLabel: `%c${string}`;
    let eventColors: (
      | keyof typeof DEFAULT_ATOMS_LOGGER_COLORS
      | [keyof typeof DEFAULT_ATOMS_LOGGER_COLORS, 'normal' | 'light' | 'bold']
    )[];
    if (transactionMap.storeSet) {
      if (hasCustomWriteMethod) {
        eventLabel = 'called set of';
        eventColoredLabel = '%ccalled set %cof';
        eventColors = [['yellow', 'bold'], 'grey'];
      } else {
        eventLabel = 'set value of';
        eventColoredLabel = '%cset value %cof';
        eventColors = [['yellow', 'bold'], 'grey'];
      }
    } else {
      ({
        label: eventLabel,
        coloredLabel: eventColoredLabel,
        colors: eventColors,
      } = TransactionLabelMapping[transactionType]);
    }

    addToLogs(logs, options, {
      plainText: eventLabel,
      colored: [eventColoredLabel, ...eventColors],
    });
  }

  if (showAtom) {
    const atomId = transaction.atomId ?? transaction.atom?.toString();
    if (atomId) {
      addAtomIdToLogs(logs, atomId, options);
    }
  }

  if (showArgs) {
    const argsToStringify = args.length <= 1 ? args[0] : args;
    const stringifiedArgs = stringifyValue(argsToStringify, {
      maxLength: stringifyLimit,
    });

    if (hasCustomWriteMethod) {
      addToLogs(logs, options, {
        plainText: 'with',
        colored: [`%cwith`, 'grey'],
      });
    } else {
      addToLogs(logs, options, {
        plainText: 'to',
        colored: [`%cto`, 'grey'],
      });
    }

    addToLogs(logs, options, {
      plainText: stringifiedArgs,
      colored: [`%c${stringifiedArgs}`, 'default'],
    });

    if (hasCustomWriteMethod) {
      additionalDataToLog.args = args;
    } else {
      additionalDataToLog.value = args[0];
    }
  }

  if (showResult) {
    const stringifiedResult = stringifyValue(transaction.result, {
      maxLength: stringifyLimit,
    });

    addToLogs(logs, options, {
      plainText: `returned ${stringifiedResult}`,
      colored: [`%creturned %c${stringifiedResult}`, 'grey', 'default'],
    });

    additionalDataToLog.result = transaction.result;
  }

  if (Object.entries(additionalDataToLog).length > 0) {
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
    for (const event of eventsToShow) {
      logEvent(store, event);
    }
  } finally {
    if (logs.length > 0 && groupLogs) {
      logger.groupEnd?.();
    }
  }
}
