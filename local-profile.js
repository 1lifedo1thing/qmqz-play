// Browser port of the APK's game/world.py account store and login/handlers.py results.
(() => {
  let connection;
  let currentAccount;
  let queue = Promise.resolve();
  let worker;
  let requestId = 0;
  const waiting = new Map();

  function runRules(request) {
    if (!worker) {
      worker = new Worker("local-rules-worker.js", {type:"module"});
      worker.onmessage = ({data}) => {
        const callback = waiting.get(data.id);
        if (!callback) return;
        waiting.delete(data.id);
        if (data.error) callback.reject(new Error(data.error));
        else callback.resolve(data.result);
      };
      worker.onerror = event => {
        for (const callback of waiting.values()) callback.reject(new Error(event.message));
        waiting.clear();
        worker.terminate();
        worker = null;
      };
    }
    return new Promise((resolve, reject) => {
      const id = ++requestId;
      waiting.set(id, {resolve,reject});
      worker.postMessage({id,request});
    });
  }

  function openDatabase() {
    if (!connection) {
      connection = new Promise((resolve, reject) => {
        const request = indexedDB.open("qmqz-local-game", 2);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("accounts")) {
            db.createObjectStore("accounts", {keyPath:"name"});
            const roles = db.createObjectStore("roles", {autoIncrement:true});
            roles.createIndex("name","name",{unique:true});
            roles.createIndex("account","account",{unique:true});
          }
          db.createObjectStore("matchReceipts");
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => { db.close(); connection = undefined; };
          resolve(db);
        };
        request.onerror = () => { connection = undefined; reject(request.error); };
      });
    }
    return connection;
  }

  function read(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // Wait for the transaction to commit before reporting a successful registration.
  function insert(db, store, record) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, "readwrite");
      const request = tx.objectStore(store).add(record);
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error || request.error);
    });
  }

  function publicRole(record, id) {
    const {account, originalData, pendingDouble, ...fields} = record;
    return {...fields, roleid:id + 100000};
  }

  const lastRoleKey = "QMQZ.lastLocalRole";
  const firstLocalAccount = "$offline";

  // A key cursor reads only the nickname and primary key, even for a large inventory.
  window.qmqzLocalRoles = async () => {
    const db = await openDatabase();
    const roles = await new Promise((resolve,reject) => {
      const rows = [];
      const request = db.transaction("roles").objectStore("roles").index("name").openKeyCursor();
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) { resolve(rows); return; }
        rows.push({id:cursor.primaryKey, name:cursor.key});
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
    const last = Number(localStorage.getItem(lastRoleKey));
    return {roles,last:roles.find(role => role.id === last)?.id || (roles.length===1 ? roles[0].id : null)};
  };

  async function startRoleSession(db, account) {
    // Finish any pending offline rank migration before running the APK's real login clock.
    if (!await profile(db,account)) return null;
    return profile(db,account,"menu",{view:"bonus-login"});
  }

  async function resumeLocal(db, id) {
    const record = Number.isSafeInteger(id) && id > 0
      ? await read(db.transaction("roles").objectStore("roles").get(id)) : null;
    if (id && !record) throw Error("所选本地角色不存在");
    currentAccount = record ? record.account : firstLocalAccount;
    const role = await startRoleSession(db,currentAccount);
    if (role) localStorage.setItem(lastRoleKey,String(role.roleid-100000));
    return {screen:role ? "MainUI" : "CreateCharacter",loginResult:role ? 0 : 5,profile:role};
  }

  // The original archive and gift ownership use role.data fields outside Unity's match snapshot.
  window.qmqzReadCombatTraits = async roleId => {
    const db=await openDatabase();
    const record=await read(db.transaction('roles').objectStore('roles').get(roleId-100000));
    if (!record || record.account!==currentAccount) throw Error('Unexpected local battle owner');
    const src=record.originalData||{};
    return {gifts:src.gifts||[],research_talents:src.research_talents||{}};
  };
  window.qmqzReadChallengeRoom = async roleId => {
    const db=await openDatabase();
    const record=await read(db.transaction("roles").objectStore("roles").get(roleId-100000));
    if(!record || record.account!==currentAccount) throw Error("挑战房角色已切换");
    const info=record.originalData||{}, day=new Date(), daily=info.pve_daily_cards;
    const today=[day.getFullYear(),String(day.getMonth()+1).padStart(2,"0"),String(day.getDate()).padStart(2,"0")].join("-");
    return {vip:info.vipstatus||0, remaining:daily?.day===today?daily.left:3};
  };
  window.qmqzReadPosterRole = async roleId => {
    const db=await openDatabase();
    const record=await read(db.transaction("roles").objectStore("roles").get(roleId-100000));
    if(!record || record.account!==currentAccount) return null;
    const info=record.originalData||{};
    return {killnum:Number(info.killnum)||0,headshots:Number(info.headshots)||0,killrate:Number(info.killrate)||0,
      teamname:info.teamname||"",vipstatus:Number(info.vipstatus)||0,cash:Number(info.cash_all)||0,
      gifts:(info.gifts||[]).map(Number),bought:(info.gift_bought||[]).map(Number),
      vipGifts:(info.vip_gifts||[]).map(Number),
      pve:info.webPveCards||null,slot:info.webSlotPending||null,
      cardUntil:Object.fromEntries([1,2,3].map(i=>[i,info["card_"+i+"_until"]||0])),
      talents:info.talents||{},researchTalents:info.research_talents||{},researchPoints:Number(info.research_point)||0,
      study:Number(info.study_point)||0,progress:info.gun_research||{},cards:Number(info.legend_cards)||0,
      items:(info.pkg_items||[]).map(Number),counts:info.item_counts||{}};
  };

  let presenceRole=0,releasePresence;
  const socialBus=new BroadcastChannel("qmqz-social-local");
  socialBus.onmessage=({data})=>{
    if(data.wallet && data.roleid===presenceRole)window.qmqzProfileCommand("social-wallet","{}");
    window.dispatchEvent(new Event("qmqz-social-changed"));
  };
  function setPresence(id){
    if(id===presenceRole)return;
    releasePresence?.();releasePresence=undefined;presenceRole=id;
    if(!id)socialBus.postMessage({presence:true});
    if(id)navigator.locks.request("qmqz-presence-"+id,{mode:"shared"},()=>{
      if(id===presenceRole){
        socialBus.postMessage({presence:true});
        return new Promise(resolve=>{releasePresence=resolve;});
      }
    });
  }
  window.addEventListener("qmqz-state",({detail})=>setPresence(detail?.profile?.roleid||0));
  window.addEventListener("pagehide",()=>setPresence(0));
  window.addEventListener("pageshow",()=>setPresence(window.qmqzLastState?.profile?.roleid||0));
  window.qmqzLocalSocial=(roleid,op={})=>{
    const account=currentAccount, paid=op.id===851970 && op.fields?.channel===1;
    const save=()=>localSocial(account,roleid,op);
    return navigator.locks.request("qmqz-social-local",()=>paid?navigator.locks.request("qmqz-role-"+account,save):save());
  };
  async function localSocial(account,roleid,op){
    const db=await openDatabase(),key="local-social-v1";
    const tx=db.transaction(["roles","matchReceipts"]),roles=tx.objectStore("roles");
    const [keys,players,social,locks]=await Promise.all([read(roles.getAllKeys()),read(roles.getAll()),
      read(tx.objectStore("matchReceipts").get(key)),navigator.locks.query()]);
    const directory=players.map((r,index)=>({roleid:100000+Number(keys[index]),name:r.name,iconid:r.iconid||0,
      level:r.level||1,exp:r.exp||0,publicData:Object.fromEntries(["vipstatus","cash_all","teamname","killnum","headshots","killrate","loadouts","card_1_until","card_2_until","card_3_until"].filter(k=>r.originalData?.[k]!==undefined).map(k=>[k,r.originalData[k]]))}));
    const own=players.findIndex(r=>r.account===account);
    if(currentAccount!==account || directory[own]?.roleid!==roleid)throw Error("角色已切换");
    const online=locks.held.filter(r=>r.name.startsWith("qmqz-presence-")).map(r=>Number(r.name.slice(14)));
    const result=await runRules({action:"local-social",roleid,op,directory,online,social,gold:players[own].gold});
    if(currentAccount!==account)throw Error("角色已切换");
    const spent=result.speaker?.spent;
    const write=db.transaction(spent?["roles","matchReceipts"]:"matchReceipts","readwrite");
    if(spent){
      players[own].gold-=spent;
      write.objectStore("roles").put(players[own],keys[own]);
    }
    write.objectStore("matchReceipts").put(result.social,key);
    await new Promise((ok,no)=>{write.oncomplete=ok;write.onabort=()=>no(write.error);});
    if(op.id)socialBus.postMessage({roleid,wallet:!!spent});
    if(spent)window.qmqzProfileCommand("social-wallet","{}");
    return {receipts:result.receipts,history:result.history,chatOptions:result.chatOptions,speaker:result.speaker,directory:directory.map(({publicData,...r})=>({...r,vip:publicData.vipstatus||0}))};
  }

  async function profile(db, account, action = "state", fields = {}, reply = {}) {
    // Another tab may be using this character while the original rules run in the worker.
    return navigator.locks.request("qmqz-role-" + account, async () => {
      const index = db.transaction("roles").objectStore("roles").index("account");
      const [role,id] = await Promise.all([read(index.get(account)),read(index.getKey(account))]);
      if (!role) return null;
      const snapshot = publicRole(role,id);
      if(action==="social-wallet")return snapshot;
      if (action === "state" && role.originalData && role.rankWaitingType >= 0) action = "rank-cancel";
      // Derive newly projected equipment fields from the original save on its first read.
      if (action === "state" && role.originalData?.web_full_unlock_version >= 2 && role.equipment?.loadouts?.length &&
          Array.isArray(role.equipment.subjoins) && Number.isInteger(role.talentHp) &&
          role.equipment.loadouts.every(group => Number.isInteger(group.star) && typeof group.canRestoreDefaults==="boolean" &&
            group.slots?.every(slot=>slot && slot.itemId===slot.effectiveItemId))) return snapshot;
      const receiptKey = [id, fields.matchId || ""];
      const reviveKey = [...receiptKey, "challenge-revives"];
      const preparationKey = [...receiptKey, "challenge-preparation"];
      if (action === "challenge-start") {
        if (!fields.matchId) return snapshot;
        const receipts = db.transaction("matchReceipts").objectStore("matchReceipts");
        const [prior, settled] = await Promise.all([read(receipts.get(preparationKey)),read(receipts.get(receiptKey))]);
        if (settled) return snapshot;
        if (prior) {
          if (prior.roomId===fields.roomId && prior.ruleId===fields.ruleId) reply.preparation=prior.preparation;
          return snapshot;
        }
      }
      const ammoKey = [...receiptKey,"paid-ammo"];
      if(action==="paid-shot"){
        if(!fields.matchId || !Number.isSafeInteger(fields.shot) || fields.shot<1)return snapshot;
        const last=await read(db.transaction("matchReceipts").objectStore("matchReceipts").get(ammoKey));
        if(last && fields.shot<=last.shot){
          reply.accepted=fields.shot===last.shot && fields.ammoId===last.item && last.spent;
          return snapshot;
        }
      }
      let reviveDeaths;
      if (action === "challenge-revive") {
        if (typeof fields.matchId !== "string" || !fields.matchId || !Number.isSafeInteger(fields.death) || fields.death < 1 ||
            !Number.isSafeInteger(fields.ruleId) || !Number.isSafeInteger(fields.times)) return snapshot;
        const receipts = db.transaction("matchReceipts").objectStore("matchReceipts");
        const [settled, prior] = await Promise.all([read(receipts.get(receiptKey)), read(receipts.get(reviveKey))]);
        if (settled || (prior && prior.ruleId !== fields.ruleId)) return snapshot;
        reviveDeaths = prior?.deaths || [];
        if (reviveDeaths.includes(fields.death)) {
          reply.accepted = true;
          return snapshot;
        }
        if (fields.death < reviveDeaths.at(-1)) return snapshot;
      }
      if (action === "settle") {
        const receipt = await read(db.transaction("matchReceipts").objectStore("matchReceipts").get(receiptKey));
        if (receipt) return {...snapshot, reward:receipt};
      }
      const output = await runRules({profile:{...snapshot, originalData:role.originalData},
        action, fields, pending:role.pendingDouble, revivesUsed:reviveDeaths?.length});
      if (action === "bio-opening") {
        reply.opening = output;
        return snapshot;
      }
      if (action === "challenge-select") {
        reply.preparation=output.preparation;
        for(const message of output.messages)window.dispatchEvent(new CustomEvent("qmqz-protocol",{detail:message}));
        return snapshot;
      }
      if (action === "challenge-revive" && !output.reviveAccepted) return snapshot;
      Object.assign(role, output.values, {equipment:output.equipment, originalData:output.originalData,
        robotOpenId:output.robotOpenId,robotCleared:output.robotCleared, robotBestScore:output.robotBestScore,rankWaitingType:output.rankWaiting});
      if (action === "settle") {
        const detail = output.reward || output.messages.find(message => [1245215,1114129,1114130].includes(message.id))?.fields ||
          (fields.trainingLevel === -1 ? {exp:0,gold:0,bloodgem:0} : null);
        if (!detail) throw new Error("原版结算缺少奖励明细");
        const won = fields.gameMode === 4 ? fields.wonSolo : fields.side === fields.winnerSide;
        if (!fields.range) {
          role.matches = (role.matches ?? fields.previousMatches ?? 0) + 1;
          role.wins = (role.wins ?? fields.previousWins ?? 0) + Number(won);
        }
        role.reward = {matchId:fields.matchId,exp:detail.exp,gold:detail.gold,bloodGem:detail.bloodgem,doubled:false};
        if (fields.range) Object.assign(role.reward,{score:detail.score,nextgoal:detail.nextgoal,
          levelfrom:detail.levelfrom,levelto:detail.levelto});
        if (fields.trainingLevel > 0) role.reward.gem = detail.gem ?? 0;
        role.pendingDouble = output.pending;
      } else if (action === "double") {
        const reply = output.messages.find(message => message.id === 1245219)?.fields;
        if (reply?.retcode === 0 && role.reward) {
          role.reward = {...role.reward, doubled:true};
          role.pendingDouble = null;
        }
      }
      await new Promise((resolve,reject) => {
        const tx = db.transaction(["roles","matchReceipts"],"readwrite");
        tx.objectStore("roles").put(role,id);
        if (action === "challenge-start") tx.objectStore("matchReceipts").add(
          {roomId:fields.roomId,ruleId:fields.ruleId,preparation:output.preparation},preparationKey);
        if(action==="paid-shot")tx.objectStore("matchReceipts").put({shot:fields.shot,item:fields.ammoId,spent:output.spentAmmo},ammoKey);
        if (action === "settle") {
          tx.objectStore("matchReceipts").add(role.reward,receiptKey);
          if (fields.gameMode === 12) {
            tx.objectStore("matchReceipts").delete(reviveKey);
            tx.objectStore("matchReceipts").delete(preparationKey);
          }
        }
        if (action === "challenge-revive") tx.objectStore("matchReceipts").put(
          {ruleId:fields.ruleId, deaths:[...reviveDeaths, fields.death]}, reviveKey);
        if (action === "double" && role.reward?.doubled)
          tx.objectStore("matchReceipts").put(role.reward,[id,role.reward.matchId]);
        tx.oncomplete = resolve;
        tx.onabort = () => reject(tx.error);
      });
      if (action === "challenge-start") reply.preparation=output.preparation;
      if (action === "challenge-revive") reply.accepted = true;
      if (action === "paid-shot") reply.accepted=output.spentAmmo;
      if (output.messages.some(message=>message.id===1114137)) {
        const claimed=role.originalData?.online_reward?.got || [];
        window.dispatchEvent(new CustomEvent("qmqz-online-collected",{detail:claimed}));
      }
      for (const message of output.messages)
        window.dispatchEvent(new CustomEvent("qmqz-protocol",{detail:message}));
      return output.activity ? {...publicRole(role,id),activity:output.activity} : publicRole(role,id);
    });
  }

  async function createRole(db, fields) {
    if (!currentAccount) return { screen: "InitUI", loginResult: 2 };
    const name = String(fields.name || "").trim();
    if (!name || name.length > 8) return { screen: "CreateCharacter", createResult: 5 };
    let role = await profile(db, currentAccount);
    if (!role) {
      try {
        await insert(db, "roles", {
          name, account: currentAccount, iconid: Number(fields.iconid) || 0,
          policeactorid: Number(fields.policeactorid) || 0, terristactorid: Number(fields.terristactorid) || 0,
          inviterid: Number(fields.inviterid) || 0, level: 1, exp: 0, gold: 500, money: 10000, diamond: 500
        });
      } catch (error) {
        if (error.name !== "ConstraintError") throw error;
        role = await profile(db, currentAccount);
        if (!role) return { screen: "CreateCharacter", createResult: 1 };
      }
      role = await profile(db, currentAccount);
    }
    role = await profile(db,currentAccount,"menu",{view:"bonus-login"});
    localStorage.setItem(lastRoleKey,String(role.roleid-100000));
    return { screen: "MainUI", loginResult: 0, createResult: 0, profile: role };
  }

  window.qmqzProfileCommand = (action, json) => {
    let reply = {};
    queue = queue.then(async () => {
      const fields = JSON.parse(json);
      if (["bio-opening","challenge-select","challenge-start"].includes(action)) reply = {matchId:fields.matchId};
      if (action === "challenge-revive") reply = {matchId:fields.matchId, death:fields.death, accepted:false};
      if (action === "paid-shot") reply={matchId:fields.matchId,shot:fields.shot,accepted:false};
      const db = await openDatabase();
      if (action === "resume-local") return resumeLocal(db,fields.id);
      if (action === "create") return createRole(db, fields);
      if (!currentAccount) return { screen: "InitUI", loginResult: 2 };
      return { screen: "MainUI", profile: await profile(db, currentAccount, action, fields, reply) };
    }).catch(error => {
      console.error("本地游戏存档", error);
      return {screen:action === "resume-local" ? "InitUI" : action === "create" ? "CreateCharacter" : "MainUI", storageError:true};
    })
      .then(result => window.qmqzUnity.SendMessage("WebClient", "LocalProfileResult",
        JSON.stringify({ action, loginResult: -1, createResult: -1, ...reply, ...result })));
    return queue;
  };
})();
