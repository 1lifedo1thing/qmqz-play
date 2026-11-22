// Unity 4 ResourceManager keys and Audio, Map and BioProperty rows from the local APK.
(() => {
  const base = "StreamingAssets/audio/";
  const banks = new Map(), decoded = new Map(), playing = new Set();
  const worldVoices = new Set();
  const buses = {};
  const levels = {};
  for (const channel of ["music", "effects"]) {
    const saved = Number(localStorage.getItem("QMQZ.volume." + channel) ?? 1);
    levels[channel] = Number.isFinite(saved) ? Math.min(1, Math.max(0, saved)) : 1;
  }
  window.qmqzVolume = {
    get: channel => levels[channel],
    set(channel, value) {
      if (!Object.hasOwn(levels, channel) || !Number.isFinite(value)) return;
      levels[channel] = Math.max(0, Math.min(1, value));
      if (buses[channel]) buses[channel].gain.value = levels[channel];
      localStorage.setItem("QMQZ.volume." + channel, String(levels[channel]));
    }
  };
  let context, resuming, catalog, map = 0, generation = 0, lastStep = -Infinity;
  let inLobby = false, lobbyVisit = 0, lobbyStarted = false, lobbyVoice;
  let previousAnnouncement = Promise.resolve();
  const scheduledVoices = new Map(), streaks = new Set();
  function resetStreak(owner) {
    for (const voice of streaks) {
      if (owner >= 0 && voice.owner !== owner) continue;
      voice.cancel();
      if (voice.source) {
        scheduledVoices.delete(voice.source);
        voice.source.stop();
      }
      streaks.delete(voice);
    }
    window.dispatchEvent(new CustomEvent("qmqz-streak-reset",{detail:owner}));
  }
  const awaitingGesture = new Set();
  function wakePending() {
    for (const wake of awaitingGesture) wake();
    awaitingGesture.clear();
  }

  function startLobby() {
    if (!inLobby || lobbyStarted || context?.state !== "running") return;
    lobbyStarted = true;
    // MainUIBGMusic.Awake and OnSyncFreshStatus select GreenPart for the APK's completed lobby guide.
    play("lobby", 1111, "", 1, 0).catch(error => { lobbyStarted = false; console.warn(error); });
  }
  window.addEventListener("qmqz-state", ({detail}) => {
    const active = detail?.screen === "MainUI" && detail.mode !== "match";
    if (active === inLobby) return;
    inLobby = active;
    lobbyVisit++;
    lobbyStarted = false;
    if (lobbyVoice) { lobbyVoice.stop(); lobbyVoice = null; }
    startLobby();
  });

  function unlock() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!context) {
      context = new Audio();
      for (const channel of Object.keys(levels)) {
        const bus = buses[channel] = context.createGain();
        bus.gain.value = levels[channel];
        bus.connect(context.destination);
      }
    }
    const ready = () => { if (context.state === "running") { wakePending(); startLobby(); } };
    if (context.state === "suspended" || context.state === "interrupted")
      resuming ||= context.resume().then(ready).catch(() => {}).finally(() => { resuming = null; });
    else ready();
  }
  for (const event of ["pointerdown","touchend","keydown"]) window.addEventListener(event, unlock, {capture:true, passive:true});

  async function resource(url, format) {
    const response = await fetch(base + url);
    if (!response.ok) throw new Error("Audio: " + url);
    return response[format]();
  }
  function index() {
    return catalog ||= resource("index.json","json").catch(error => { catalog = null; throw error; });
  }
  function recent(cache, key, limit, load) {
    const value = cache.get(key) || load().catch(error => {
      if (cache.get(key) === value) cache.delete(key);
      throw error;
    });
    cache.delete(key);
    cache.set(key, value);
    if (cache.size > limit) cache.delete(cache.keys().next().value);
    return value;
  }
  function stop() {
    generation++;
    wakePending();
    previousAnnouncement = Promise.resolve();
    resetStreak(-1);
    scheduledVoices.clear();
    map = 0;
    lastStep = -Infinity;
    for (const source of playing) source.stop();
    playing.clear();
    worldVoices.clear();
  }
  async function play(action, id, path, volume, pan, previous, streak) {
    if (action === "stop") { stop(); return; }
    if (action === "map") { stop(); map = id; }
    const version = generation, visit = lobbyVisit;
    const stale = () => action === "lobby" ? !inLobby || visit !== lobbyVisit :
      generation !== version || (streak && !streaks.has(streak));
    if (resuming && action === "clip") {
      await resuming;
      if (stale()) return;
    }
    if (context?.state !== "running") {
      if (!["map","announce","event","prepare"].includes(action) || !(window.AudioContext || window.webkitAudioContext)) return;
      await new Promise(resolve => awaitingGesture.add(resolve));
      if (stale() || context?.state !== "running") return;
    }
    const library = await index();
    if (stale()) return;
    const row = action === "map" ? library.events[library.maps[map]?.[0]] :
      action === "step" ? library.events[library.maps[map]?.[1]] :
      action === "zombie" ? library.events[library.zombies[id]?.[path]] :
      action === "event" || action === "lobby" ? library.events[id] : null;
    if (action === "step") {
      if (!row || context.currentTime - lastStep < row.gap) return;
      lastStep = context.currentTime;
    }
    const spatial = action === "world";
    const key = row?.key || (["clip","announce","prepare"].includes(action) || spatial ? path.toLowerCase() : "");
    const entry = library.clips[key];
    const foley = key.startsWith("foley/");
    if (!entry && !foley) return;
    const buffer = await recent(decoded, key, 24, async () => {
      if (foley) return context.decodeAudioData(await resource(key + ".wav", "arrayBuffer"));
      const [bank, offset, size] = entry;
      const bytes = await recent(banks, bank, 3, () => resource(bank + ".bank","arrayBuffer"));
      return context.decodeAudioData(bytes.slice(offset, offset + size));
    });
    if (action === "prepare") return;
    if (previous) await previous;
    if (stale() || (spatial && worldVoices.size >= 14)) return;
    const source = context.createBufferSource(), gain = context.createGain();
    source.buffer = buffer;
    gain.gain.value = volume * (row?.volume ?? 1);
    const panner = spatial && context.createStereoPanner ? context.createStereoPanner() : null;
    source.connect(gain);
    const bus = key.startsWith("sound/bgm/") ? buses.music : buses.effects;
    if (panner) { panner.pan.value = pan; gain.connect(panner).connect(bus); }
    else gain.connect(bus);
    if (spatial) worldVoices.add(source);
    source.onended = () => {
      playing.delete(source); worldVoices.delete(source); scheduledVoices.delete(source);
      if (streak) streaks.delete(streak);
      source.disconnect(); gain.disconnect(); panner?.disconnect();
    };
    if (action === "lobby") {
      source.loop = Boolean(row.loop);
      lobbyVoice = source;
    } else playing.add(source);
    let when = context.currentTime + (row?.delay || 0);
    if (previous && key.startsWith("sound/voice/")) {
      for (const end of scheduledVoices.values()) when = Math.max(when,end);
      scheduledVoices.set(source,when+buffer.duration);
    }
    if (streak) streak.source=source;
    source.start(when);
  }
  window.qmqzAudio = (action, id = 0, path = "", volume = 1, pan = 0) => {
    if (action === "reset-streak") { resetStreak(id); return; }
    // Cold decoding may finish out of order. Keep the original dispatch order for announcements,
    // while shots, footsteps and impacts keep their independent playback timing.
    const ordered = action === "announce" || (action === "event" && id >= 1204 && id <= 1206);
    const previous = ordered ? previousAnnouncement : null;
    const streak = action==="announce" && /\/m_en_killcount_kill\d+$/i.test(path) ? {owner:id} : null;
    let cancelled;
    if (streak) {
      cancelled=new Promise(resolve=>{streak.cancel=resolve;});
      streaks.add(streak);
    }
    const started = play(action, id, path, volume, pan, previous, streak).catch(error => console.warn(error));
    if (streak) started.then(()=>{if(!streak.source)streaks.delete(streak);});
    if (ordered) previousAnnouncement = Promise.all([previous,streak ? Promise.race([started,cancelled]) : started]).then(() => {});
    return started;
  };
})();
