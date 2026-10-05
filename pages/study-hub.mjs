// Public Study entry point. Learning, source filtering and persistence remain in
// the core controller; the presentation layer moves existing live controls.
import { mountStudyHub as mountController } from './study-hub-core.mjs';
import { prepareStudyRoom } from './study-room-view.mjs';
export { questionsForTest } from './study-hub-core.mjs';
const presentations = new WeakMap();
export async function mountStudyHub(host, options = {}) {
  if (!host?.isConnected) return;
  presentations.get(host)?.dispose();
  const presentation = prepareStudyRoom(host, options);
  presentations.set(host, presentation);
  try {
    await mountController(host, options);
  } finally {
    presentation.refresh();
  }
}
