import { INTERNAL_isActuallyWritableAtom } from 'jotai/vanilla/internals';

import type {
  AnyAtom,
  AtomId,
  AtomsLoggerStackTrace,
  AtomsLoggerState,
  AtomsLoggerTransaction,
  AtomsLoggerTransactionBase,
  AtomsLoggerTransactionMap,
} from '../types/atoms-logger.js';
import { getTransactionMapTransaction } from '../utils/get-transaction-map-transaction.js';
import { hasAtomCustomWriteMethod } from '../utils/has-atom-custom-write-method.js';
import { stringifyValue } from '../utils/stringify-value.js';
import { addAtomToLogs } from './add-atom-to-logs.js';
import { addDashToLogs } from './add-dash-to-logs.js';
import { addElapsedTimeToLogs } from './add-elapsed-time-to-logs.js';
import { addLocaleTimeToLogs } from './add-locale-time-to-logs.js';
import { addToLogs } from './add-to-logs.js';
import { LogPipeline } from './log-pipeline.js';

export const TransactionLogPipeline = new LogPipeline()
  .withArgs<{
    transactionMap: AtomsLoggerTransactionMap;
    options: AtomsLoggerState;
  }>()

  .withMeta<{
    logs: unknown[];
    additionalDataToLog: Record<string, unknown>;
    transaction: AtomsLoggerTransaction;
  }>(function addLogsToTransactionMeta(context) {
    context.logs = [];
    context.additionalDataToLog = {};
    context.transaction = getTransactionMapTransaction(context.transactionMap);
  })

  .withMeta<{ showDomain: true; domain: string } | { showDomain?: undefined; domain?: undefined }>(
    function addDomainToTransactionMeta(context) {
      const {
        options: { domain },
      } = context;
      if (domain !== undefined && domain.length > 0) {
        context.showDomain = true;
        context.domain = domain;
      }
    },
  )

  // {domain} -
  .withLog(function addDomainToTransactionLogs(context) {
    const { logs, options, showDomain, domain } = context;
    if (!showDomain) return;
    addToLogs(logs, options, {
      plainText: () => domain,
      formatted: () => [`%c${domain}`, 'grey'],
    });
    addDashToLogs(logs, options);
  })

  .withMeta<{ showTransactionNumber?: true }>(
    function addTransactionNumberToTransactionMeta(context) {
      const {
        options: { showTransactionNumber },
      } = context;
      if (showTransactionNumber) {
        context.showTransactionNumber = true;
      }
    },
  )

  // transaction {transactionNumber}
  .withLog(function addTransactionNumberToTransactionLogs(context) {
    if (!context.showTransactionNumber) return;
    const {
      logs,
      options,
      transaction: { transactionNumber },
    } = context;
    addToLogs(logs, options, {
      plainText: () => `transaction ${transactionNumber.toString()}`,
      formatted: () => [`%ctransaction %c${transactionNumber.toString()}`, 'grey', 'default'],
    });
  })

  .withMeta<{ showLocaleTime?: true }>(function addTransactionLocaleTimeToTransactionMeta(context) {
    const {
      options: { showTransactionLocaleTime },
    } = context;
    if (showTransactionLocaleTime) {
      context.showLocaleTime = true;
    }
  })

  .withMeta<{ showElapsedTime?: true }>(function addElapsedTimeToTransactionMeta(context) {
    const {
      transaction: { startTimestamp, endTimestamp },
      options: { showTransactionElapsedTime },
    } = context;
    if (showTransactionElapsedTime && startTimestamp !== endTimestamp) {
      context.showElapsedTime = true;
    }
  })

  // -
  .withLog(function addDateTimeDashToTransactionLogs(context) {
    if (!context.showLocaleTime && !context.showElapsedTime) return;
    const { logs, options } = context;
    addDashToLogs(logs, options);
  })

  // {localeTime}
  .withLog(function addLocaleTimeToTransactionLogs(context) {
    if (!context.showLocaleTime) return;
    const {
      logs,
      options,
      transaction: { startTimestamp },
    } = context;
    addLocaleTimeToLogs(logs, startTimestamp, options);
  })

  // -
  .withLog(function addLocaleTimeDashToTransactionLogs(context) {
    if (!context.showLocaleTime || !context.showElapsedTime) return;
    const { logs, options } = context;
    addDashToLogs(logs, options);
  })

  // {elapsedTime}
  .withLog(function addElapsedTimeToTransactionLogs(context) {
    if (!context.showElapsedTime) return;
    const {
      logs,
      options,
      transaction: { startTimestamp, endTimestamp },
    } = context;
    addElapsedTimeToLogs(logs, startTimestamp, endTimestamp, options);
  })

  .withMeta<
    | { showStackTrace: true; stackTrace: AtomsLoggerStackTrace }
    | { showStackTrace?: undefined; stackTrace?: undefined }
  >(function addStackTraceToTransactionMeta(context) {
    const stackTrace = context.transaction.stackTrace as Exclude<
      AtomsLoggerTransactionBase['stackTrace'],
      Promise<AtomsLoggerStackTrace | undefined> // Promise was resolved in log scheduler
    >;
    if (
      stackTrace !== undefined &&
      (stackTrace.react !== undefined || stackTrace.file !== undefined)
    ) {
      context.showStackTrace = true;
      context.stackTrace = stackTrace;
    }
  })

  .withMeta<
    | {
        showAtom: true;
        atom: AnyAtom | AtomId;
        hasCustomWriteMethod: boolean;
        hasDefaultWriteMethod: boolean;
      }
    | {
        showAtom?: undefined;
        atom?: undefined;
        hasCustomWriteMethod?: undefined;
        hasDefaultWriteMethod?: undefined;
      }
  >(function addAtomToTransactionMeta(context) {
    const { transactionMap, transaction } = context;
    if (!transactionMap.unknown && transaction.atom !== undefined) {
      const atom = transaction.atom;
      context.showAtom = true;
      context.atom = atom;

      const isWriteMethod = typeof atom !== 'string' && INTERNAL_isActuallyWritableAtom(atom);
      context.hasCustomWriteMethod = isWriteMethod && hasAtomCustomWriteMethod(atom);
      context.hasDefaultWriteMethod = isWriteMethod && !hasAtomCustomWriteMethod(atom);
    }
  })

  .withMeta<{ showTransactionName?: true }>(function addTransactionNameToTransactionMeta(context) {
    const { showAtom, transactionMap } = context;
    if (showAtom === true && !transactionMap.unknown) {
      context.showTransactionName = true;
    }
  })

  .withMeta<{ showArgs: true; args: unknown[] } | { showArgs?: undefined; args?: undefined }>(
    function addArgsToTransactionMeta(context) {
      const { showAtom, transaction, hasDefaultWriteMethod } = context;
      if (
        showAtom &&
        'args' in transaction &&
        transaction.args.length > 0 &&
        // Don't show the arguments if the atom is a primitive atom with a previous
        // state function passed as the first argument
        (!hasDefaultWriteMethod || typeof transaction.args[0] !== 'function')
      ) {
        context.showArgs = true;
        context.args = transaction.args;
      }
    },
  )

  .withMeta<{ showResult: true; result: unknown } | { showResult?: undefined; result?: undefined }>(
    function addResultToTransactionMeta(context) {
      const { showAtom, transaction } = context;
      if (showAtom && 'result' in transaction && transaction.result !== undefined) {
        context.showResult = true;
        context.result = transaction.result;
      }
    },
  )

  // :
  .withLog(function addColonToTransactionLogs({
    logs,
    options,
    showDomain,
    showTransactionNumber,
    showLocaleTime,
    showElapsedTime,
    showStackTrace,
    showTransactionName,
    showAtom,
    showArgs,
    showResult,
  }) {
    if (
      (showDomain || showTransactionNumber || showLocaleTime || showElapsedTime) &&
      (showStackTrace || showTransactionName || showAtom || showArgs || showResult)
    ) {
      addToLogs(logs, options, {
        plainText: () => ':',
        formatted: () => [`%c:`, 'grey'],
      });
    }
  })

  // {stackTrace}
  .withLog(function addStackTraceToTransactionLogs(context) {
    if (!context.showStackTrace) return;
    const {
      logs,
      options,
      stackTrace: { react, file },
    } = context;
    if (file) {
      addToLogs(logs, options, {
        plainText: () => `[${file.name}]`,
        formatted: () => [`%c[${file.name}]`, 'grey'],
      });
    }
    if (react) {
      if (react.hooks && react.hooks.length > 0) {
        const hooksNames = react.hooks.join('.');
        addToLogs(logs, options, {
          plainText: () => `${react.component}.${hooksNames}`,
          formatted: () => [`%c${react.component}%c.${hooksNames}`, 'default', 'grey'],
        });
      } else {
        addToLogs(logs, options, {
          plainText: () => react.component,
          formatted: () => [`%c${react.component}`, 'default'],
        });
      }
    }
  })

  // {event}
  .withLog(function addEventToTransactionLogs(context) {
    if (!context.showTransactionName) return;
    const { logs, options, transactionMap, hasCustomWriteMethod } = context;
    if (transactionMap.storeSet) {
      if (hasCustomWriteMethod) {
        addToLogs(logs, options, {
          plainText: () => 'called set of',
          formatted: () => [`%ccalled set %cof`, ['yellow', 'bold'], 'grey'],
        });
      } else {
        addToLogs(logs, options, {
          plainText: () => 'set value of',
          formatted: () => [`%cset value %cof`, ['yellow', 'bold'], 'grey'],
        });
      }
    } else if (transactionMap.storeSubscribe) {
      addToLogs(logs, options, {
        plainText: () => 'subscribed to',
        formatted: () => ['%csubscribed %cto', ['green', 'bold'], 'grey'],
      });
    } else if (transactionMap.storeUnsubscribe) {
      addToLogs(logs, options, {
        plainText: () => 'unsubscribed from',
        formatted: () => ['%cunsubscribed %cfrom', ['red', 'bold'], 'grey'],
      });
    } else if (transactionMap.storeGet) {
      addToLogs(logs, options, {
        plainText: () => 'retrieved value of',
        formatted: () => ['%cretrieved value %cof', ['blue', 'bold'], 'grey'],
      });
    } else if (transactionMap.promiseResolved) {
      addToLogs(logs, options, {
        plainText: () => 'resolved promise of',
        formatted: () => ['%cresolved %cpromise %cof', ['green', 'bold'], ['pink', 'bold'], 'grey'],
      });
    } else if (transactionMap.promiseRejected) {
      addToLogs(logs, options, {
        plainText: () => 'rejected promise of',
        formatted: () => ['%crejected %cpromise %cof', ['red', 'bold'], ['pink', 'bold'], 'grey'],
      });
    }
  })

  // {atom}
  .withLog(function addAtomToTransactionLogs(context) {
    if (!context.showAtom) return;
    const { logs, options, atom } = context;
    addAtomToLogs(logs, atom, options);
  })

  // {args}
  .withLog(function addArgsToTransactionLogs(context) {
    if (!context.showArgs) return;
    const {
      logs,
      additionalDataToLog,
      options,
      options: { stringifyValues },
      hasCustomWriteMethod,
      args,
    } = context;
    const argsToStringify = args.length <= 1 ? args[0] : args;
    if (hasCustomWriteMethod) {
      addToLogs(logs, options, {
        plainText: () => 'with',
        formatted: () => [`%cwith`, 'grey'],
      });
    } else {
      addToLogs(logs, options, {
        plainText: () => 'to',
        formatted: () => [`%cto`, 'grey'],
      });
    }
    addToLogs(logs, options, {
      plainText: () => {
        if (stringifyValues) {
          return stringifyValue(argsToStringify, options);
        } else {
          return [argsToStringify];
        }
      },
      formatted: () => {
        if (stringifyValues) {
          const stringifiedArgs = stringifyValue(argsToStringify, options);
          return [`%c${stringifiedArgs}`, 'default'];
        } else {
          return [`%c%o`, 'default', { data: argsToStringify }];
        }
      },
    });
    if (stringifyValues) {
      if (hasCustomWriteMethod) {
        additionalDataToLog.args = args;
      } else {
        additionalDataToLog.value = args[0];
      }
    }
  })

  // {result}
  .withLog(function addResultToTransactionLogs(context) {
    if (!context.showResult) return;
    const {
      logs,
      additionalDataToLog,
      options,
      options: { stringifyValues },
      result,
    } = context;
    addToLogs(logs, options, {
      plainText: () => {
        if (stringifyValues) {
          const stringifiedResult = stringifyValue(result, options);
          return `and returned ${stringifiedResult}`;
        } else {
          return [`and returned`, result];
        }
      },
      formatted: () => {
        if (stringifyValues) {
          const stringifiedResult = stringifyValue(result, options);
          return [`%cand returned %c${stringifiedResult}`, 'grey', 'default'];
        } else {
          return [`%cand returned %c%o`, 'grey', 'default', { data: result }];
        }
      },
    });
    if (stringifyValues) {
      additionalDataToLog.result = result;
    }
  });
