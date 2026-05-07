import type { AnyAtom, AtomId } from '../types/event.js';

export function convertAtomsToStrings(
  atoms: Set<AnyAtom> | undefined,
  options: {
    shouldShowPrivateAtoms?: boolean;
  },
): Set<AtomId> | undefined {
  if (!atoms) {
    return undefined;
  }
  const strings = new Set<AtomId>();
  for (const atom of atoms) {
    if (!options.shouldShowPrivateAtoms && atom.debugPrivate === true) {
      continue;
    }
    strings.add(atom.toString());
  }
  return strings;
}
