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
    indentSpacesDepth1: string;
    plainTextOutput: boolean;
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
  const { stringifyLimit, indentSpacesDepth1 } = options;

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
    plainText: eventLabel,
    colored: [coloredEventLabel, ...eventColors],
  });

  addAtomIdToLogs(logs, atomId, options);

  if (hasOldValues) {
    addToLogs(logs, options, {
      plainText: `${oldValues.length.toString()} times`,
      colored: [`%c${oldValues.length.toString()} %ctimes`, 'default', 'grey'],
    });
  }

  if (hasOldValue) {
    const stringifiedState = stringifyValue(oldValue, {
      maxLength: stringifyLimit,
    });

    addToLogs(logs, options, {
      plainText: `from ${stringifiedState}`,
      colored: [`%cfrom %c${stringifiedState}`, 'grey', 'default'],
    });
  }

  if (hasNewValue) {
    const stringifiedState = stringifyValue(newValue, {
      maxLength: stringifyLimit,
    });

    addToLogs(logs, options, {
      plainText: `to ${stringifiedState}`,
      colored: [`%cto %c${stringifiedState}`, 'grey', 'default'],
    });
  }

  const additionalDataToLog = getAdditionalDataToLog(store, atom, logEventMap);

  const subLogsArray: [string, ...unknown[]][] = [];
  const subLogsObject: Record<string, unknown> = {};

  if (hasOldValues) {
    subLogsArray.push(['old values', oldValues]);
    subLogsObject.oldValues = oldValues;
  } else if (hasOldValue) {
    if (isOldValueError) {
      subLogsArray.push(['old error', oldValue]);
      subLogsObject.oldError = oldValue;
    } else {
      subLogsArray.push(['old value', oldValue]);
      subLogsObject.oldValue = oldValue;
    }
  }

  if (hasNewValue) {
    if (isNewValueError) {
      if (hasOldValue && isOldValueError) {
        subLogsArray.push(['new error', newValue]);
        subLogsObject.newError = newValue;
      } else {
        subLogsArray.push(['error', newValue]);
        subLogsObject.error = newValue;
      }
      if ('error' in additionalDataToLog) {
        delete additionalDataToLog.error;
      }
    } else {
      if (hasOldValue && !isOldValueError) {
        subLogsArray.push(['new value', newValue]);
        subLogsObject.newValue = newValue;
      } else {
        subLogsArray.push(['value', newValue]);
        subLogsObject.value = newValue;
      }
      if ('value' in additionalDataToLog) {
        delete additionalDataToLog.value;
      }
    }
  }

  if (indentSpacesDepth1.length > 0) {
    logs[0] = `${indentSpacesDepth1}${logs[0]}`;
  }

  return { logs, subLogsArray, subLogsObject, additionalDataToLog };
}
