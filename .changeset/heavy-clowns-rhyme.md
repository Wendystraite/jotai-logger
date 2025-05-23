---
'jotai-logger': patch
---

fix: do not log mounted dependencies

Instead of logging "dependencies", "mounted dependencies" and "mounted
dependents", only log "dependencies" and "dependents". We already know
that an atom is mounted with the corresponding event and Jotai internals
guarantee that a mounted atom has all its dependencies mounted so
showing both dependencies and mounted dependencies is pointless.
This also has the benefits of better performances since we don't need to
convert both lists to strings.
