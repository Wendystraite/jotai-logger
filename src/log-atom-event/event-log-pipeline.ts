import type { AtomsLoggerEventMap, AtomsLoggerState } from '../types/atoms-logger.js';
import { getEventMapEvent } from '../utils/get-event-map-event.js';
import { stringifyValue } from '../utils/stringify-value.js';
import { addAtomToLogs } from './add-atom-to-logs.js';
import { addToLogs } from './add-to-logs.js';
import { LogPipeline } from './log-pipeline.js';

export const EventLogPipeline = new LogPipeline()
  .withArgs<{
    eventMap: AtomsLoggerEventMap;
    options: AtomsLoggerState;
  }>()

  // Initialize base logging context
  .withMeta(({ eventMap }) => ({
    logs: [] as unknown[] as [string, ...unknown[]],
    subLogsArray: [] as [string, ...unknown[]][],
    subLogsObject: {} as Record<string, unknown>,
    event: getEventMapEvent(eventMap),
  }))

  // Process old values
  .withMeta(({ event }) => {
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

    return { hasOldValue, oldValue, isOldValueError, hasOldValues, oldValues };
  })

  // Process new values
  .withMeta(({ eventMap, event }) => {
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

    const showNewValueInLog = !eventMap.mounted;

    return { hasNewValue, newValue, isNewValueError, showNewValueInLog };
  })

  // {event}
  .withLog(({ logs, eventMap, options }) => {
    if (eventMap.initialized) {
      addToLogs(logs, options, {
        plainText: () => 'initialized value of',
        formatted: () => ['%cinitialized value %cof', ['blue', 'bold'], 'grey'],
      });
    } else if (eventMap.changed) {
      addToLogs(logs, options, {
        plainText: () => 'changed value of',
        formatted: () => ['%cchanged value %cof', ['lightBlue', 'bold'], 'grey'],
      });
    } else if (eventMap.initialPromisePending) {
      addToLogs(logs, options, {
        plainText: () => 'pending initial promise of',
        formatted: () => ['%cpending initial promise %cof', ['pink', 'bold'], 'grey'],
      });
    } else if (eventMap.changedPromisePending) {
      addToLogs(logs, options, {
        plainText: () => 'pending promise of',
        formatted: () => ['%cpending promise %cof', ['pink', 'bold'], 'grey'],
      });
    } else if (eventMap.initialPromiseResolved) {
      addToLogs(logs, options, {
        plainText: () => 'resolved initial promise of',
        formatted: () => [
          '%cresolved %cinitial promise %cof',
          ['green', 'bold'],
          ['pink', 'bold'],
          'grey',
        ],
      });
    } else if (eventMap.changedPromiseResolved) {
      addToLogs(logs, options, {
        plainText: () => 'resolved promise of',
        formatted: () => ['%cresolved %cpromise %cof', ['green', 'bold'], ['pink', 'bold'], 'grey'],
      });
    } else if (eventMap.initialPromiseRejected) {
      addToLogs(logs, options, {
        plainText: () => 'rejected initial promise of',
        formatted: () => [
          '%crejected %cinitial promise %cof',
          ['red', 'bold'],
          ['pink', 'bold'],
          'grey',
        ],
      });
    } else if (eventMap.changedPromiseRejected) {
      addToLogs(logs, options, {
        plainText: () => 'rejected promise of',
        formatted: () => ['%crejected %cpromise %cof', ['red', 'bold'], ['pink', 'bold'], 'grey'],
      });
    } else if (eventMap.initialPromiseAborted) {
      addToLogs(logs, options, {
        plainText: () => 'aborted initial promise of',
        formatted: () => [
          '%caborted %cinitial promise %cof',
          ['red', 'bold'],
          ['pink', 'bold'],
          'grey',
        ],
      });
    } else if (eventMap.changedPromiseAborted) {
      addToLogs(logs, options, {
        plainText: () => 'aborted promise of',
        formatted: () => ['%caborted %cpromise %cof', ['red', 'bold'], ['pink', 'bold'], 'grey'],
      });
    } else if (eventMap.destroyed) {
      addToLogs(logs, options, {
        plainText: () => 'destroyed',
        formatted: () => ['%cdestroyed', ['red', 'bold']],
      });
    } else if (eventMap.mounted) {
      addToLogs(logs, options, {
        plainText: () => 'mounted',
        formatted: () => ['%cmounted', ['green', 'bold']],
      });
    } else if (eventMap.unmounted) {
      addToLogs(logs, options, {
        plainText: () => 'unmounted',
        formatted: () => ['%cunmounted', ['red', 'bold']],
      });
    }
  })

  // {atom}
  .withLog(({ logs, event, options }) => {
    addAtomToLogs(logs, event.atom, options);
  })

  // xx times
  .withLog(({ logs, hasOldValues, oldValues, options }) => {
    if (hasOldValues) {
      addToLogs(logs, options, {
        plainText: () => `${oldValues.length.toString()} times`,
        formatted: () => [`%c${oldValues.length.toString()} %ctimes`, 'default', 'grey'],
      });
    }
  })

  // from xx
  .withLog(
    ({
      logs,
      subLogsArray,
      subLogsObject,
      options,
      options: { stringifyValues },
      hasOldValue,
      oldValue,
      isOldValueError,
      hasOldValues,
      oldValues,
    }) => {
      if (hasOldValue) {
        addToLogs(logs, options, {
          plainText: () => {
            if (stringifyValues) {
              const stringifiedState = stringifyValue(oldValue, options);
              return `from ${stringifiedState}`;
            } else if (hasOldValues) {
              return [`from`, oldValues];
            } else {
              return [`from`, oldValue];
            }
          },
          formatted: () => {
            if (stringifyValues) {
              const stringifiedState = stringifyValue(oldValue, options);
              return [`%cfrom %c${stringifiedState}`, 'grey', 'default'];
            } else {
              return [`%cfrom %c%o`, 'grey', 'default', { data: oldValue }];
            }
          },
        });
      }

      if (hasOldValues) {
        subLogsArray.push(['old values', oldValues]);
        if (options.stringifyValues) subLogsObject.oldValues = oldValues;
      } else if (hasOldValue) {
        if (isOldValueError) {
          subLogsArray.push(['old error', oldValue]);
          if (options.stringifyValues) subLogsObject.oldError = oldValue;
        } else {
          subLogsArray.push(['old value', oldValue]);
          if (options.stringifyValues) subLogsObject.oldValue = oldValue;
        }
      }
    },
  )

  // to xx
  .withLog(
    ({
      logs,
      subLogsArray,
      subLogsObject,
      options,
      options: { stringifyValues },
      hasNewValue,
      newValue,
      isNewValueError,
      showNewValueInLog,
      hasOldValue,
      isOldValueError,
    }) => {
      if (showNewValueInLog && hasNewValue) {
        addToLogs(logs, options, {
          plainText: () => {
            if (stringifyValues) {
              const stringifiedState = stringifyValue(newValue, options);
              return `to ${stringifiedState}`;
            } else {
              return [`to`, newValue];
            }
          },
          formatted: () => {
            if (stringifyValues) {
              const stringifiedState = stringifyValue(newValue, options);
              return [`%cto %c${stringifiedState}`, 'grey', 'default'];
            } else {
              return [`%cto %c%o`, 'grey', 'default', { data: newValue }];
            }
          },
        });
      }

      if (hasNewValue) {
        if (isNewValueError) {
          if (hasOldValue && isOldValueError) {
            subLogsArray.push(['new error', newValue]);
            if (options.stringifyValues) subLogsObject.newError = newValue;
          } else {
            subLogsArray.push(['error', newValue]);
            if (options.stringifyValues) subLogsObject.error = newValue;
          }
        } else {
          if (hasOldValue && !isOldValueError) {
            subLogsArray.push(['new value', newValue]);
            if (options.stringifyValues) subLogsObject.newValue = newValue;
          } else {
            subLogsArray.push(['value', newValue]);
            if (options.stringifyValues) subLogsObject.value = newValue;
          }
        }
      }
    },
  )

  // Extra data logger
  .withLog(({ subLogsArray, subLogsObject, eventMap, event }) => {
    // If the atom is unmounted or destroyed, we don't need to log anything else.
    if (!eventMap.unmounted && !eventMap.destroyed) {
      if (event.pendingPromises) {
        subLogsArray.push(['pending promises', event.pendingPromises]);
        subLogsObject.pendingPromises = event.pendingPromises;
      }
      if (event.dependencies) {
        subLogsArray.push(['dependencies', event.dependencies]);
        subLogsObject.dependencies = event.dependencies;
      }
      if (event.mountedDependencies) {
        subLogsArray.push(['mounted dependencies', event.mountedDependencies]);
        subLogsObject.mountedDependencies = event.mountedDependencies;
      }
      if (event.mountedDependents) {
        subLogsArray.push(['mounted dependents', event.mountedDependents]);
        subLogsObject.mountedDependents = event.mountedDependents;
      }
    }
  })

  // Indentation
  .withLog(({ logs, subLogsArray, options }) => {
    const { indentSpaces, indentSpacesDepth1, indentSpacesDepth2 } = options;

    if (indentSpaces > 0) {
      logs[0] = `${indentSpacesDepth1}${logs[0]}`;

      for (const subLogs of subLogsArray) {
        if (indentSpaces > 0) {
          subLogs[0] = `${indentSpacesDepth2}${subLogs[0]}`;
        }
      }
    }
  });
