import type { Atom } from 'jotai';
import {
  type INTERNAL_AtomState,
  type INTERNAL_AtomStateMap,
  type INTERNAL_Mounted,
  INTERNAL_getBuildingBlocksRev1,
} from 'jotai/vanilla/internals';

import type { Store } from '../types/atoms-logger.js';

/**
 * Store used by jotai-devtools.
 */
interface DevStore {
  get_internal_weak_map: () => INTERNAL_AtomStateMap;
  get_mounted_atoms: () => Set<Atom<unknown>>;
}

/**
 * Get the internal methods and properties of the store.
 *
 * Must be used instead of {@link INTERNAL_getBuildingBlocksRev1} for
 * compatibility with other libraries.
 */
export function getInternalBuildingBlocks(store: Store): {
  atomStateMap: INTERNAL_AtomStateMap;
  getState(this: void, atom: Atom<unknown>): INTERNAL_AtomState | undefined;
  getMounted(this: void, atom: Atom<unknown>): INTERNAL_Mounted | undefined;
  storeHooks: ReturnType<typeof INTERNAL_getBuildingBlocksRev1>[6] | undefined;
  devtoolsMountedAtoms: Set<Atom<unknown>> | undefined;
} {
  let atomStateMap: INTERNAL_AtomStateMap | undefined;
  let getState: ((atom: Atom<unknown>) => INTERNAL_AtomState | undefined) | undefined;
  let getMounted: ((atom: Atom<unknown>) => INTERNAL_Mounted | undefined) | undefined;
  let storeHooks: ReturnType<typeof INTERNAL_getBuildingBlocksRev1>[6] | undefined;
  let devtoolsMountedAtoms: Set<Atom<unknown>> | undefined;

  // Try to get the building blocks from the store.
  let buildingBlocks = INTERNAL_getBuildingBlocksRev1(store) as
    | ReturnType<typeof INTERNAL_getBuildingBlocksRev1>
    | undefined;

  /**
   * HACK: Try to get the building blocks from the store without {@link INTERNAL_getBuildingBlocksRev1}.
   *
   * This is a workaround for the case when the store is created with a
   * different version of Jotai by another library like jotai-devtools and the
   * symbol used to as key for the internal building blocks is different.
   */
  if (!buildingBlocks) {
    const symbols = Object.getOwnPropertySymbols(store);
    for (const symbol of symbols) {
      const maybeBuildingBlocks = (store as Record<symbol, unknown>)[symbol];
      if (isBuildingBlocks(maybeBuildingBlocks)) {
        buildingBlocks = maybeBuildingBlocks;
        break;
      }
    }
  }

  if (!buildingBlocks) {
    if (!isDevtoolsStore(store)) {
      throw new Error('internal jotai building blocks not found');
    }

    /**
     * Compatibility with jotai-devtools dev store.
     * The devtools store doesn't provide the building blocks so get what we can.
     */
    atomStateMap = store.get_internal_weak_map();
    devtoolsMountedAtoms = store.get_mounted_atoms();
    getState = (atom) => {
      const atomState = store.get_internal_weak_map().get(atom);
      return atomState;
    };
    getMounted = (atom) => {
      const atomState = store.get_internal_weak_map().get(atom);
      if (atomState && 'm' in atomState) {
        return atomState.m as INTERNAL_Mounted;
      }
      return undefined;
    };
  } else {
    atomStateMap = buildingBlocks[0];
    const mountedMap = buildingBlocks[1];
    getState = atomStateMap.get.bind(atomStateMap);
    getMounted = mountedMap.get.bind(mountedMap);
    storeHooks = buildingBlocks[6];
  }

  return { atomStateMap, storeHooks, devtoolsMountedAtoms, getState, getMounted };
}

function isBuildingBlocks(
  buildingBlocks: unknown,
): buildingBlocks is ReturnType<typeof INTERNAL_getBuildingBlocksRev1> {
  return (
    Array.isArray(buildingBlocks) &&
    buildingBlocks.length >= 6 &&
    typeof buildingBlocks[0] === 'object' &&
    typeof buildingBlocks[1] === 'object' &&
    typeof buildingBlocks[6] === 'object'
  );
}

export function isDevtoolsStore(store: Store): store is Store & DevStore {
  return 'get_internal_weak_map' in store;
}
