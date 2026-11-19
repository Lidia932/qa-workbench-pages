(() => {
  const prefix = 'roistat-qa.music.';
  const channel = new BroadcastChannel(prefix + 'status');
  const controls = document.createElement('div');
  controls.className = 'music-controls';
  controls.innerHTML = `
    <button type="button" class="music-toggle" aria-label="Фоновая музыка" aria-pressed="false">
      <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9h4l5-4v14l-5-4H3z"/>
        <path class="waves" d="M16 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>
        <path class="mute" d="m16 9 5 6m0-6-5 6"/></svg>
    </button>
    <input type="range" min="0" max="100" aria-label="Громкость музыки">
    <span class="music-notice" role="status"></span>`;
  const button = controls.querySelector('button');
  const volume = controls.querySelector('input');
  const notice = controls.querySelector('[role=status]');
  const audio = new Audio();
  audio.loop = true;
  audio.preload = 'none';
  let request = null;
  let ownsPlayer = false;
  let playing = false;
  let waitingForGesture = false;
  let lastCheckpoint = 0;

  function read(name) {
    try { return localStorage.getItem(prefix + name); } catch { return null; }
  }
  function write(name, value) {
    try { localStorage.setItem(prefix + name, value); return true; }
    catch { notice.textContent = 'Для управления музыкой разрешите локальное хранилище сайта.'; return false; }
  }
  function showPlaying(value) {
    playing = value;
    const enabled = read('enabled') === 'yes';
    button.setAttribute('aria-pressed', String(enabled));
    button.title = enabled ? 'Выключить музыку' : 'Включить музыку';
    if (value) waitingForGesture = false;
    if (value) notice.textContent = '';
  }
  function announce(value) {
    showPlaying(value);
    channel.postMessage(value ? 'playing' : 'paused');
  }
  function updateVolume() {
    const stored = read('volume');
    volume.value = stored ?? '25';
    audio.volume = Number(volume.value) / 100;
    volume.title = 'Громкость: ' + volume.value + '%';
    volume.setAttribute('aria-valuetext', volume.value + '%');
  }
  function savePosition() {
    if (ownsPlayer && audio.readyState && Number.isFinite(audio.currentTime)) {
      write('position', String(audio.currentTime));
      lastCheckpoint = performance.now();
    }
  }
  function stop() {
    waitingForGesture = false;
    if (ownsPlayer) {
      savePosition();
      audio.pause();
      announce(false);
    }
    request?.abort();
    request = null;
    showPlaying(false);
    notice.textContent = '';
  }

  // Keep one exclusive lock for the entire playback. Waiting tabs take over on close or navigation.
  function join() {
    if (request || !navigator.locks || read('enabled') !== 'yes') return;
    const controller = new AbortController();
    request = controller;
    const {signal} = controller;
    const stopped = new Promise(resolve => signal.addEventListener('abort', resolve, {once: true}));
    navigator.locks.request(prefix + 'player', {signal}, async () => {
      if (signal.aborted || read('enabled') !== 'yes') return;
      ownsPlayer = true;
      try {
        if (!audio.src) audio.src = './background.mp3';
        updateVolume();
        audio.currentTime = Number(read('position')) || 0;
        await audio.play();
        if (signal.aborted) return;
        announce(true);
        await stopped;
      } finally {
        ownsPlayer = false;
        audio.pause();
      }
    }).catch(error => {
      if (signal.aborted) return;
      waitingForGesture = error.name === 'NotAllowedError';
      announce(false);
      notice.textContent = waitingForGesture
        ? 'Музыка продолжится при первом действии на странице.'
        : 'Не удалось воспроизвести музыку. Выключите и снова включите её.';
    }).finally(() => { if (request === controller) request = null; });
  }
  channel.onmessage = ({data}) => {
    if (data === 'status' && ownsPlayer && !audio.paused) channel.postMessage('playing');
    if (data === 'playing' && read('enabled') === 'yes') { showPlaying(true); join(); }
    if (data === 'paused' && !ownsPlayer) {
      showPlaying(false);
      channel.postMessage('status');
    }
  };
  button.onclick = () => {
    if (read('enabled') === 'yes') {
      if (write('enabled', 'no')) stop();
    } else if (write('enabled', 'yes')) {
      notice.textContent = '';
      showPlaying(false);
      join();
    }
  };
  function resumeAfterGesture(event) {
    if (!waitingForGesture || !event.isTrusted || button.contains(event.target) || !navigator.userActivation.isActive) return;
    join();
  }
  document.addEventListener('click', resumeAfterGesture, {capture: true});
  document.addEventListener('keydown', resumeAfterGesture, {capture: true});
  volume.oninput = () => {
    if (write('volume', volume.value)) updateVolume();
  };
  window.addEventListener('storage', ({key}) => {
    if (key === prefix + 'volume' || key === null) updateVolume();
    if (key === prefix + 'enabled' || key === null) {
      if (read('enabled') !== 'yes') stop();
      else showPlaying(playing);
    }
  });
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', () => {
    showPlaying(playing);
    updateVolume();
    channel.postMessage('status');
    join();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) savePosition(); });
  audio.addEventListener('timeupdate', () => {
    if (ownsPlayer && !audio.paused && performance.now() - lastCheckpoint >= 5000) savePosition();
  });
  audio.addEventListener('error', () => {
    if (ownsPlayer && playing) { stop(); notice.textContent = 'Не удалось продолжить воспроизведение.'; }
  });
  showPlaying(false);
  if (!navigator.locks) {
    button.disabled = true;
    button.title = 'Для фоновой музыки откройте сайт в браузере с поддержкой Web Locks.';
  }
  updateVolume();
  document.addEventListener('DOMContentLoaded', () => document.querySelector('.brand').append(controls));
})();
