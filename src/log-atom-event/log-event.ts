import type { Atom } from 'jotai';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import { DEFAULT_ATOMS_LOGGER_COLORS } from '../consts/colors.js';
import {
  type AtomsLoggerEvent,
  type AtomsLoggerEventMap,
  type StoreWithAtomsLogger,
} from '../types/atoms-logger.js';
import { stringifyValue } from '../utils/stringify-value.js';
import { addToLogs } from './add-to-logs.js';
import { getAdditionalDataToLog } from './get-additional-data-to-log.js';
import { addAtomIdToLogs } from './log-atom-id.js';

const AtomsLoggerEventLabelMap: Record<
  keyof AtomsLoggerEventMap,
  {
    label: string;
    coloredLabel: `%c${string}`;
    colors: (
      | keyof typeof DEFAULT_ATOMS_LOGGER_COLORS
      | [keyof typeof DEFAULT_ATOMS_LOGGER_COLORS, 'bold' | 'normal' | 'light']
    )[];
  }
> = {
  initialized: {
    label: 'initialized value of',
    coloredLabel: '%cinitialized value %cof',
    colors: [['blue', 'bold'], 'grey'],
  },
  changed: {
    label: 'changed value of',
    coloredLabel: '%cchanged value %cof',
    colors: [['lightBlue', 'bold'], 'grey'],
  },
  initialPromisePending: {
    label: 'pending initial promise of',
    coloredLabel: '%cpending initial promise %cof',
    colors: [['pink', 'bold'], 'grey'],
  },
  changedPromisePending: {
    label: 'pending promise of',
    coloredLabel: '%cpending promise %cof',
    colors: [['pink', 'bold'], 'grey'],
  },
  initialPromiseResolved: {
    label: 'resolved initial promise of',
    coloredLabel: '%cresolved %cinitial promise %cof',
    colors: [['green', 'bold'], ['pink', 'bold'], 'grey'],
  },
  changedPromiseResolved: {
    label: 'resolved promise of',
    coloredLabel: '%cresolved %cpromise %cof',
    colors: [['green', 'bold'], ['pink', 'bold'], 'grey'],
  },
  initialPromiseRejected: {
    label: 'rejected initial promise of',
    coloredLabel: '%crejected %cinitial promise %cof',
    colors: [['red', 'bold'], ['pink', 'bold'], 'grey'],
  },
  changedPromiseRejected: {
    label: 'rejected promise of',
    coloredLabel: '%crejected %cpromise %cof',
    colors: [['red', 'bold'], ['pink', 'bold'], 'grey'],
  },
  initialPromiseAborted: {
    label: 'aborted initial promise of',
    coloredLabel: '%caborted %cinitial promise %cof',
    colors: [['red', 'bold'], ['pink', 'bold'], 'grey'],
  },
  changedPromiseAborted: {
    label: 'aborted promise of',
    coloredLabel: '%caborted %cpromise %cof',
    colors: [['red', 'bold'], ['pink', 'bold'], 'grey'],
  },
  destroyed: {
    label: 'destroyed',
    coloredLabel: '%cdestroyed',
    colors: [['red', 'bold']],
  },
  mounted: {
    label: 'mounted',
    coloredLabel: '%cmounted',
    colors: [['green', 'bold']],
  },
  unmounted: {
    label: 'unmounted',
    coloredLabel: '%cunmounted',
    colors: [['red', 'bold']],
  },
};

export function logEvent(store: StoreWithAtomsLogger, logEventMap: AtomsLoggerEventMap): void {
  const { collapseEvents, logger, indentSpaces, indentSpacesDepth2 } = store[ATOMS_LOGGER_SYMBOL];
  let { groupLogs } = store[ATOMS_LOGGER_SYMBOL];

  const toLog = getAtomEventMapLogs(store, logEventMap, store[ATOMS_LOGGER_SYMBOL]);

  if (!toLog) {
    return;
  }

  const { logs, subLogsArray, subLogsObject, additionalDataToLog } = toLog;

  if (collapseEvents ? !logger.groupCollapsed : !logger.group) {
    groupLogs = false;
  } else if (!logger.groupEnd) {
    groupLogs = false;
  } else if (subLogsArray.length <= 0 && Object.entries(additionalDataToLog).length <= 0) {
    groupLogs = false;
  }

  try {
    if (!groupLogs) {
      const allDataToLog = { ...subLogsObject, ...additionalDataToLog };
      if (Object.entries(allDataToLog).length <= 0) {
        logger.log(...logs);
      } else {
        logger.log(...logs, allDataToLog);
      }
    } else {
      if (collapseEvents) {
        logger.groupCollapsed?.(...logs);
      } else {
        logger.group?.(...logs);
      }
      for (const subLogs of subLogsArray) {
        if (indentSpaces > 0) {
          subLogs[0] = `${indentSpacesDepth2}${subLogs[0]}`;
        }
        logger.log(...subLogs);
      }
      for (const [key, value] of Object.entries(additionalDataToLog)) {
        logger.log(`${indentSpacesDepth2}${key}`, value);
      }
    }
  } finally {
    if (groupLogs) {
      logger.groupEnd?.();
    }
  }
}

// eslint-disable-next-line complexity -- TODO : to refactor
export function getAtomEventMapLogs(
  store: StoreWithAtomsLogger,
  logEventMap: AtomsLoggerEventMap,
  options: {
    stringifyValues: boolean;
    indentSpacesDepth1: string;
    formattedOutput: boolean;
    stringifyLimit: number;
    colorScheme: 'default' | 'light' | 'dark';
  },
):
  | {
      logs: [string, ...unknown[]];
      subLogsArray: [string, ...unknown[]][];
      subLogsObject: Record<string, unknown>;
      additionalDataToLog: Record<string, unknown>;
    }
  | undefined {
  const { stringifyLimit: maxLength, indentSpacesDepth1, stringifyValues } = options;

  const [eventType, event] = (Object.entries(logEventMap)[0] ?? []) as [
    keyof AtomsLoggerEventMap,
    AtomsLoggerEvent | undefined,
  ];

  if (!event) {
    return undefined;
  }

  let atom: Atom<unknown> | undefined;
  let atomId: string;

  if ('atomId' in event) {
    atomId = event.atomId;
  } else {
    atom = event.atom;
    atomId = event.atom.toString();
  }

  const {
    label: eventLabel,
    coloredLabel: coloredEventLabel,
    colors: eventColors,
  } = AtomsLoggerEventLabelMap[eventType];

  let hasOldValue = false;
  let oldValue: unknown;
  let isOldValueError = false;

  if ('oldValue' in event) {
    hasOldValue = true;
    oldValue = event.oldValue;
    isOldValueError = oldValue instanceof Error;
  }

  let hasOldValues = false;
  let oldValues: unknown[] = [];
  if ('oldValues' in event && event.oldValues !== undefined && event.oldValues.length > 0) {
    hasOldValues = true;
    oldValues = event.oldValues;
    hasOldValue = true;
    oldValue = oldValues[0];
    isOldValueError = oldValue instanceof Error;
  }

  let hasNewValue = false;
  let newValue: unknown;
  let isNewValueError = false;

  if ('newValue' in event) {
    hasNewValue = true;
    newValue = event.newValue;
    isNewValueError = false;
  } else if ('value' in event) {
    hasNewValue = true;
    newValue = event.value;
    isNewValueError = false;
  } else if ('error' in event) {
    hasNewValue = true;
    newValue = event.error;
    isNewValueError = true;
  }

  const logs = [] as unknown[] as [string, ...unknown[]];

  addToLogs(logs, options, {
    plainText: () => eventLabel,
    formatted: () => [coloredEventLabel, ...eventColors],
  });

  addAtomIdToLogs(logs, atomId, options);

  if (hasOldValues) {
    addToLogs(logs, options, {
      plainText: () => `${oldValues.length.toString()} times`,
      formatted: () => [`%c${oldValues.length.toString()} %ctimes`, 'default', 'grey'],
    });
  }

  if (hasOldValue) {
    addToLogs(logs, options, {
      plainText: () => {
        if (stringifyValues) {
          const stringifiedState = stringifyValue(oldValue, { maxLength });
          return `from ${stringifiedState}`;
        } else if (hasOldValues) {
          return [`from`, oldValues];
        } else {
          return [`from`, oldValue];
        }
      },
      formatted: () => {
        if (stringifyValues) {
          const stringifiedState = stringifyValue(oldValue, { maxLength });
          return [`%cfrom %c${stringifiedState}`, 'grey', 'default'];
        } else {
          return [`%cfrom %c%o`, 'grey', 'default', { data: oldValue }];
        }
      },
    });
  }

  if (hasNewValue) {
    addToLogs(logs, options, {
      plainText: () => {
        if (stringifyValues) {
          const stringifiedState = stringifyValue(newValue, { maxLength });
          return `to ${stringifiedState}`;
        } else {
          return [`to`, newValue];
        }
      },
      formatted: () => {
        if (stringifyValues) {
          const stringifiedState = stringifyValue(newValue, { maxLength });
          return [`%cto %c${stringifiedState}`, 'grey', 'default'];
        } else {
          return [`%cto %c%o`, 'grey', 'default', { data: newValue }];
        }
      },
    });
  }

  const additionalDataToLog = getAdditionalDataToLog(store, atom, logEventMap);

  const subLogsArray: [string, ...unknown[]][] = [];
  const subLogsObject: Record<string, unknown> = {};

  if (hasOldValues) {
    subLogsArray.push(['old values', oldValues]);
    if (stringifyValues) subLogsObject.oldValues = oldValues;
  } else if (hasOldValue) {
    if (isOldValueError) {
      subLogsArray.push(['old error', oldValue]);
      if (stringifyValues) subLogsObject.oldError = oldValue;
    } else {
      subLogsArray.push(['old value', oldValue]);
      if (stringifyValues) subLogsObject.oldValue = oldValue;
    }
  }

  if (hasNewValue) {
    if (isNewValueError) {
      if (hasOldValue && isOldValueError) {
        subLogsArray.push(['new error', newValue]);
        if (stringifyValues) subLogsObject.newError = newValue;
      } else {
        subLogsArray.push(['error', newValue]);
        if (stringifyValues) subLogsObject.error = newValue;
      }
      if (!stringifyValues || 'error' in additionalDataToLog) {
        delete additionalDataToLog.error;
      }
    } else {
      if (hasOldValue && !isOldValueError) {
        subLogsArray.push(['new value', newValue]);
        if (stringifyValues) subLogsObject.newValue = newValue;
      } else {
        subLogsArray.push(['value', newValue]);
        if (stringifyValues) subLogsObject.value = newValue;
      }
      if (!stringifyValues || 'value' in additionalDataToLog) {
        delete additionalDataToLog.value;
      }
    }
  }

  if (indentSpacesDepth1.length > 0) {
    logs[0] = `${indentSpacesDepth1}${logs[0]}`;
  }

  return { logs, subLogsArray, subLogsObject, additionalDataToLog };
}
