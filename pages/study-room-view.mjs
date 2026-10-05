/** Child-facing presentation. Never copies, rewrites or transmits school data. */
const destinations = Object.freeze({
  weekly: { label: 'This week', note: 'What we are learning', icon: 'book', tone: 'blue' },
  cumulative: { label: 'Cumulative', note: 'Everything I have learned', icon: 'collection', tone: 'purple' },
  star: { label: 'STAR practice', note: 'Math & reading skills', icon: 'spark', tone: 'green' },
  games: { label: 'Study games', note: 'Make your own mix', icon: 'play', tone: 'orange' },
});
const destinationKeys = Object.freeze(Object.keys(destinations));
const subjects = Object.freeze({
  'study-religion': ['faith', 'purple'], 'study-reading': ['book', 'blue'],
  'study-math': ['math', 'green'], 'study-spelling': ['pencil', 'orange'],
  'study-sight': ['words', 'pink'], 'study-vocabulary': ['collection', 'teal'],
});
const paths = Object.freeze({
  book: '<path d="M12 6v15M3 5c4-2 6-1 9 1 3-2 5-3 9-1v14c-4-2-6-1-9 1-3-2-5-3-9-1Z"/>',
  collection: '<rect x="5" y="7" width="14" height="14" rx="3"/><path d="M8 3h8M6 5h12M9 12h6M9 16h4"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5ZM20 3v4M18 5h4"/>',
  play: '<rect x="3" y="3" width="18" height="18" rx="6"/><path d="m10 8 6 4-6 4Z"/>',
  math: '<rect x="4" y="3" width="16" height="18" rx="4"/><path d="M8 7h8M8 12h3M9.5 10.5v3M14 12h2M8 17h3M14 17h2"/>',
  faith: '<path d="M10 3h4v6h6v4h-6v8h-4v-8H4V9h6Z"/>',
  pencil: '<path d="m4 20 1-5L16 4a2 2 0 0 1 4 4L9 19Zm10-14 4 4M5 15l4 4"/>',
  words: '<path d="m3 19 5-14 5 14M5 14h6M15 10h5v9h-5v-5h5"/>',
  sound: '<path d="M4 10h4l5-4v12l-5-4H4ZM17 8c3 2 3 6 0 8M20 5c5 4 5 10 0 14"/>',
});
export function roomIcon(name) {
  const path = Object.hasOwn(paths, name) ? paths[name] : paths.book;
  return '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + path + '</svg>';
}
export function destinationMarkup(key) {
  if (!Object.hasOwn(destinations, key)) return '';
  const d = destinations[key];
  return '<span class="room-destination-icon" aria-hidden="true">' + roomIcon(d.icon) +
    '</span><span class="room-destination-label">' + d.label +
    '</span><span class="room-destination-note" aria-hidden="true">' + d.note + '</span>';
}
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

export function prepareStudyRoom(host) {
  const screen = host.closest('.study-screen');
  if (!screen) return { refresh() {}, dispose() {} };
  const doc = host.ownerDocument, win = doc.defaultView;
  screen.classList.add('study-room-v2');
  const legacy = screen.querySelector('[data-study-legacy]');
  const daily = legacy?.querySelector('.daily-practice') || screen.querySelector('.room-daily');
  if (daily) {
    daily.classList.add('room-daily');
    // Move, do not clone: the existing daily engine, completion and delegated
    // handlers still own this card. It is no longer buried under four menus.
    screen.insertBefore(daily, host);
  }
  const sectionLabel = legacy?.querySelector('.study-section-label');
  let shelf = legacy?.querySelector('.room-subject-grid');
  if (legacy && !shelf) {
    shelf = doc.createElement('div');
    shelf.className = 'room-subject-grid';
    shelf.setAttribute('role', 'group');
    shelf.setAttribute('aria-label', 'Subject notes and practice');
    if (sectionLabel) legacy.prepend(sectionLabel);
    legacy.insertBefore(shelf, sectionLabel?.nextSibling || legacy.firstChild);
    legacy.querySelectorAll('.study-accordion').forEach(card => shelf.append(card));
    // Parent summaries stay available, after the child's subject choices.
    const gameLink = legacy.querySelector('.study-games-cta');
    if (gameLink) shelf.after(gameLink);
  }
  if (sectionLabel) {
    const heading = sectionLabel.querySelector('p');
    const caption = sectionLabel.querySelector('span');
    if (heading) heading.textContent = 'Explore a subject';
    if (caption) caption.textContent = 'Tap a card to open your notes.';
  }
  screen.querySelectorAll('.study-accordion').forEach(card => {
    const summary = card.querySelector(':scope > summary');
    if (!summary || summary.querySelector('.room-subject-icon')) return;
    const [icon, tone] = subjects[card.id] || ['book', 'blue'];
    card.dataset.roomTone = tone;
    const badge = doc.createElement('span');
    badge.className = 'room-subject-icon';
    badge.setAttribute('aria-hidden', 'true');
    badge.innerHTML = roomIcon(icon);
    summary.prepend(badge);
  });
  let disposed = false, focusToken = null, spokenQuestion = '';
  const readAloud = createReadAloud(win);
  const stopReading = readAloud.stop;
  // Remember keyboard origin before the controller replaces the host tree.
  const rememberFocus = event => {
    const button = event.target?.closest?.('button');
    if (!button || !host.contains(button)) return;
    if (button.matches('[data-end],[data-tab],[data-next]')) stopReading();
    if (event.detail !== 0) return;
    if (button.hasAttribute('data-tab')) focusToken = ['data-tab', button.dataset.tab];
    else if (button.hasAttribute('data-hint')) focusToken = ['data-hint', ''];
  };
  host.addEventListener('click', rememberFocus, true);
  function refresh() {
    if (disposed || !host.isConnected) return;
    const hub = host.querySelector('.study-hub');
    if (!hub) return;
    const active = hub.querySelector('.hub-tabs [aria-pressed="true"]')?.dataset.tab || 'weekly';
    const inRound = !!hub.querySelector('.hub-round,.hub-finish');
    screen.classList.toggle('room-is-practicing', inRound);
    if (daily) daily.hidden = active !== 'weekly' || inRound;
    const nav = hub.querySelector('.hub-tabs');
    if (nav) {
      nav.hidden = inRound;
      [...nav.children].forEach((node, index) => {
        const key = node.dataset.tab || destinationKeys[index];
        if (!Object.hasOwn(destinations, key) || node.dataset.roomDecorated) return;
        node.dataset.roomDecorated = 'true';
        node.dataset.roomTone = destinations[key].tone;
        node.innerHTML = destinationMarkup(key);
      });
    }
    const options = hub.querySelector('[data-complete-test]');
    if (options && !options.closest('.room-test-options')) {
      const drawer = doc.createElement('details');
      drawer.className = 'room-test-options';
      const summary = doc.createElement('summary');
      summary.textContent = 'Grown-up test options';
      drawer.append(summary);
      options.before(drawer);
      drawer.append(options);
    }
    const round = hub.querySelector('.hub-round');
    if (round) {
      const question = round.querySelector('h3');
      if (question?.textContent !== spokenQuestion) stopReading();
      spokenQuestion = question?.textContent || '';
      if (question && readAloud.supported && !round.querySelector('.room-listen')) {
        const read = doc.createElement('button');
        read.type = 'button';
        read.className = 'room-listen';
        read.innerHTML = roomIcon('sound') + '<span>Read to me</span>';
        read.onclick = () => {
          if (disposed || !round.isConnected) return;
          const choices = [...round.querySelectorAll('[data-answer]')].map(x => x.textContent.trim());
          readAloud.read([question.textContent || '', ...choices].join('. '));
        };
        question.before(read);
      }
      const feedback = round.querySelector('.hub-feedback');
      if (feedback && !feedback.querySelector('.room-feedback-title')) {
        const title = doc.createElement('p');
        title.className = 'room-feedback-title';
        title.textContent = feedback.classList.contains('hub-feedback-learn') ? 'Let’s learn this one together.' :
          feedback.classList.contains('hub-feedback-correct') ? 'You’ve got it!' : 'Turn a little practice into learning.';
        feedback.prepend(title);
        feedback.tabIndex = -1;
      }
    } else stopReading();
    if (focusToken) {
      const [attr, value] = focusToken;
      const target = [...hub.querySelectorAll('[' + attr + ']')]
        .find(el => el.getAttribute(attr) === value);
      target?.focus({ preventScroll: true });
      focusToken = null;
    }
  }
  // Observe only controller root replacements, not our decoration, avoiding an
  // observer/render feedback loop and preserving the controller's own listeners.
  const observer = new win.MutationObserver(refresh);
  observer.observe(host, { childList: true });
  const lifetime = new win.MutationObserver(() => { if (!host.isConnected) dispose(); });
  lifetime.observe(doc.body, { childList: true, subtree: true });
  function dispose() {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    lifetime.disconnect();
    host.removeEventListener('click', rememberFocus, true);
    focusToken = null;
    readAloud.dispose();
  }
  refresh();
  return { refresh, dispose };
}
