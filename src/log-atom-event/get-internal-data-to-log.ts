import type { Atom } from 'jotai';
import {
  INTERNAL_getBuildingBlocksRev1,
  INTERNAL_isPromiseLike,
  INTERNAL_promiseStateMap,
} from 'jotai/vanilla/internals';

import type { StoreWithAtomsLogger } from '../types/atoms-logger.js';

export function getInternalAtomDataToLog(
  store: StoreWithAtomsLogger,
  atom: Atom<unknown>,
): {
  atom: Atom<unknown>;
  atomState: unknown;
  mounted: unknown;
  promiseState?: unknown;
} {
  const [atomStateMap, mountedMap] = INTERNAL_getBuildingBlocksRev1(store);

  const atomState = atomStateMap.get(atom);
  const mounted = mountedMap.get(atom);

  const internalAtomData: {
    atom: Atom<unknown>;
    atomState: unknown;
    mounted: unknown;
    promiseState?: unknown;
  } = {
    atom,
    atomState,
    mounted,
  };

  if (INTERNAL_isPromiseLike(atomState?.v)) {
    const promiseState = INTERNAL_promiseStateMap.get(atomState.v);
    internalAtomData.promiseState = promiseState;
  }

  return internalAtomData;
}

export function getInternalStoreDataToLog(store: StoreWithAtomsLogger): {
  store: unknown;
  buildingBlocks: unknown;
} {
  const [
    atomStateMap,
    mountedMap,
    invalidatedAtoms,
    changedAtoms,
    mountCallbacks,
    unmountCallbacks,
    storeHooks,
    atomRead,
    atomWrite,
    atomOnInit,
    atomOnMount,
    ensureAtomState,
    flushCallbacks,
    recomputeInvalidatedAtoms,
    readAtomState,
    invalidateDependents,
    writeAtomState,
    mountDependencies,
    mountAtom,
    unmountAtom,
  ] = INTERNAL_getBuildingBlocksRev1(store);
  return {
    store,
    buildingBlocks: {
      atomStateMap,
      mountedMap,
      invalidatedAtoms,
      changedAtoms,
      mountCallbacks,
      unmountCallbacks,
      storeHooks,
      atomRead,
      atomWrite,
      atomOnInit,
      atomOnMount,
      ensureAtomState,
      flushCallbacks,
      recomputeInvalidatedAtoms,
      readAtomState,
      invalidateDependents,
      writeAtomState,
      mountDependencies,
      mountAtom,
      unmountAtom,
      promiseStateMap: INTERNAL_promiseStateMap,
    },
  };
}
