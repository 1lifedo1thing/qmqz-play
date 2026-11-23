/* Replays the recovered fightPreload NGUI widgets over the Unity canvas. */
(() => {
  "use strict";
  const settings = "windows/OperationWindow/Settings/";
  const equipWindow = "windows/EquipWindow";
  const bagPage = equipWindow+"/Center/EquipCarousel/BattleEquipCarouselItem";
  const portraitPanel = equipWindow+"/Left/RoleSelect/RoleSelectItem";
  const portraitPath = portraitPanel+"/CurentRole";
  const zombieWindow = "windows/ZombieSelect";
  const deathWindow = "windows/DeathWindow";
  const challengeDeath = deathWindow + "/PvE";
  const spectatorPanel = deathWindow + "/PvP";
  const spectatorInfo = spectatorPanel + "/PlayerBoard/PlayerInfo";
  const spectating = () => !state.alive && state.spectatorSlot >= 0;
  const gridPath = zombieWindow + "/Center/Zombies/Grid";
  const modeBoards = {4:"PersonalScoreBoard", 6:"CaptureScoreBoard", 8:"BioScoreBoard", 10:"TerminatorScoreBoard", 12:"ChallengeScoreBoard"};
  const modeId = () => state.range ? 1 : state.gameMode || state.room?.gameMode || 8;
  const bioLevelBar = "States/TopPanel/TopRight/Biolevel";
  const protectionBar = "BattlePanel/Panel/Super armor";
  const healForeground = settings + "AC_HP/Heal/Slider/Foreground";
  let healRemaining = null, healFrame = 0;
  let protectionDuration=0;
  let bioTwinkle = -Infinity;
  const boardName = () => modeBoards[modeId()] || "StandardScoreBoard";
  const selecting = () => !!state.selectionWindow;
  const gunPanel = settings+"Weapon/Gun/GunPanel";
  const panelSlots = {Weapon_1_Dagger:50, Weapon_2_Special:42, Weapon_3_Grenade:41, Weapon_4_Vice:12, Weapon_5_Main:11};
  const equipment = () => state.profile?.equipment;
  const activeTab = () => equipment()?.activeindex ?? 0;
  const loadout = index => equipment()?.loadouts?.[index];
  const itemAt = (index,pos) => {
    const slot=loadout(index)?.slots?.find(slot=>slot.position===pos);
    return slot?.itemId || slot?.effectiveItemId;
  };
  const playerRole = () => state.fighters?.[0]?.roleId || (state.side==="terrorist" ? equipment()?.terristactorid : equipment()?.policeactorid) || 101;
  function equipSlot(path) {
    const match=path.match(/BattleEquipCarouselItem(~1)?\/ItemSlot([01])(?:\/|$)/);
    return match ? (match[1] && bagSlide ? bagSlide.to : carouselPage)*2+Number(match[2]) : -1;
  }
  function pickerItem(path,index) {
    const picker=path.match(/^(.+\/ItemSlot[01]\/(?:Armor|Weapon)(?:~\d+)?)(?:\/|$)/);
    return picker && itemAt(index,layout.nodes[picker[1]].equipPosition);
  }
  const clockText = number => {
    const sec = Math.max(0, Math.ceil(number || 0));
    return String(Math.floor(sec/60)).padStart(2,"0")+":"+String(sec%60).padStart(2,"0");
  };
  const scoreboardHost = "States/TopPanel/Top/ScoreBoard";
  const rocker = "Controlls/Rocker/Rocker";
  const trigger = "Controlls/Trigger/Trigger";
  const entries = new Map([
    [settings + "Operation/Pose", "Pose"], [settings + "Operation/Jump", "Jump"],
    [settings+"Operation/Grenade","Grenade"], [settings+"Operation/Flash","Flash"], [settings + "Operation/Sight","Sight"], [settings+"Operation/CloseSight","Telescope"], [settings+"Operation/Switch","Switch"],
    [settings + "Ammo", "Reload"], [settings + "Bullet", "Bullet"], [settings + "Weapon", "Weapon"],
    [settings + "AC_HP", "Intro"], [settings + "Skill", "Switch"], [rocker, "Rocker"], [trigger, "Trigger"]
  ]);
  const buttonActions = new Map([
    [settings+"Weapon/Weapon","gun-panel"], [settings+"Operation/Switch/Switch","previous-weapon"],
    [settings+"Operation/Sight/Sight","sight-on"], [settings+"Operation/CloseSight/CloseSight","sight-off"],
    ...Object.entries(panelSlots).map(([name,pos])=>[gunPanel+"/Panel/"+name,"weapon:"+pos]),
    [settings + "Ammo/Ammo", "reload"],[settings+"Bullet/Bullet","toggle-ammo"], [settings + "Operation/Jump/Jump", "jump"],
    [equipWindow + "/Left/EnterButton","enter"], [zombieWindow + "/Center/Start","enter"],
    [equipWindow + "/Left/LeftArrow","actor-step:-1"],[equipWindow + "/Left/RightArrow","actor-step:1"],
    ["BombPanel/Mine","objective"], ["BombPanel/Demine","objective"],
    ["BombPanel/Supply","refill"], [challengeDeath+"/Reborn","revive"],
    [spectatorPanel+"/Back","spectate-prev"],[spectatorPanel+"/Forward","spectate-next"],
    [settings + "Skill/Skill", "ability"], ["States/TopLeft/PauseButton", "options"],
    ["States/Options/Toolbar/Option","fight-settings"],
    ["States/Options/Toolbar/Close", "resume"], ["States/Options/Toolbar/QuitButton", "quitDialog"],
    ["Dialog/QuitWarning/Confirm", "leave"], ["Dialog/QuitWarning/Cancel", "cancelQuit"]
  ]);
  const parent = path => path.substring(0, path.lastIndexOf("/"));
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const images = new Map();
  const equipmentArt=new Map();
  let equipmentItems=new Map();
  const tintedImages = new Map();
  const touches = new Map();
  let triggerPrimed=false;
  let layout, overlay, allyCanvas, allyContext, unity, ctx, observer, drawFrame, pending;
  let allyInk=false;
  let state = {}, modal = "", carouselPage=0, gunOpen=false, hitBoxes = [], geometry = new Map();
  let width = 0, height = 0, scale = 1;
  let desktopControls, ammoNotice, noticeTimer;
  let throwButtons={};
  const throwIcons=new Map([
    [settings+"Operation/Grenade/Grenade/Icon","手雷"],
    [settings+"Operation/Flash/Flash/Icon","闪光"]
  ]);
  const combatFeedback=window.createCombatFeedback(refresh);
  let roleSlide=null, bagSlide=null;
  const portraitRole = path => roleSlide ? (path===portraitPath+"0" ? roleSlide.from : roleSlide.to) : playerRole();

  async function loadSprites(data) {
    const files = new Set(["feedback-sketches", ...Object.keys(data.images), ...Object.values(data.dynamic).map(name => name.split("/").pop())]);
    const hd=window.qmqzUiDensity.media.matches;
    const loaded=await Promise.all([...files].map(async key =>
      [key, await window.qmqzUiDensity.load("hud/sprites/" + encodeURIComponent(key) + ".png")]));
    if(hd!==window.qmqzUiDensity.media.matches) return loadSprites(data);
    for(const [key,image] of loaded) images.set(key,image);
    tintedImages.clear();
  }
  async function readLayout() {
    const [response,inventory]=await Promise.all([fetch("hud/layout.json"),fetch("original-ui/inventory.json")]);
    if (!response.ok) throw Error("hud/layout.json " + response.status);
    if (!inventory.ok) throw Error("original-ui/inventory.json "+inventory.status);
    equipmentItems=new Map((await inventory.json()).items.map(item=>[item.id,item]));
    const data = await response.json();
    await Promise.all([loadSprites(data),window.qmqzFonts.load()]);
    const grid = data.nodes[gridPath].grid;
    const template = Object.entries(data.nodes).filter(([path])=>path==="Zombie" || path.startsWith("Zombie/"));
    data.roleCards.forEach((role, i) => {
      const root = gridPath + "/Role" + role.id;
      for (const [path,original] of template) {
        const instance = {...original, role:role.id};
        if (path==="Zombie") instance.xy = [(i%grid.maxPerLine)*grid.cellWidth,-Math.floor(i/grid.maxPerLine)*grid.cellHeight];
        data.nodes[root+path.slice("Zombie".length)] = instance;
      }
      buttonActions.set(root, "role:" + role.id);
    });
    layout = data;
    combatFeedback.setup(data,images.get("feedback-sketches"));
    refresh();
  }

  function create() {
    if (overlay) return;
    unity = document.querySelector("#unity-canvas");
    if (!unity) return;
    // Unity 4 PlayerSettings specifies 1136 × 640 and supports the 16:9 game viewport.
    // On portrait phones the world and the NGUI projection share a single landscape frame.
    const stylesheet=document.createElement("style");
    stylesheet.textContent="@media (orientation:portrait){main[data-qmqz-match]{width:100%;height:auto;aspect-ratio:16/9;position:absolute;left:0;top:50%;transform:translateY(-50%)} main[data-qmqz-match]>#unity-canvas{position:absolute;inset:0}}";
    document.head.appendChild(stylesheet);
    overlay = document.createElement("canvas");
    overlay.id = "original-hud";
    overlay.setAttribute("aria-label", "全民枪战战斗界面");
    Object.assign(overlay.style, {position:"absolute", inset:"0", width:"100%", height:"100%", pointerEvents:"none"});
    allyCanvas=document.createElement("canvas");
    allyCanvas.id="original-ally-names";
    allyCanvas.setAttribute("aria-hidden","true");
    allyCanvas.style.cssText=overlay.style.cssText;
    allyCanvas.hidden=true;
    allyContext=allyCanvas.getContext("2d");
    unity.parentElement.append(allyCanvas,overlay);
    overlay.hidden = true;
    ammoNotice=document.createElement("span");
    ammoNotice.setAttribute("role","status");
    ammoNotice.style.cssText="position:absolute;bottom:24%;left:50%;transform:translateX(-50%);color:white;background:#161616cc;padding:.35em .7em;pointer-events:none;font:14px OriginalMYH,sans-serif;white-space:nowrap";
    ammoNotice.hidden=true;
    unity.after(ammoNotice);
    ctx = overlay.getContext("2d");
    desktopControls = window.createDesktopControls(unity,send,refresh,e=>{
      const point=position(e);
      return hitBoxes.some(b=>Math.abs(point.x-b.x)<=b.w/2 && Math.abs(point.y-b.y)<=b.h/2);
    });
    observer = new ResizeObserver(()=>{if(touches.size)clearInput();refresh();});
    observer.observe(unity);
    for (const type of ["pointerdown","pointermove","pointerup","pointercancel"]) {
      window.addEventListener(type, input, {capture:true, passive:false});
    }
    window.addEventListener("blur", clearInput);
    document.addEventListener("visibilitychange", () => { if (document.hidden) clearInput(); });
    window.addEventListener("keydown", keys, true);
    unity.addEventListener("wheel",e=>{
      if(modal || state.selectionWindow!=="EquipWindow" || !e.deltaY)return;
      e.preventDefault();
      selectBag(activeTab()+Math.sign(e.deltaY));
    },{passive:false});
  }

  function refresh() {
    if (!drawFrame) drawFrame = requestAnimationFrame(() => { drawFrame = 0; render(); });
  }

  function playerRow(path) {
    const match = path.match(/ScorePanel\/Table\/(Left|Right)\/PlayerCard(\d+)/);
    return match ? state.fighters?.[(match[1] === "Right" ? 4 : 0) + Number(match[2])] : null;
  }

  function display(path, n) {
    const feedbackVisible=combatFeedback.visible(path);
    if (feedbackVisible!==undefined) return feedbackVisible;
    const infected = state.side === "infected";
    if(path===bioLevelBar)return [8,10].includes(modeId()) && !!state.side;
    if(path===bioLevelBar+"/Human")return !infected;
    if(path===bioLevelBar+"/Zombie")return infected;
    if(path===settings+"Bullet/Bullet/IconEnhance" || path===settings+"Bullet/Effect")return !!state.enhancedAmmoSelected;
    if (desktopControls?.desktop && (path==="Controlls" || path===settings+"Operation")) return false;
    if (path === "Zombie") return false;
    if (path==="States/TopPanel/Top/Star") return !!state.range;
    if (path==="RangePanel") return !!state.range && !!state.rangeEndReason;
    if (path.startsWith("RangePanel/")) return path===["","RangePanel/NoAmmo","RangePanel/NoEnergy","RangePanel/Timeup"][state.rangeEndReason];
    if (layout.boards.includes(path)) return path === boardName();
    if (path === zombieWindow) return /ZombieSelect/.test(state.selectionWindow || "");
    if (path === equipWindow) return state.selectionWindow === "EquipWindow";
    if (path === equipWindow + "/Left/LeftArrow" || path === equipWindow + "/Left/RightArrow") return state.humanActorChoices?.length>1;
    if (path===portraitPath+"1") return !!roleSlide;
    if (path === zombieWindow + "/Center/Zombies/Highlight") return false;
    if (path===bagPage+"~1") return !!bagSlide;
    const tab=equipSlot(path);
    if (tab>=0) {
      if (!loadout(tab) && (tab!==0 || equipment())) return false;
      if (path.endsWith("/Highlight")) return tab===activeTab();
      if (path.endsWith("/Score")) return Number.isFinite(loadout(tab)?.star);
      if (/\/(Armor|Weapon)(~\d+)?\/Icon$/.test(path)) return !pickerItem(path,tab);
      if (path.endsWith("/MainWeapon")) return !!pickerItem(path,tab);
      if (path.endsWith("/Durable")) return false;
    }
    if (path===gunPanel) return gunOpen;
    if (path.startsWith(gunPanel+"/Panel/")) {
      const slot=panelSlots[path.split("/")[7]];
      if (slot && (!itemAt(activeTab(),slot) || slot===42 && !state.canFlash)) return false;
    }
    if (selecting() && !path.startsWith("windows") && !path.startsWith("Zombie")) return false;
    if (path===deathWindow) return !state.alive && !modal && !selecting() && state.phase==="Active";
    if (path===challengeDeath) return modeId()===12;
    if (path===spectatorPanel) return spectating() || (modeId()!==12 && state.spectatorRespawnSeconds>=0);
    if (path===spectatorPanel+"/Back" || path===spectatorPanel+"/Forward") return spectating() && state.spectatorCanCycle;
    if (path===spectatorPanel+"/RebornTime") return modeId()!==12 && state.spectatorRespawnSeconds>=0;
    if (path===spectatorPanel+"/HP" || path===spectatorPanel+"/AC" || path===spectatorPanel+"/PlayerBoard") return spectating();
    if (path===spectatorPanel+"/Reborn" || path===spectatorInfo+"/Medals") return false;
    if (path==="BombPanel") return [2,12].includes(modeId()) && state.alive && !modal;
    if (path==="BombPanel/Supply") return modeId()===12 && state.canRefill;
    if (path==="BombPanel/ProgressBarSupply") return modeId()===12 && state.refilling;
    if (path==="BombPanel/Mine") return modeId()===2 && state.canOperate && !state.bombPlanted;
    if (path==="BombPanel/Demine") return modeId()===2 && state.canOperate && state.bombPlanted;
    if (path==="BombPanel/Clock") return modeId()===2 && !!state.bombPlanted;
    if (path.startsWith("BombPanel/ProgressBar") && path.split("/").length===2)
      return modeId()===2 && state.operating && state.operationSeconds>0 && (path.endsWith("Demine") === !!state.bombPlanted);
    const won = state.phase === "MatchOver" || state.phase === "RoundOver";
    if(path===protectionBar)return !won && state.alive && state.spawnProtectionSeconds>0;
    if (path.startsWith("windows/OperationWindow/ZombieSettings")) return false;
    if (path === "States/Options") return modal !== "";
    if (path === "Dialog") return true;
    if (path === "Dialog/QuitWarning") return modal === "quit";
    if (path === "States/Options/ScorePanel/PersonalMode") return true;
    if (path.includes("ScorePanel/Table/") && path.includes("/PlayerCard")) {
      const row = playerRow(path);
      if (!row) return false;
      if (path.endsWith("/Dead")) return row.alive === false;
      if (path.endsWith("/Infection")) return row.side === "infected";
    }
    const bio = modeId()===8 || modeId()===10;
    if (/^BattlePanel\/Panel\/(Game|Round)(Win|Lose|Draw)$/.test(path)) {
      const draw=state.winner==="draw" || state.winner==="none";
      const victor=modeId()===4 ? state.winnerSlot===0 : state.winner===state.side;
      return !state.range && !bio && won && path.endsWith((state.phase==="MatchOver" ? "Game" : "Round") + (draw?"Draw":victor?"Win":"Lose"));
    }
    if (path.startsWith("BattlePanel/Panel/Win")) return bio && won && (state.winner === "human" ? path.endsWith("WinHuman") : state.winner === "infected" && path.endsWith("WinZombie"));
    if (path === "BattlePanel" || path === "BattlePanel/Panel") return true;
    if (path === "Crosshair/Panel") return !won && state.alive && !(state.aiming && state.sightType>0);
    if(path==="Crosshair/Reflex" || path==="Crosshair/Holographic")
      return !won && state.alive && !modal && !selecting() && state.aiming && state.sightType===(path.endsWith("/Reflex")?2:1);
    if (path === "States" || path === "States/TopLeft" || path === "States/TopPanel") return true;
    if (path === "Controlls" || path === "windows/OperationWindow") return !modal && !won && !selecting() && state.alive;
    if (path === rocker + "/Trail") return [...touches.values()].some(t=>t.action==="move" && Math.hypot(t.dx,t.dy)>=48);
    if (path === trigger + "/Dock") return ![...touches.values()].some(t=>qmqzTouchLayout.fixed?t.firing:t.action==="aim" || t.firing);
    if (path === trigger + "/Fire") return [...touches.values()].some(t => t.firing);
    if (path === trigger + "/Drag") return !qmqzTouchLayout.fixed && [...touches.values()].some(t=>t.action==="aim") && ![...touches.values()].some(t=>t.firing);
    const board = path.split("/")[0];
    if (layout.boards.includes(board)) {
      const leaf = path.slice(board.length);
      if (leaf==="/HumanIcon") return !infected;
      if (leaf==="/ZombieIcon") return infected;
      if (leaf==="/StrikersIcon") return state.side==="police";
      if (leaf==="/RevengersIcon") return state.side==="terrorist";
      if (leaf==="/HunterIn") return state.hero || state.fighters?.some(row=>row.roleId===1999);
      if (/^\/Players\/.+\/Man\d+$/.test(leaf)) {
        const side = leaf.includes("/Human/") ? "human" : leaf.includes("/Zombie/") ? "infected" : leaf.includes("/Aliance/") ? "police" : "terrorist";
        const total = state.fighters?.filter(row=>row.side===side).length;
        return +path.match(/\d+$/)[0] <= (total ?? (side==="human" ? state.humans : state.infected));
      }
    }
    if (!path.startsWith(settings)) return n.active;
    const name = path.slice(settings.length);
    if (name === "Skill") return infected;
    if (name === "Ammo") return !infected && !state.hero;
    if (name === "Weapon") return !infected;
    if (name === "Bullet") return !infected && state.enhancedAmmoAvailable === true;
    if (name === "AC_HP/Shield") return state.shield > 0;
    if (name === "AC_HP/Mother") return bio && (infected ? state.mother : state.hero);
    if (name === "AC_HP/Immunity") return bio && state.hero;
    if (name === "AC_HP/Heal") return infected;
    if (name === "Skill/Skill/Slider/Foreground") return state.cooldown > 0;
    if (name === "Operation/Switch") return !infected && !state.hero;
    if (name === "Operation/Sight/Sight") return state.canAim && !state.aiming;
    if (name === "Operation/CloseSight/CloseSight") return !!state.aiming;
    if (name === "Operation/Grenade") return !!state.canGrenade && qmqzTouchLayout.shortcut("Grenade");
    if (name === "Operation/Flash") return !!state.canFlash && qmqzTouchLayout.shortcut("Flash");
    return n.active;
  }

  function runtimeValue(path, widget) {
    const val = {key:widget.image, text:widget.text, color:widget.color, fill:1};
    if (path === healForeground && healRemaining !== null) {
      const now = performance.now();
      healRemaining = Math.max(0, healRemaining - Math.min((now-healFrame)/1000, 1/3));
      healFrame = now;
      val.fill = healRemaining/15;
      if (healRemaining > 0) refresh();
    }
    if(path===protectionBar+"/Slider/Foreground")
      val.fill=clamp((protectionDuration-state.spawnProtectionSeconds)/Math.max(.001,protectionDuration-.3),0,1);
    if(path.startsWith(bioLevelBar+"/")){
      const infected=state.side==="infected";
      if(path.endsWith("/Level"))val.text="LV."+(state.bioLevel||0);
      if(path.endsWith("/bouns"))val.text=(infected?"生命值+":"攻击力+")+(state.bioBonus||0);
      if(path.endsWith("/LevelBar/Foreground"))val.fill=Math.min(1,(state.bioExp||0)/(infected?20:40));
      const age=performance.now()-bioTwinkle;
      if(age<600){val.color=[...val.color];val.color[3]*=Math.abs(1-(age%300)/150);refresh();}
    }
    if (path==="States/TopPanel/Top/Star/Star") val.text=String(state.rangeScore||0);
    combatFeedback.value(path,val);
    const dynamic = key => layout.dynamic[key]?.split("/").pop();
    const infected = state.side === "infected";
    const component = layout.nodes[path];
    if (component.role) {
      const r = layout.roleCards.find(role=>role.id===component.role);
      if (path.endsWith("/Name")) val.text=r.name;
      if (path.endsWith("/Skill")) val.text=r.desc;
      if (path.endsWith("/Head")) val.key=dynamic("card"+r.id);
      if (path.endsWith("/BG") && r.id===state.selectedRole) val.key=layout.nodes[zombieWindow+"/Center/Zombies/Highlight"].widget.image;
    }
    if (path===zombieWindow+"/Center/Timeleft" || path===equipWindow+"/Left/EnterButton/Countdown") val.text=clockText(state.selectionSeconds);
    if (path.startsWith(portraitPath)) val.key=dynamic("body"+portraitRole(path));
    const tab=equipSlot(path);
    if (tab>=0) {
      if (path.endsWith("/SuitNumber")) val.text=String(tab+1);
      if (path.endsWith("/MainWeapon")) val.art=equipmentItems.get(pickerItem(path,tab))?.icon;
      if (path.endsWith("/Score/Score")) val.text=String(loadout(tab)?.star ?? "");
    }
    if (path.startsWith(gunPanel+"/Panel/")) {
      const id=itemAt(activeTab(),panelSlots[path.split("/")[7]]);
      if (path.endsWith("/Sketch")) val.art=equipmentItems.get(id)?.sketch || equipmentItems.get(id)?.icon;
      if (path.endsWith("/Name")) val.text=equipmentItems.get(id)?.name || layout.itemNames[id] || "";
    }
    if (path==="BombPanel/Clock/Label") val.text=clockText(state.blastSeconds);
    if (path.startsWith(spectatorPanel + "/")) {
      const member=state.room?.members?.[state.spectatorSlot];
      if (path===spectatorPanel+"/RebornTime/RebornTime") val.text=clockText(state.spectatorRespawnSeconds);
      if (path===spectatorPanel+"/HP/HP") val.text=String(state.spectatorHp);
      if (path===spectatorPanel+"/AC/AC") val.text=String(state.spectatorArmor);
      if (path===spectatorPanel+"/HP/Slider/Foreground") val.fill=state.spectatorHp/Math.max(1,state.spectatorMaxHp);
      if (path===spectatorPanel+"/AC/Slider/Foreground") val.fill=state.spectatorArmor/Math.max(1,state.spectatorMaxArmor);
      if (path===spectatorInfo+"/Name") val.text=state.spectatorName;
      if (path===spectatorInfo+"/Weapon/WeaponName") val.text=state.spectatorWeapon;
      if (path===spectatorInfo+"/Weapon/WeaponSketch") val.art=equipmentItems.get(state.spectatorWeaponId)?.sketch;
      if (path===spectatorInfo+"/LvValue") val.text=member?.level ? String(member.level) : "";
      if (path===spectatorInfo+"/Rank" && member?.level>=1 && member.level<=120) val.art="rank-"+member.level+".png";
      if (path===spectatorInfo+"/Logo" && (member?.iconid>=1 && member.iconid<=38 ||
          member?.iconid>=1001 && member.iconid<=1004 || member?.iconid>=10001 && member.iconid<=10003)) val.art="head-"+member.iconid+".png";
    }
    if (path===challengeDeath+"/Time") val.text=state.reviveSeconds+"秒";
    if (path===challengeDeath+"/Reborn/Number") val.text=String(state.revivePrice);
    if (path.startsWith("BombPanel/ProgressBar")) {
      const supply=path.startsWith("BombPanel/ProgressBarSupply");
      const duration=supply ? state.refillDuration : layout.bombTimes[state.bombPlanted ? 1 : 0];
      const remaining=supply ? state.refillSeconds : state.operationSeconds;
      const progress=clamp(1-(remaining || 0)/duration,0,1);
      if (path.endsWith("/Foreground")) val.fill=progress;
      if (path.endsWith("/LabelProgress")) val.text=Math.round(progress*100)+"%";
    }
    if (path === settings + "AC_HP/HP/HP") val.text = String(state.hp ?? "");
    if (path === settings + "AC_HP/AC/AC") val.text = String(state.ac ?? 0);
    if (path === settings + "AC_HP/HP/Slider/Foreground") val.fill = state.maxHp > 0 ? state.hp / state.maxHp : 1;
    if (path === settings + "AC_HP/AC/Slider/Foreground") val.fill = state.maxAc > 0 ? state.ac / state.maxAc : 0;
    if (path === settings + "AC_HP/Head") val.key = dynamic(state.fighters?.[0]?.roleId || (infected ? state.roleId : state.hero ? 1999 : 101));
    if (path === settings + "AC_HP/Mother" && state.hero) val.key = "GameAtlas-Icon_Hero";
    if (path === "States/Options/ScorePanel/PersonalMode/GameMode/GameMode") val.text = state.room?.modeName || "生化模式";
    if (path.includes("ScorePanel/Table/") && path.includes("/PlayerCard")) {
      const row = playerRow(path);
      if (row) {
        if (path.endsWith("/head")) val.key = dynamic(row.roleId);
        if (path.endsWith("/Background")) val.key = layout.rosterImages[row.side === "infected" ? "Zombie" : "Yellow"];
        if (path.endsWith("/playerName")) val.text = row.nickname || "";
        if (path.endsWith("/States")) val.text = Number.isFinite(row.kills) && Number.isFinite(row.deaths) ? row.kills + "/" + row.deaths : "";
        if (path.endsWith("/Score")) val.text = String(row.score ?? "");
      }
    }
    if (path === settings + "Weapon/Weapon/Sketch") {
      const id=state.hero?8001:state.weaponId || itemAt(activeTab(),11);
      const item=equipmentItems.get(id);
      val.art=item?.sketch || item?.icon;
      val.key=dynamic(id);
    }
    if (path === settings + "Weapon/Weapon/Label") val.text = state.hero ? "" : state.clip + "/" + state.reserve;
    if (path === settings + "Bullet/Bullet/IconAmmo") {
      val.key = dynamic("ammo"+state.ammoId);
      val.color = state.paidStock>0 ? [1,1,1,1] : [.5,.5,.5,1];
    }
    if (path === settings + "Bullet/Bullet/Val") val.text=String(state.paidStock??0);
    if(path===settings+"Bullet/Bullet/Background" && state.enhancedAmmoSelected && widget.pressedImage)
      val.key=widget.pressedImage;
    if (path === settings + "Skill/Skill/Slider/Background") val.key = layout.skillImages[state.roleId] || val.key;
    const board = path.split("/")[0], leaf=path.slice(board.length);
    if (layout.boards.includes(board)) {
      if (leaf==="/GameMode") val.text=state.room?.modeName || (modeId()===10 ? "生化英雄" : modeId()===8 ? "生化模式" : val.text);
      if (leaf==="/Time") val.text=clockText(state.seconds);
      if(board==="ChallengeScoreBoard") {
        if(leaf==="/RoundNum") val.text=String(state.wave ?? 1);
        if(leaf==="/MonsterVal") val.text=String(state.monstersLeft ?? 0);
      }
      if (leaf==="/HumanScore") val.text=String(state.humanWins ?? 0);
      if (leaf==="/ZombieScore") val.text=String(state.zombieWins ?? 0);
      if (leaf==="/StrikersScore") val.text=String((modeId()===1 ? state.policeKills : state.policeWins) ?? 0);
      if (leaf==="/RevengersScore") val.text=String((modeId()===1 ? state.terroristKills : state.terroristWins) ?? 0);
      if (leaf==="/SelfScore") val.text=String(state.fighters?.[0]?.kills ?? 0);
      if (leaf==="/TopkillerSocre") val.text=String(Math.max(0,...(state.fighters||[]).map(f=>f.kills)));
      if (leaf==="/HunterIn/HeroScore") val.text=String((state.fighters||[]).filter(f=>f.roleId===1999 && f.alive).length);
      if (leaf==="/HunterIn/GhostScore") val.text=String(state.infected ?? 0);
      if (/^\/Players\/.+\/Man\d+$/.test(leaf)) {
        const side=leaf.includes("/Human/")?"human":leaf.includes("/Zombie/")?"infected":leaf.includes("/Aliance/")?"police":"terrorist";
        const alive=state.fighters?.filter(f=>f.alive && f.side===side).length ?? (side==="human"?state.humans:state.infected);
        if (+path.match(/\d+$/)[0] > alive) val.color=[.5,.5,.5,1];
        else if (side==="human") val.color=[1,.5,0,1];
        else if (side==="infected") val.color=[0,1,0,1];
      }
    }
    return val;
  }

  function transform(path, n) {
    let p = geometry.get(parent(path)) || {x:0,y:0,z:0,angle:0,sx:1,sy:1,active:true};
    if (layout.boards.includes(path)) p = geometry.get(scoreboardHost);
    let [x,y] = n.xy, [sx,sy] = combatFeedback.privateScale(path,combatFeedback.scale(path,n.scale));
    if (path==="BattlePanel/Panel/GameBlind") { sx=width; sy=height; }
    if(path===protectionBar && state.spawnProtectionSeconds<.15){
      const fraction=clamp(state.spawnProtectionSeconds/.15,0,1);
      sx*=fraction;sy*=fraction;
    }
    if (n.anchor) {
      const sides = [[-1,-1],[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1],[0,0]];
      const side = sides[n.anchor[0]];
      x = side[0] * width / 2 + n.anchor[1] * width;
      y = side[1] * height / 2 + n.anchor[2] * height;
    }
    if (path.startsWith(portraitPath)) {
      x=layout.bodyOffsets[portraitRole(path)] ?? 0;
      if(roleSlide) x+=roleSlide.direction*roleSlide.width*((path===portraitPath+"1"?1:0)-roleSlide.progress);
    }
    if(bagSlide && (path===bagPage || path===bagPage+"~1"))
      y+=bagSlide.direction*layout.nodes[bagPage].box.size[1]*(bagSlide.progress-(path===bagPage?0:1));
    const def = layout.defaults[entries.get(path)];
    if (def) {
      const key=entries.get(path),placed=throwButtons[key]||qmqzTouchLayout.position(key,def,width,height);
      x=placed.x; y=placed.y; sx=sy=placed.scale;
    }
    if (path === rocker + "/Drag") {
      const movement = [...touches.values()].find(t => t.action === "move");
      if (movement) { x += movement.dx; y += movement.dy; }
    }
    let angle = combatFeedback.rotation(path,n.rotation ? 2*Math.atan2(n.rotation[2],n.rotation[3]) : 0);
    if (path.includes("/PrivateNoticeBoard/NoticePanel/Kills/kill")) {
      const [ox,oy]=combatFeedback.arrowOffset(path,angle); x+=ox; y+=oy;
    }
    if (path === rocker + "/Trail") {
      const t=[...touches.values()].find(t=>t.action==="move");
      if (t) angle=Math.atan2(t.dy,t.dx)-Math.PI/2;
    }
    if (path === trigger) {
      const aim=[...touches.values()].find(t=>t.firing) || [...touches.values()].find(t=>t.action==="aim");
      if (aim && !qmqzTouchLayout.fixed) {
        const border=layout.defaults.Trigger.W*sx/2;
        x=clamp(aim.x,-width/2+border,width/2-border); y=clamp(aim.y,-height/2+border,height/2-border);
      }
    }
    const cos=Math.cos(p.angle), sin=Math.sin(p.angle);
    const g = {x:p.x+x*p.sx*cos-y*p.sy*sin, y:p.y+x*p.sx*sin+y*p.sy*cos, z:p.z+n.z, angle:p.angle+angle,
      sx:p.sx*sx, sy:p.sy*sy, clip:p.clip, active:p.active && display(path,n)};
    if (n.clip) g.clip=[g.x+n.clip[0]*g.sx,g.y+n.clip[1]*g.sy,Math.abs(n.clip[2]*g.sx),Math.abs(n.clip[3]*g.sy)];
    return g;
  }

  function imageFor(key, color) {
    const raw = images.get(key);
    if (!raw || color.slice(0,3).every(v => v >= .9999)) return raw;
    const hash = key + ":" + color.slice(0,3).join(",");
    if (!tintedImages.has(hash)) {
      const bitmap = document.createElement("canvas");
      bitmap.width = raw.naturalWidth; bitmap.height = raw.naturalHeight;
      const c = bitmap.getContext("2d", {willReadFrequently:true});
      c.drawImage(raw,0,0);
      const pixels = c.getImageData(0,0,bitmap.width,bitmap.height);
      for (let i=0;i<pixels.data.length;i+=4) {
        for (let channel=0;channel<3;channel++) pixels.data[i+channel] *= color[channel];
      }
      c.putImageData(pixels,0,0);
      tintedImages.set(hash,bitmap);
    }
    return tintedImages.get(hash);
  }

  function bagImage(filename) {
    const hd=window.qmqzUiDensity.media.matches,key=(hd?"2:":"1:")+filename;
    if(!equipmentArt.has(key)){
      equipmentArt.set(key,null);
      window.qmqzUiDensity.load("original-ui/"+encodeURIComponent(filename)).then(image=>{
        equipmentArt.set(key,image);refresh();
      });
    }
    return equipmentArt.get(key);
  }

  function picture(img, meta, x, y, w, h, sliced, collapsed = false) {
    if (!sliced || !meta) { ctx.drawImage(img,x,y,w,h); return; }
    const [ox,oy,ow,oh] = meta.outer;
    const [ix,iy,iw,ih] = meta.inner;
    const left = ix-ox, top = iy-oy, right = ow-left-iw, bottom = oh-top-ih;
    const density=(img.naturalWidth || img.width)/ow;
    const srcX = [0,left,ow-right,ow].map(v=>v*density), srcY = [0,top,oh-bottom,oh].map(v=>v*density);
    const dstX = [x,x+Math.min(left,w/2),x+w-Math.min(right,w/2),x+w];
    const dstY = [y,y+Math.min(top,h/2),y+h-Math.min(bottom,h/2),y+h];
    for (let i=0;i<3;i++) for (let j=0;j<3;j++) {
      const sw=srcX[i+1]-srcX[i], sh=srcY[j+1]-srcY[j], dw=dstX[i+1]-dstX[i], dh=dstY[j+1]-dstY[j];
      if (dw<=0 || dh<=0) continue;
      if (sw>0 && sh>0) ctx.drawImage(img,srcX[i],srcY[j],sw,sh,dstX[i],dstY[j],dw,dh);
      else if (collapsed) {
        // NGUI samples a single UV coordinate across a collapsed slice.
        ctx.drawImage(img,srcX[i]-(sw?0:.001),srcY[j]-(sh?0:.001),sw||.002,sh||.002,dstX[i],dstY[j],dw,dh);
      }
    }
  }

  function draw({path, g, widget}) {
    if (path.endsWith("/KillTypes/HeroDead") && combatFeedback.drawHeroWord(ctx,width/2,height/2,geometry.get(parent(path)))) return;
    const v = runtimeValue(path, widget);
    let x=0, y=0;
    const pivotX = (widget.pivot % 3)/2, pivotY = Math.floor(widget.pivot/3)/2;
    ctx.save();
    if (g.clip) {
      const [cx,cy,cw,ch]=g.clip;
      ctx.beginPath(); ctx.rect(width/2+cx-cw/2,height/2-cy-ch/2,cw,ch); ctx.clip();
    }
    ctx.translate(width/2+g.x,height/2-g.y);
    ctx.rotate(-g.angle);
    ctx.scale(Math.sign(g.sx)||1,Math.sign(g.sy)||1);
    if (widget.class === "UILabel") {
      if (v.text) {
        window.qmqzFonts.draw(ctx,widget,v.text,Math.abs(g.sy),v.color);
      }
    } else {
      const img = v.art ? bagImage(v.art) : v.sketch ? combatFeedback.sketch(v.sketch) : imageFor(v.key,v.color);
      if (img && v.fill > 0) {
        let w = Math.abs(g.sx), h = Math.abs(g.sy);
        x -= w*pivotX; y -= h*pivotY;
        if(v.art){
          const fit=Math.min(w/img.naturalWidth,h/img.naturalHeight);
          const width=img.naturalWidth*fit,height=img.naturalHeight*fit;
          x+=(w-width)/2;y+=(h-height)/2;w=width;h=height;
        }
        const meta = v.art ? null : layout.images[v.key];
        if (meta && widget.type !== 1) {
          const [l,t,r,b] = meta.padding;
          x += l*w; y += t*h; w *= Math.max(0,1-l-r); h *= Math.max(0,1-t-b);
        }
        ctx.globalAlpha=v.color[3];
        if (v.fill < 1) {
          const fraction=clamp(v.fill,0,1);
          ctx.beginPath();
          if (path === healForeground) {
            // UISprite.FilledFill, Radial360 non-inverted: upper-left quadrant first.
            const cx=x+w/2, cy=y+h/2, start=-Math.PI/2;
            ctx.moveTo(cx,cy);
            ctx.arc(cx,cy,Math.hypot(w,h)/2,start,start-fraction*2*Math.PI,true);
            ctx.closePath();
          } else if (v.verticalFromTop) ctx.rect(x,y,w,h*fraction);
          else ctx.rect(x,y,w*fraction,h);
          ctx.clip();
        }
        const title=throwIcons.get(path);
        if(title){
          ctx.fillStyle="rgba(8,18,27,.62)";
          ctx.beginPath();ctx.arc(0,0,w*.49,0,2*Math.PI);ctx.fill();
        }
        picture(img,meta,x,y,w,h,widget.type===1,path==="BattlePanel/Panel/GameBlind" || path.startsWith("windows/TargetPanel/"));
        if(title){
          ctx.font="600 "+Math.max(10/scale,w*.23)+"px OriginalMYH,sans-serif";
          ctx.textAlign="center";ctx.textBaseline="middle";ctx.lineJoin="round";ctx.lineWidth=2/scale;
          ctx.strokeStyle="#13202a";ctx.strokeText(title,0,h*.29);ctx.fillStyle="#fff";ctx.fillText(title,0,h*.29);
        }
      }
    }
    ctx.restore();
  }

  // Draw in the Unity camera callback. Waiting for the HUD RAF would display the previous frame's names.
  window.qmqzDrawAllyFrame=(positions,offset,count)=>{
    if(!allyCanvas || !layout)return;
    allyCanvas.hidden=state.mode!=="match" || !!modal || selecting();
    if(allyCanvas.hidden || (!count && !allyInk))return;
    const r=unity.getBoundingClientRect();
    if(!r.width || !r.height)return;
    const dpi=Math.min(window.devicePixelRatio||1,2);
    const px=Math.round(r.width*dpi),py=Math.round(r.height*dpi);
    if(allyCanvas.width!==px || allyCanvas.height!==py){allyCanvas.width=px;allyCanvas.height=py;}
    const h=layout.root.manualHeight,w=r.width*h/r.height;
    allyContext.setTransform(px/w,0,0,py/h,0,0);
    allyContext.clearRect(0,0,w,h);
    allyInk=count>0;
    if(allyInk)combatFeedback.allyNames(allyContext,positions,offset,count,state.fighters,
      layout.nodes["windows/TargetPanel/PlayerInfo/Name"]?.widget,w,h);
  };

  function render() {
    if (!overlay) return;
    overlay.hidden = state.mode !== "match" || !layout || modal==="settings";
    if(overlay.hidden || modal || selecting())allyCanvas.hidden=true;
    if (overlay.hidden) return;
    combatFeedback.beginFrame(modal || selecting() ? null : state.identity);
    const r=unity.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    scale=r.height/layout.root.manualHeight;
    height=layout.root.manualHeight;
    width=r.width/scale;
    throwButtons=desktopControls?.desktop?{}:qmqzTouchLayout.throwables(layout.defaults,width,height,scale);
    const dpi=Math.min(window.devicePixelRatio || 1,2);
    const px=Math.round(r.width*dpi), py=Math.round(r.height*dpi);
    if (overlay.width!==px || overlay.height!==py) { overlay.width=px; overlay.height=py; }
    ctx.setTransform(px/width,0,0,py/height,0,0);
    ctx.clearRect(0,0,width,height);
    if (state.alive && state.scopePrepared && !modal && !selecting()) {
      // ACrosshair.DrawTeleScopeTag draws a black aperture and two one-pixel quads.
      const cx=width/2,cy=height/2;
      ctx.fillStyle="#000";
      ctx.beginPath();
      ctx.rect(0,0,width,height);
      ctx.moveTo(cx+height*.4,cy);
      ctx.arc(cx,cy,height*192/480,0,Math.PI*2);
      ctx.fill("evenodd");
      ctx.fillRect(cx-width/(2*px),0,width/px,height);
      ctx.fillRect(0,cy-height/(2*py),width,height/py);
    }
    const widgets=[];
    if(roleSlide) {
      const t=Math.min(1,(performance.now()-roleSlide.started)/500);
      roleSlide.progress=t-Math.sin(t*2*Math.PI)/(2*Math.PI);
      if(t===1)roleSlide=null;else refresh();
    }
    if(bagSlide) {
      const t=Math.min(1,(performance.now()-bagSlide.started)/500);
      bagSlide.progress=t-Math.sin(t*2*Math.PI)/(2*Math.PI);
      if(t===1) {
        const {to,index}=bagSlide;
        carouselPage=to;bagSlide=null;
        if(index!==activeTab())send("original-loadout:"+index);
      } else refresh();
    }
    hitBoxes=[]; geometry=new Map();
    for (const [path,n] of Object.entries(layout.nodes)) {
      const g=transform(path,n);
      geometry.set(path,g);
      if (!g.active) continue;
      if(path===portraitPanel && state.humanActorChoices?.length>1 && g.clip) {
        const [x,y,w,h]=g.clip;
        // The two portrait colliders accept drags inside their clipped panel. Enter stays on top.
        hitBoxes.unshift({action:"swipe-actor",x,y,w,h});
      }
      if (n.widget?.enabled) {
        const layer = path.startsWith(zombieWindow) || path.startsWith(equipWindow) ? 6 : path.startsWith("Dialog/") ? 5 : path.startsWith("States/Options/Toolbar/") ? 4 :
          path.startsWith("States/Options/ScorePanel/") ? 3 : path.startsWith("States/Options/") ? 2 :
          path.startsWith("BattlePanel/") ? 1 : 0;
        widgets.push({path,g,widget:n.widget,layer});
      }
      const action=!bagSlide && /BattleEquipCarouselItem\/ItemSlot[01]$/.test(path) ? "original-loadout:"+equipSlot(path) : buttonActions.get(path);
      if(path===bagPage && !bagSlide)hitBoxes.unshift({action:"swipe-bags",x:g.x,y:g.y,w:n.box.size[0]*g.sx,h:n.box.size[1]*g.sy});
      if (action && n.box?.enabled) {
        const [ox,oy] = n.box.offset;
        hitBoxes.push({action,x:g.x+ox*g.sx,y:g.y+oy*g.sy,w:n.box.size[0]*g.sx,h:n.box.size[1]*g.sy});
      }
      if(path===settings+"Bullet/Bullet/IconAmmo" || path===settings+"Bullet/Bullet/Background"){
        // The artwork extends beyond the serialized collider. Nearby weapon controls keep priority.
        hitBoxes.unshift({action:"toggle-ammo",x:g.x,y:g.y,w:Math.abs(g.sx),h:Math.abs(g.sy)});
      }
      if (path===settings+"Operation/Pose" || path===settings+"Operation/Grenade" || path===settings+"Operation/Flash") {
        const key=entries.get(path),size=throwButtons[key]?.hit||layout.defaults[key].W*g.sx;
        hitBoxes.push({action:key==="Pose"?"crouch":key.toLowerCase(),x:g.x,y:g.y,w:size,h:size});
      }
    }
    widgets.sort((a,b)=>a.layer-b.layer || Math.round((b.g.z-a.g.z)*1000) ||
      Number(a.widget.class==="UILabel")-Number(b.widget.class==="UILabel") ||
      a.widget.depth-b.widget.depth);
    widgets.forEach(draw);
    if(state.alive && !modal && !selecting())
      combatFeedback.drawCover(ctx,width,height,layout.nodes["windows/TargetPanel/PlayerInfo/Name"]?.widget);
    overlay.dataset.phase = state.phase;
    overlay.dataset.side = state.side;
  }

  function send(value) {
    if(value==="toggle-ammo" && !state.enhancedAmmoSelected && (!state.enhancedAmmoAvailable || !state.paidStock)){
      ammoNotice.textContent=state.range?"靶场使用配发弹药":!state.enhancedAmmoAvailable?"当前武器无法使用穿甲弹":"当前武器的穿甲弹为 0，可在背包购买";
      ammoNotice.hidden=false;
      clearTimeout(noticeTimer);
      noticeTimer=setTimeout(()=>{ammoNotice.hidden=true;},1800);
    }
    window.qmqzUnity?.SendMessage("WebClient","Command",value);
  }

  function clearInput() {
    const moving = [...touches.values()].some(t=>t.action==="move");
    const firing = [...touches.values()].some(t=>t.firing);
    if ([...touches.values()].some(t=>t.action==="aim")) send("look-up");
    for(const t of touches.values())if(t.action==="grenade" || t.action==="flash")send("weapon:"+t.previousSlot);
    if ([...touches.values()].some(t=>t.action==="objective")) send("objective-up");
    if ([...touches.values()].some(t=>t.action==="refill")) send("refill-up");
    touches.clear();
    if (moving) send("move:0,0");
    if (firing) send("fireCancel");
    refresh();
  }

  function activate(action) {
    if(action.startsWith("actor-step:")){
      const roles=state.humanActorChoices||[];
      if(roles.length>1)send("battle-actor:"+roles[(roles.indexOf(playerRole())+Number(action.split(":")[1])+roles.length)%roles.length]);
      return;
    }
    if (action==="gun-panel") { gunOpen=!gunOpen; refresh(); return; }
    if(action==="fight-settings"){
      clearInput();modal="settings";desktopControls?.update(state,modal);refresh();
      window.dispatchEvent(new Event("qmqz-open-fight-settings"));return;
    }
    if (action.startsWith("weapon:")) { gunOpen=false; refresh(); }
    if (action==="options" || action==="quitDialog" || action==="resume" || action==="cancelQuit") {
      clearInput();
      modal={options:"options",quitDialog:"quit",resume:"",cancelQuit:"options"}[action];
      desktopControls?.update(state, modal);
      if (modal && document.pointerLockElement) document.exitPointerLock();
      refresh();
    } else send(action);
  }

  function selectBag(index) {
    const count=equipment()?.loadouts?.length||0;
    if(index<0 || index>=count || bagSlide)return;
    const page=Math.floor(index/2);
    if(page!==carouselPage)slideBags(page,Math.sign(page-carouselPage),index);
    else send("original-loadout:"+index);
    refresh();
  }

  function slideBags(to,direction,index=to*2) {
    if(bagSlide || to===carouselPage)return;
    bagSlide={to,direction,index,started:performance.now(),progress:0};
    refresh();
  }
  function keys(e) {
    if(state.mode!=="match" || modal==="settings" || e.repeat || e.ctrlKey || e.altKey || e.metaKey)return;
    if (!modal && spectating() && state.spectatorCanCycle && (e.code==="ArrowLeft" || e.code==="ArrowRight")) {
      e.preventDefault(); e.stopImmediatePropagation();
      send(e.code==="ArrowLeft" ? "spectate-prev" : "spectate-next");
      return;
    }
    if (!modal && state.selectionWindow==="EquipWindow") {
      if(e.code==="Enter" || e.code==="NumpadEnter")activate("enter");
      else if(/^Digit[1-9]$/.test(e.code))selectBag(Number(e.code.slice(5))-1);
      else if(e.code==="ArrowLeft" || e.code==="ArrowRight")selectBag(activeTab()+(e.code==="ArrowRight"?1:-1));
      else if(e.code!=="Escape")return;
      if(e.code!=="Escape"){e.preventDefault();e.stopImmediatePropagation();return;}
    }
    if(e.code!=="Escape")return;
    e.preventDefault(); e.stopImmediatePropagation();
    activate(modal === "quit" ? "cancelQuit" : modal ? "resume" : "options");
  }

  function position(e) {
    const rect=unity.getBoundingClientRect();
    return {x:(e.clientX-rect.left)/scale-width/2, y:height/2-(e.clientY-rect.top)/scale};
  }

  function input(e) {
    if (!layout || state.mode!=="match") return;
    const point=position(e);
    let touch=touches.get(e.pointerId);
    if (e.type==="pointerdown") {
      if (e.target!==unity || e.button!==0 || document.pointerLockElement) return;
      const hits = modal === "quit" ? hitBoxes.filter(b=>b.action==="leave" || b.action==="cancelQuit") :
        modal ? hitBoxes.filter(b=>b.action==="resume" || b.action==="quitDialog" || b.action==="fight-settings") : hitBoxes;
      const hit = [...hits].reverse().find(b=>Math.abs(point.x-b.x)<=b.w/2 && Math.abs(point.y-b.y)<=b.h/2);
      if ((modal || selecting()) && !hit) { e.preventDefault(); e.stopImmediatePropagation(); return; }
      const orbit=!hit && spectating() && !modal && state.phase==="Active";
      if (!hit && !orbit && (e.pointerType==="mouse" || !state.alive || ["RoundOver","MatchOver"].includes(state.phase))) return;
      // LLayout.GetTriggerRect uses the saved dock even while the drag graphic follows the aiming finger.
      const dock=qmqzTouchLayout.position("Trigger",layout.defaults.Trigger,width,height), stick=geometry.get(rocker);
      const fireSize=Math.abs(layout.nodes[trigger+"/Dock"].scale[0]*dock.scale);
      const onFire=Math.hypot(point.x-dock.x,point.y-dock.y)<=fireSize/2;
      const onStick=Math.hypot(point.x-stick.x,point.y-stick.y)<=64*Math.abs(stick.sx);
      let action=hit?.action || (orbit?"spectate-look":onFire?"aim":onStick?"move":point.x<0?"move":"aim");
      if(action==="aim"){
        const existing=[...touches.values()].find(t=>t.action==="aim");
        if(onFire && [...touches.values()].some(t=>t.firing))return;
        if(existing && onFire)action="fire";
        else if(existing?.firing){existing.action="fire";send("look-up");}
      }
      if ([...touches.values()].some(t=>t.action===action || (action==="grenade"||action==="flash")&&(t.action==="grenade"||t.action==="flash"))) return;
      // A prepared telescope can also be fired by releasing the aiming drag.
      const scopedDrag=action==="aim" && state.sightType===3 && state.aiming &&
        ![...touches.values()].some(t=>t.firing);
      const firing=((action==="aim" || action==="fire") && onFire) || scopedDrag;
      touch={action, hit, firing, previousSlot:state.weaponSlot, ...point, firstX:point.x, firstY:point.y, dx:0,dy:0, lastX:e.clientX,lastY:e.clientY};
      touches.set(e.pointerId,touch);
      unity.setPointerCapture(e.pointerId);
      if (action==="aim") send("look-down");
      if (action==="objective") send("objective-down");
      if (action==="refill") send("refill-down");
      if (action==="grenade" || action==="flash") send(action+"-down");
      if (firing) send(state.sightType===3 && !triggerPrimed && !state.aiming ? "touch-trigger-first" : "fireDown");
      if (["jump","crouch","previous-weapon"].includes(action)) activate(action);
    } else if (!touch) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.type==="pointermove" && touch.action==="move") {
      const x=(point.x-touch.firstX)*scale, y=(point.y-touch.firstY)*scale, length=Math.hypot(x,y);
      const travel=Math.max(length,64);
      touch.dx=x/travel*64; touch.dy=y/travel*64;
      // TouchMover uses a 16-pixel dead zone and normalises touch input. Only its gamepad path is analogue.
      if (length<16) send("move:0,0");
      else send("move:"+(x/length).toFixed(4)+","+(y/length).toFixed(4));
    } else if (e.type==="pointermove" && touch.action==="spectate-look") {
      const ratio=720/Math.max(1,unity.clientHeight);
      if (spectating() && !modal) send("spectate-look:"+((e.clientX-touch.lastX)*ratio).toFixed(2)+","+((e.clientY-touch.lastY)*ratio).toFixed(2));
      touch.lastX=e.clientX; touch.lastY=e.clientY;
    } else if (e.type==="pointermove" && touch.action==="aim") {
      const x=e.clientX-touch.lastX, y=e.clientY-touch.lastY;
      // Rebase a discontinuous contact (rotation or browser re-centering) at its new position.
      if(Math.abs(x)<unity.clientWidth*.45 && Math.abs(y)<unity.clientHeight*.45)
        send("look:"+x.toFixed(2)+","+y.toFixed(2));
      Object.assign(touch,point,{lastX:e.clientX,lastY:e.clientY});
    } else if (e.type==="pointerup" || e.type==="pointercancel") {
      touches.delete(e.pointerId);
      if (touch.action==="move") send("move:0,0");
      if (touch.firing) send(e.type==="pointerup"?"fireUp":"fireCancel");
      if ((touch.action==="aim" || touch.action==="fire") && e.type==="pointerup")triggerPrimed=true;
      if (touch.action==="aim") send("look-up");
      if (touch.action==="objective") send("objective-up");
      if (touch.action==="refill") send("refill-up");
      if (touch.action==="grenade" || touch.action==="flash")
        send(e.type==="pointerup"?touch.action+"-up":"weapon:"+touch.previousSlot);
      const b=touch.hit;
      if(touch.action==="swipe-actor") {
        const dx=point.x-touch.firstX, choices=state.humanActorChoices||[];
        if(e.type==="pointerup" && !roleSlide && choices.length>1 && Math.abs(dx)>=height*.05) {
          const from=playerRole(), direction=dx<0 ? 1 : -1;
          const index=choices.indexOf(from);
          const to=choices[(Math.max(0,index)+direction+choices.length)%choices.length];
          roleSlide={from,to,direction,width:b.w,started:performance.now(),progress:0};
          send("battle-actor:"+to);
        }
        refresh();return;
      }
      if (touch.action==="swipe-bags" || touch.action.startsWith("original-loadout:")) {
        if(e.type!=="pointerup")return;
        const dy=point.y-touch.firstY, dx=touch.firstX-point.x;
        const pages=Math.ceil((equipment()?.loadouts?.length || 1)/2);
        const direction=Math.abs(dy)>=height*.05 ? Math.sign(dy) : Math.abs(dx)>64 ? Math.sign(dx) : 0;
        if(direction){
          slideBags((carouselPage+direction+pages)%pages,direction);
          return;
        }
        if(touch.action==="swipe-bags")return;
      }
      if (e.type==="pointerup" && b && !["jump","crouch","objective","refill","previous-weapon","grenade","flash"].includes(b.action) &&
          Math.abs(point.x-b.x)<=b.w/2 && Math.abs(point.y-b.y)<=b.h/2) {
        activate(b.action);
        if (b.action==="resume" && e.pointerType==="mouse") desktopControls?.requestControl();
      }
    }
    refresh();
  }

  window.addEventListener("qmqz-state", event => {
    const lastWindow=state.selectionWindow;
    const wasHeroMode=state.mode==="match" && modeId()===10;
    const previous=state;
    state=event.detail || {};
    if(state.mode!=="match" || !state.alive)triggerPrimed=false;
    if (state.mode!=="match" || state.side!=="infected" || !state.alive ||
        previous.round!==state.round || previous.side!==state.side) {
      healRemaining=null;
    } else if (state.hp<previous.hp) {
      // HeroInjured and the HP-consuming rage skill use the client's BioProperty.healWait.
      healRemaining=15;
      healFrame=performance.now();
    }
    if(!(state.spawnProtectionSeconds>0))protectionDuration=0;
    else if(!protectionDuration || state.spawnProtectionSeconds>(previous.spawnProtectionSeconds||0))
      protectionDuration=state.spawnProtectionSeconds;
    if(state.mode==="match" && [8,10].includes(modeId()) && state.bioExp>0 &&
      (state.bioExp!==previous.bioExp || state.side!==previous.side))bioTwinkle=performance.now();
    combatFeedback.setActive(state.mode==="match");
    if(!wasHeroMode && state.mode==="match" && modeId()===10)combatFeedback.prepareHeroWord();
    if (lastWindow!==state.selectionWindow) { carouselPage=Math.floor(activeTab()/2);gunOpen=false;roleSlide=null;bagSlide=null; }
    create();
    desktopControls?.update(state, modal);
    unity?.parentElement.toggleAttribute("data-qmqz-match",state.mode==="match");
    if (state.mode==="match") {
      if (!pending) pending=readLayout().catch(error=>{ pending=null; console.error("原版战斗界面加载失败",error); });
    } else {
      modal="";
      if (previous.mode==="match") {
        overlay.width=overlay.height=1;
        allyCanvas.width=allyCanvas.height=1;
        allyInk=false;
        equipmentArt.clear();
        tintedImages.clear();
      }
      if(ammoNotice)ammoNotice.hidden=true;
      clearInput();
    }
    refresh();
  });
  window.addEventListener("qmqz-close-fight-settings",()=>{
    if(modal==="settings"){modal="options";desktopControls?.update(state,modal);refresh();}
  });
  window.qmqzUiDensity.media.addEventListener("change",()=>{
    if(layout) loadSprites(layout).then(refresh);
  });
})();
