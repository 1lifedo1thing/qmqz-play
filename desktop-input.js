/* Keyboard and relative mouse input for the Web player. Menus keep the system cursor. */
window.createDesktopControls = function (canvas, send, redraw) {
  "use strict";
  const keys = new Set();
  const walking = new Set(["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);
  const actions = {Digit1:"weapon:11", Digit2:"weapon:12", Digit3:"weapon:50", Digit4:"weapon:41",
    KeyQ:"previous-weapon", KeyR:"reload", KeyB:"toggle-ammo", KeyC:"crouch", Space:"jump", KeyV:"melee", KeyF:"ability"};
  let desktop = matchMedia("(hover:hover) and (pointer:fine)").matches;
  let enabled = false, firing = false, aiming = false, using = "", dx = 0, dy = 0, frame = 0;
  let pendingLock = false, lastWheel = -Infinity, state = {};
  const locked = () => document.pointerLockElement === canvas;
  const hint = document.createElement("span");
  hint.id = "desktop-capture-hint";
  hint.textContent = "点击画面控制鼠标 · Esc 释放";
  canvas.after(hint);

  function updateHint() {
    const picking=state.mode==="match" && state.selectionWindow==="EquipWindow";
    if(picking)hint.textContent="数字键或滚轮选择背包 · Enter 进入";
    else if(hint.textContent.startsWith("数字键"))hint.textContent="点击画面控制鼠标 · Esc 释放";
    hint.hidden = !desktop || (!enabled && !picking) || locked();
    canvas.dataset.inputMode = desktop ? "desktop" : "touch";
  }
  function lockFailed() {
    pendingLock = false;
    hint.textContent = "请聚焦游戏窗口并允许锁定鼠标，再点击画面";
    updateHint();
  }
  function device(value) {
    if (desktop === value) return;
    desktop = value;
    updateHint();
    redraw();
  }
  function stop() {
    if (keys.size) send("move:0,0");
    if (firing) send("fireUp");
    if (aiming) send("mouse-aim-off");
    if (using) send(using + "-up");
    keys.clear();
    firing = aiming = false;
    using = "";
    dx = dy = 0;
    cancelAnimationFrame(frame);
    frame = 0;
  }
  function unlock() {
    stop();
    if (locked()) document.exitPointerLock();
  }
  function requestControl() {
    if (!enabled || !desktop || pendingLock || locked()) return;
    canvas.focus({preventScroll:true});
    pendingLock = true;
    try { canvas.requestPointerLock()?.catch(lockFailed); }
    catch { lockFailed(); }
  }
  function update(next, modal) {
    state = next;
    const wasEnabled = enabled;
    enabled = state.mode === "match" && state.alive && !state.selectionWindow && !modal &&
      state.phase !== "RoundOver" && state.phase !== "MatchOver";
    if (wasEnabled && !enabled) stop();
    const needsCursor = state.mode !== "match" || state.selectionWindow || modal ||
      state.phase === "MatchOver" || (state.gameMode === 12 && !state.alive);
    if (needsCursor && locked()) unlock();
    updateHint();
  }
  function handled(e) { e.preventDefault(); e.stopImmediatePropagation(); }
  function pointer(e) {
    if (e.pointerType !== "mouse") {
      if (e.type === "pointerdown" && e.target === canvas) { device(false); canvas.focus({preventScroll:true}); if (locked()) unlock(); }
      return;
    }
    if (!enabled || (!locked() && e.target !== canvas)) return;
    if (e.type === "pointerdown") {
      if (e.button !== 0 && e.button !== 2) return;
      device(true);
      handled(e);
      if (!locked()) {
        if (e.button === 0) requestControl();
        return;
      }
      if (e.button === 0 && !firing) { firing = true; send("fireDown"); }
      if (e.button === 2 && !aiming && (state.weaponSlot===11 || state.weaponSlot===12)) {
        aiming = true; send("mouse-aim-on");
      }
    } else if (locked()) {
      if (e.button === 0 && firing) { firing = false; send("fireUp"); }
      if (e.button === 2 && aiming) { aiming = false; send("mouse-aim-off"); }
      handled(e);
    }
  }
  function move(e) {
    if (!enabled || !locked()) return;
    dx += e.movementX;
    dy += e.movementY;
    if (!frame) frame = requestAnimationFrame(() => {
      frame = 0;
      if (dx || dy) send("mouse-look:" + dx.toFixed(2) + "," + dy.toFixed(2));
      dx = dy = 0;
    });
  }
  function movement() {
    const held = (a,b) => keys.has(a) || keys.has(b);
    const x = Number(held("KeyD","ArrowRight")) - Number(held("KeyA","ArrowLeft"));
    const y = Number(held("KeyW","ArrowUp")) - Number(held("KeyS","ArrowDown"));
    send("move:" + x + "," + y);
  }
  function key(e) {
    if (!enabled || e.altKey || e.metaKey || e.ctrlKey) return;
    if(!locked() && (desktop || e.code!=="KeyB" || document.activeElement!==canvas))return;
    if (!walking.has(e.code) && !actions[e.code] && e.code !== "KeyE") return;
    handled(e);
    if (e.repeat) return;
    if (walking.has(e.code)) {
      if (e.type === "keydown") keys.add(e.code); else keys.delete(e.code);
      movement();
    } else if (e.code === "KeyE") {
      if (e.type === "keydown" && !using) {
        using = state.canRefill ? "refill" : "objective";
        send(using + "-down");
      } else if (e.type === "keyup" && using) { send(using + "-up"); using = ""; }
    } else if (e.type === "keydown") send(actions[e.code]);
  }
  window.addEventListener("pointerdown", pointer, {capture:true, passive:false});
  window.addEventListener("pointerup", pointer, {capture:true, passive:false});
  window.addEventListener("mousemove", move, true);
  window.addEventListener("keydown", key, true);
  window.addEventListener("keyup", key, true);
  window.addEventListener("wheel", e => {
    if (!enabled || !locked() || !e.deltaY) return;
    handled(e);
    const time = performance.now();
    if (time - lastWheel >= 100) send(e.deltaY > 0 ? "cycle-next" : "cycle-prev");
    lastWheel = time;
  }, {capture:true, passive:false});
  canvas.addEventListener("contextmenu", e => { if (enabled && desktop) e.preventDefault(); });
  document.addEventListener("pointerlockchange", () => {
    pendingLock = false;
    if (!locked()) stop(); else if (!enabled) unlock();
    else hint.textContent = "点击画面控制鼠标 · Esc 释放";
    updateHint();
  });
  document.addEventListener("pointerlockerror", lockFailed);
  window.addEventListener("blur", unlock);
  document.addEventListener("visibilitychange", () => { if (document.hidden) unlock(); });
  updateHint();
  return {update, requestControl, get desktop() { return desktop; }};
};
