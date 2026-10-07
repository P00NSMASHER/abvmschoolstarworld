/** Own one reading at a time without touching answers or learning history. */
export function createReadAloud(win) {
  const synthesis = win?.speechSynthesis;
  const Utterance = win?.SpeechSynthesisUtterance;
  const supported = typeof synthesis?.speak === 'function' &&
    typeof synthesis?.cancel === 'function' && typeof Utterance === 'function';
  let activeUtterance = null;
  let disposed = false;

  function clearActive(force = false) {
    const previous = activeUtterance;
    activeUtterance = null;
    if (previous) previous.onend = previous.onerror = null;
    if (!supported || (!previous && !force)) return true;
    try {
      synthesis.cancel();
      return true;
    } catch {
      // Optional speech must never prevent navigation or answer handling.
      return false;
    }
  }

  function read(text) {
    if (disposed || !supported || typeof text !== 'string' || !text.trim()) return false;
    if (!clearActive(true)) return false;
    try {
      const utterance = new Utterance(text);
      utterance.lang = 'en-US';
      utterance.rate = 0.85;
      utterance.onend = utterance.onerror = () => {
        // Cancellation callbacks may arrive after a newer reading has started.
        if (activeUtterance === utterance) activeUtterance = null;
        utterance.onend = utterance.onerror = null;
      };
      activeUtterance = utterance;
      synthesis.speak(utterance);
      return true;
    } catch {
      clearActive();
      return false;
    }
  }

  function stop() {
    clearActive();
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    stop();
  }
  return Object.freeze({ supported, read, stop, dispose });
}
