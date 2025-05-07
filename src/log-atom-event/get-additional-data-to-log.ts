import type { Atom } from 'jotai';
import { INTERNAL_getBuildingBlocksRev1, INTERNAL_isPromiseLike } from 'jotai/vanilla/internals';

import { ATOMS_LOGGER_SYMBOL } from '../consts/atom-logger-symbol.js';
import type { AtomsLoggerEventMap, StoreWithAtomsLogger } from '../types/atoms-logger.js';
import { convertAtomsToStrings } from '../utils/convert-atoms-to-strings.js';
import { getInternalAtomDataToLog } from './get-internal-data-to-log.js';

export function getAdditionalDataToLog(
  store: StoreWithAtomsLogger,
  atom: Atom<unknown> | undefined,
  logEventMap: AtomsLoggerEventMap,
): {
  dependencies?: string[];
  pendingPromises?: string[];
  value?: unknown;
  error?: unknown;
  mountedDependencies?: string[];
  mountedDependents?: string[];
  event?: AtomsLoggerEventMap;
  internal?: Record<string, unknown>;
} {
  if (!atom) {
    return {};
  }

  if (logEventMap.unmounted || logEventMap.destroyed) {
    // If the atom is unmounted or destroyed, we don't need to log anything else.
    return {};
  }

  const { shouldShowPrivateAtoms, enableDebugMode } = store[ATOMS_LOGGER_SYMBOL];

  const dataToLog: {
    dependencies?: string[];
    pendingPromises?: string[];
    value?: unknown;
    error?: unknown;
    mountedDependencies?: string[];
    mountedDependents?: string[];
    event?: AtomsLoggerEventMap;
    internal?: Record<string, unknown>;
  } = {};

  const buildingBlocks = INTERNAL_getBuildingBlocksRev1(store);
  const atomStateMap = buildingBlocks[0];
  const mountedMap = buildingBlocks[1];

  const atomState = atomStateMap.get(atom);

  if (atomState) {
    if (atomState.d.size > 0) {
      const dependencies = convertAtomsToStrings(atomState.d.keys(), {
        shouldShowPrivateAtoms,
      });
      if (dependencies) {
        dataToLog.dependencies = dependencies;
      }
    }
    if (atomState.p.size > 0) {
      const pendingPromises = convertAtomsToStrings(atomState.p.keys(), {
        shouldShowPrivateAtoms,
      });
      if (pendingPromises) {
        dataToLog.pendingPromises = pendingPromises;
      }
    }
    if (atomState.v !== undefined && !INTERNAL_isPromiseLike(atomState.v)) {
      dataToLog.value = atomState.v;
    }
    if (atomState.e !== undefined) {
      dataToLog.error = atomState.e;
    }
  }

  const mountedState = mountedMap.get(atom);

  if (mountedState) {
    if (mountedState.d.size > 0) {
      const mountedDependencies = convertAtomsToStrings(mountedState.d.values(), {
        shouldShowPrivateAtoms,
      });
      if (mountedDependencies) {
        dataToLog.mountedDependencies = mountedDependencies;
      }
    }
    if (mountedState.t.size > 0) {
      const mountedDependents = convertAtomsToStrings(mountedState.t.values(), {
        shouldShowPrivateAtoms,
      });
      if (mountedDependents) {
        dataToLog.mountedDependents = mountedDependents;
      }
    }
  }

  if (enableDebugMode) {
    dataToLog.event = logEventMap;
    dataToLog.internal = getInternalAtomDataToLog(store, atom);
  }

  return dataToLog;
}
