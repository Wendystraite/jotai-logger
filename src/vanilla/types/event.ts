import type { Atom } from 'jotai';

/**
 * String representation of an atom.
 */
export type AtomId = string;

/**
 * Generic atom type.
 */
export type AnyAtom = Atom<unknown>;

export const AtomsLoggerEventTypes = {
  initialized: 1,
  initialPromisePending: 2,
  initialPromiseResolved: 3,
  initialPromiseRejected: 4,
  initialPromiseAborted: 5,
  changed: 6,
  changedPromisePending: 7,
  changedPromiseResolved: 8,
  changedPromiseRejected: 9,
  changedPromiseAborted: 10,
  dependenciesChanged: 11,
  mounted: 12,
  unmounted: 13,
  destroyed: 14,
} as const;

export type AtomsLoggerEventTypes = typeof AtomsLoggerEventTypes;

export type AtomsLoggerEventType = AtomsLoggerEventTypes[keyof AtomsLoggerEventTypes];

/**
 * Fields common to all event types.
 */
export interface AtomsLoggerEventBase {
  /** Atoms whose pending promises are blocking this atom at the time of the event. @see {@link INTERNAL_AtomState.p} */
  pendingPromises?: AtomId[];
  /** The set of atoms this atom depends on at the time of the event. @see {@link INTERNAL_AtomState.d} @see {@link INTERNAL_Mounted.d} */
  dependencies?: Set<AtomId>;
  /** The set of atoms that depend on this atom at the time of the event. @see {@link INTERNAL_Mounted.t} */
  dependents?: AtomId[];
}

/** Event emitted when an atom is initialized with a synchronous value. */
export interface AtomsLoggerEventInitialized extends AtomsLoggerEventBase {
  type: AtomsLoggerEventTypes['initialized'];
  atom: AnyAtom;
  /** The initial value of the atom. */
  value: unknown;
}

/** Event emitted when an atom's initial promise is pending. */
export interface AtomsLoggerEventInitialPromisePending extends AtomsLoggerEventBase {
  type: AtomsLoggerEventTypes['initialPromisePending'];
  atom: AnyAtom;
}

/** Event emitted when an atom's initial promise resolves. */
export interface AtomsLoggerEventInitialPromiseResolved extends AtomsLoggerEventBase {
  type: AtomsLoggerEventTypes['initialPromiseResolved'];
  atom: AnyAtom;
  /** The resolved value of the promise. */
  value: unknown;
}

/** Event emitted when an atom's initial promise rejects. */
export interface AtomsLoggerEventInitialPromiseRejected extends AtomsLoggerEventBase {
  type: AtomsLoggerEventTypes['initialPromiseRejected'];
  atom: AnyAtom;
  /** The rejection reason. */
  error: unknown;
}

/** Event emitted when an atom's initial promise is aborted. */
export interface AtomsLoggerEventInitialPromiseAborted extends AtomsLoggerEventBase {
  type: AtomsLoggerEventTypes['initialPromiseAborted'];
  atom: AnyAtom;
}

/** Event emitted when an atom's value changes. */
export interface AtomsLoggerEventChanged extends AtomsLoggerEventBase {
  type: AtomsLoggerEventTypes['changed'];
  atom: AnyAtom;
  /** The previous value of the atom, if known. */
  oldValue?: unknown;
  /** Previous values when multiple updates were batched. */
  oldValues?: unknown[];
  /** The new value of the atom. */
  newValue: unknown;
}

/** Event emitted when an atom changes to a pending promise. */
export interface AtomsLoggerEventChangedPromisePending extends AtomsLoggerEventBase {
  type: AtomsLoggerEventTypes['changedPromisePending'];
  atom: AnyAtom;
  /** The previous synchronous value before the promise became pending. */
  oldValue: unknown;
}

/** Event emitted when an atom's changed promise resolves. */
export interface AtomsLoggerEventChangedPromiseResolved extends AtomsLoggerEventBase {
  type: AtomsLoggerEventTypes['changedPromiseResolved'];
  atom: AnyAtom;
  /** The value before the promise was pending. */
  oldValue: unknown;
  /** The resolved value of the promise. */
  newValue: unknown;
}

/** Event emitted when an atom's changed promise rejects. */
export interface AtomsLoggerEventChangedPromiseRejected extends AtomsLoggerEventBase {
  type: AtomsLoggerEventTypes['changedPromiseRejected'];
  atom: AnyAtom;
  /** The value before the promise was pending. */
  oldValue: unknown;
  /** The rejection reason. */
  error: unknown;
}

/** Event emitted when an atom's changed promise is aborted. */
export interface AtomsLoggerEventChangedPromiseAborted extends AtomsLoggerEventBase {
  type: AtomsLoggerEventTypes['changedPromiseAborted'];
  atom: AnyAtom;
  /** The value before the promise was pending. */
  oldValue: unknown;
}

/** Event emitted when an atom's dependencies change. */
export type AtomsLoggerEventDependenciesChanged = AtomsLoggerEventBase & {
  type: AtomsLoggerEventTypes['dependenciesChanged'];
  atom: AnyAtom;
  /** The set of dependencies before this change. */
  oldDependencies?: Set<AtomId>;
} & (
    | {
        /** The dependency that was added. */
        addedDependency: AnyAtom;
        clearedDependencies?: undefined;
        removedDependency?: undefined;
      }
    | {
        addedDependency?: undefined;
        /** True when all dependencies were cleared at once. */
        clearedDependencies: true;
        removedDependency?: undefined;
      }
    | {
        addedDependency?: undefined;
        clearedDependencies?: undefined;
        /** The dependency that was removed. */
        removedDependency: AnyAtom;
      }
  );

/** Event emitted when an atom is mounted (subscribed to). */
export interface AtomsLoggerEventMounted extends AtomsLoggerEventBase {
  type: AtomsLoggerEventTypes['mounted'];
  atom: AnyAtom;
  /** The atom's value at mount time, if already initialized. */
  value?: unknown;
}

/** Event emitted when an atom is unmounted (no more subscribers). */
export interface AtomsLoggerEventUnmounted extends AtomsLoggerEventBase {
  type: AtomsLoggerEventTypes['unmounted'];
  atom: AnyAtom;
}

/** Event emitted when an atom is garbage collected. */
export interface AtomsLoggerEventDestroyed extends AtomsLoggerEventBase {
  type: AtomsLoggerEventTypes['destroyed'];
  atom: AtomId;
}

/**
 * Map from event type number to its concrete event shape.
 * Used for discriminated union lookup.
 */
export interface AtomsLoggerEventMap {
  [AtomsLoggerEventTypes.initialized]: AtomsLoggerEventInitialized;
  [AtomsLoggerEventTypes.initialPromisePending]: AtomsLoggerEventInitialPromisePending;
  [AtomsLoggerEventTypes.initialPromiseResolved]: AtomsLoggerEventInitialPromiseResolved;
  [AtomsLoggerEventTypes.initialPromiseRejected]: AtomsLoggerEventInitialPromiseRejected;
  [AtomsLoggerEventTypes.initialPromiseAborted]: AtomsLoggerEventInitialPromiseAborted;
  [AtomsLoggerEventTypes.changed]: AtomsLoggerEventChanged;
  [AtomsLoggerEventTypes.changedPromisePending]: AtomsLoggerEventChangedPromisePending;
  [AtomsLoggerEventTypes.changedPromiseResolved]: AtomsLoggerEventChangedPromiseResolved;
  [AtomsLoggerEventTypes.changedPromiseRejected]: AtomsLoggerEventChangedPromiseRejected;
  [AtomsLoggerEventTypes.changedPromiseAborted]: AtomsLoggerEventChangedPromiseAborted;
  [AtomsLoggerEventTypes.dependenciesChanged]: AtomsLoggerEventDependenciesChanged;
  [AtomsLoggerEventTypes.mounted]: AtomsLoggerEventMounted;
  [AtomsLoggerEventTypes.unmounted]: AtomsLoggerEventUnmounted;
  [AtomsLoggerEventTypes.destroyed]: AtomsLoggerEventDestroyed;
}

/** Union of all concrete event types. */
export type AtomsLoggerEvent = AtomsLoggerEventMap[keyof AtomsLoggerEventMap];
