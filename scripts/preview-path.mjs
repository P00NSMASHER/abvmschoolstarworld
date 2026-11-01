import { realpathSync } from 'node:fs';
import { resolve, sep } from 'node:path';

// Resolve twice: the lexical containment check blocks ../, while the
// canonical check also rejects links that escape the preview's public root.
export function resolvePreviewPath(root, relative) {
  if (relative.split(/[\\/]/).includes("..")) return null;
  const canonicalRoot = realpathSync(root);
  const requested = resolve(canonicalRoot, relative);
  if (!requested.startsWith(canonicalRoot + sep)) return null;
  const canonicalTarget = realpathSync(requested);
  return canonicalTarget.startsWith(canonicalRoot + sep) ? canonicalTarget : null;
}
