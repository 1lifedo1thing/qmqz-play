(() => {
  "use strict";
  const menu = document.querySelector("#original-menu");
  const stage = document.querySelector("#original-stage");
  const drawings=document.createElement("div"), fieldLayer=document.createElement("div");
  drawings.className="ngui-drawings";fieldLayer.className="ngui-fields";
  stage.append(drawings,fieldLayer);
  const records = new Map();
  const images = new Map();
  const values = {name: ""};
  const anchors = [[-1,-1],[-1,0],[-1,1],[0,1],[1,1],[1,0],[1,-1],[0,-1],[0,0]];
  let state = window.qmqzLastState || {};
  let view = "", dialog = false, revision = 0, ready = false;
  let quickId = Number(localStorage.getItem("QMQZ.quickMode") || 1);
  let selectedRoom = null;
  let page = 0, dialogScroll = 0, family = 1;
  let rangeResultClock = {};
  let storeModalClock = {};
  const rangeCloseReady = () => rangeResultClock.start!==undefined && performance.now()-rangeResultClock.start>=1000;
  const defaults = {x:.2,y:.175,pad:.6};
  const axisValue = axis => Number(state["sensitivity"+({x:"X",y:"Y",pad:"Pad"}[axis])] ?? defaults[axis]);
  function openDialog(name) {
    if(name==="PackItem"||name==="StoreItemDetails")storeModalClock={};
    dialog=name; dialogScroll=0; family=1; render();
  }
  function closeDialog() {
    const parent=["StoreItemDetails","PackItem","PrizeInfo"].includes(dialog) && qmqzStoreItems.previous();
    dialog=parent||false;render();
  }
  function setSlider(axis,value) {
    value=Math.max(0,Math.min(1,value));
    if(axis==="music" || axis==="effects") {
      window.qmqzVolume.set(axis,value);
      render();
    } else command("sensitivity-"+axis+":"+value.toFixed(4));
  }
  let entryRoles, entering = false;
  const switcher = document.querySelector("#local-roles");
  const choices = document.querySelector("#role-choices");
  const switchRole = document.querySelector("#switch-role");

  function chooseRole(open) {
    choices.hidden = !open;
    switchRole.setAttribute("aria-expanded", String(open));
    if(open) choices.querySelector("button")?.focus();
  }
  async function enterRole(id) {
    if(entering) return;
    if(!id && entryRoles.roles.length>1) { chooseRole(true); return; }
    entering=true;
    try {
      await window.qmqzProfileCommand("resume-local", JSON.stringify({id:id || 0}));
    } finally { entering=false; }
  }
  switchRole.onclick=()=>chooseRole(choices.hidden);
  switcher.onkeydown=e=>{
    if(e.key==="Escape") { chooseRole(false); switchRole.focus(); }
  };
  let currentScale=1;
  let localWindow="", lineOffset=0, resultTab="record";
  let lastRoom, robotResultScrollMax=0, callboard=0, callboardArg="",callboardTimer,callboardSince=0;
  function notify(code,arg="") {
    callboardArg=arg;callboard=code;callboardSince=performance.now();clearTimeout(callboardTimer);render();
    callboardTimer=setTimeout(()=>{callboard=0;render();},code===302?3000:2300);
  }
  function go(name) { localWindow=name; dialog=false; callboard=0;clearTimeout(callboardTimer); lineOffset=0; render(); }
  let lastTouchScroll=0;
  const inventory=window.qmqzInventory;
  const inventoryViews=["EquipWindow","DepotWindow","BarrackWindow"];
  const upgradeViews=["UpgradeListWindow","NewPromoteWindow","PromoteWindow"];
  const posterViews=["FusionWindow","ActivityForm","MyCardWindow"];
  const resource = (name) => "original-ui/" + name;
  const availableHead = id => (id>=1 && id<=38) || (id>=1001 && id<=1004) || (id>=10001 && id<=10003);
  function data(name) {
    if (!records.has(name)) records.set(name, fetch(resource(name + ".json")).then(r => {
      if (!r.ok) throw Error(r.url);
      return r.json();
    }).then(async rows=>{
      if(Array.isArray(rows) && rows[0] && Object.hasOwn(rows[0],"parent")) {
        const bindings=(await data("button-feedback"))[name];
        if(bindings)for(const row of rows)Object.assign(row,bindings[row.id]);
      }
      return rows;
    }).catch(error=>{records.delete(name);throw error;}));
    return records.get(name);
  }
  async function loadImage(name) {
    const image = await window.qmqzUiDensity.load(resource(name));
    images.set(name,image);
  }
  const command = value => window.qmqzUnity?.SendMessage("WebClient", "Command", value);
  const color = c => "rgba(" + [c[0], c[1], c[2], c[3]/255].join(",") + ")";
  const pick = rows => rows[Math.floor(Math.random()*rows.length)];
  function randomName(parts) {
    let name;
    do { name = pick(parts[0]) + pick(parts[1]); } while (name.length >= 8);
    return name;
  }
  function setQuick(id) {
    quickId = id;
    localStorage.setItem("QMQZ.quickMode", String(id));
    dialog = false;
    if(id===1){window.qmqzOfflineModes.rank(0);go("QualifyingWindow");command("original-rank-ready:0");return;}
    command("original-quick:" + id);
    render();
  }
  function create() {
    const input=fieldLayer.querySelector("[name='name']");if(input)values.name=input.value;
    if (!values.name || values.name === "请在此输入您的昵称" || values.name.length > 8) {
      notify(values.name.length>8 ? 432 : 395);
      return;
    }
    command("original-create:" + JSON.stringify({name: values.name,
      iconid: 1 + Math.floor(Math.random()*8), policeactorid: 101, terristactorid: 201, inviterid: 0}));
  }
  function clonePrefab(nodes, prefix, parent, y, labelById, options={}) {
    return nodes.map(n => {
      const copy = {...n, id:prefix+n.id, parent:n.parent ? prefix+n.parent : parent};
      for(const key of ["buttonColor","buttonSprite"])if(n[key])copy[key]={...n[key],target:prefix+n[key].target};
      if (!n.parent) { copy.p = [0,y]; Object.assign(copy,options); }
      if (n.widget && Object.hasOwn(labelById,n.id)) copy.widget = {...n.widget,text:String(labelById[n.id]??"")};
      return copy;
    });
  }
  const nodeById = (nodes,id) => nodes.find(n => n.id === id);
  const edit = (nodes,id,fields) => { const n=nodeById(nodes,id); if (n) Object.assign(n,fields); };
  const label = (nodes,id,text) => {
    const n=nodeById(nodes,id);
    if (n?.widget) n.widget={...n.widget,text:String(text??"")};
  };
  const picture = (nodes,id,image) => {
    const n=nodeById(nodes,id);
    if(n?.widget && image) n.widget={...n.widget,image,fitWeapon:/^(?:Icon_(?:WP_|DG_|Axe[._]|Grenade_|Launcher_)|Sketch_|Grenade_)/i.test(image)};
  };
  async function entryContent() {
    entryRoles = await window.qmqzLocalRoles();
    const nodes=(await data("EnterGame")).filter(n=>[60,144,143,142,"mainData-31"].includes(n.id)).map(n=>({...n}));
    const play=nodeById(nodes,144);
    Object.assign(play,{parent:60,p:[0,-287],action:()=>enterRole(entryRoles.last),label:"进入游戏"});
    const poster=nodeById(nodes,"mainData-31");
    poster.widget={...poster.widget,image:"entry-poster.webp",uvScale:null};
    nodes.unshift({id:"poster-enter",parent:60,name:"EntryPoster",entryPoster:true,active:true,
      p:[0,0],s:[1,1],z:0,hit:[0,0,1280,720],label:"点击海报进入游戏",action:play.action});
    if(entryRoles.roles.length>1) {
      const buttons=entryRoles.roles.map(role=>{
        const b=document.createElement("button");
        b.type="button"; b.textContent=role.name; b.dataset.roleId=role.id;
        b.setAttribute("aria-pressed",String(role.id===entryRoles.last));
        b.onclick=()=>enterRole(role.id);
        return b;
      });
      choices.replaceChildren(...buttons);
    }
    return nodes;
  }
  async function content(screen) {
    if(screen==="InitUI")return entryContent();
    let nodes = (await data(screen)).map(n => ({...n}));
    const socialHooks={data,edit,label,picture,nodeById,clonePrefab,go,render,notify,values,availableHead};
    if(qmqzSocial.modals[screen]){
      const base=(await content(qmqzSocial.parent(screen))).map(n=>({...n,action:null,field:null,slide:null}));
      const modal=nodes.filter(n=>!nodeById(base,n.id)).map(n=>({...n,overlay:true}));
      edit(modal,qmqzSocial.modals[screen],{active:true});
      await qmqzSocial.display(screen,modal,state,socialHooks);
      return base.concat(modal);
    }
    if (screen==="Exhibition") {
      await qmqzExhibition.display(nodes,{data,edit,label,picture,nodeById,clonePrefab,go,render,command},state);
      return nodes;
    }
    if(screen==="RolePurchase"){
      await qmqzRoleMedia.display(nodes,state,{data,edit,label,picture,nodeById,go,render,notify,openDialog,command},screen);
    }
    if (screen === "CreateCharacter") {
      const parts = await data("names");
      if (!values.name && view !== screen) values.name = randomName(parts);
      edit(nodes,28,{field:"name"});
      edit(nodes,62,{action:() => { values.name=randomName(parts); const input=stage.querySelector("[name=name]"); if(input) input.value=values.name; }});
      edit(nodes,48,{action:create});
      for (const [id,image] of [[46,"A_M_1.png"],[34,"R_M_1.png"]]) {
        const n = nodeById(nodes,id); n.widget={...n.widget,image};
      }
    }
    if (screen === "MainUI") {
      edit(nodes,5034,{label:"公告",action:()=>qmqzAnnouncements.open(openDialog)});
      if(dialog==="Annoncement")await qmqzAnnouncements.display(nodes,{data,edit,label,picture,nodeById,clonePrefab,go,render,openDialog,closeDialog});
      edit(nodes,2780,{action:()=>window.qmqzRoulette.first(go,openDialog)});
      if(dialog==="FirstRechargeInfo")await window.qmqzRoulette.firstDialog(nodes,{data,edit,label,nodeById,go,closeDialog});
      edit(nodes,2983,{action:()=>window.qmqzBonuses.open(go)});
      edit(nodes,7165,{active:(state.profile?.level||1)<30,action:()=>openDialog("LevelUpBouns")});
      edit(nodes,389,{action:window.qmqzPosters.open,label:"大厅海报"});
      edit(nodes,6698,{action:()=>window.qmqzStore.recharge(go,"MainUI")});
      edit(nodes,5560,{action:()=>{inventory.begin();go("EquipWindow");}});
      edit(nodes,6751,{action:()=>{inventory.begin();go("BarrackWindow");}});
      const modes = await data("quick-games");
      label(nodes, 6538, modes.find(m => m.id===quickId)?.name);
      edit(nodes,4047,{action:() => openDialog("QuickMode")});
      edit(nodes,3083,{action:() => setQuick(quickId)});
    }
    if ((screen==="MainUI" || screen==="LobbyWindow") && dialog==="QuickMode") {
        const options=await data("quick-games");
        const modes=screen==="LobbyWindow" ? options.filter(m=>!m.rank) : options;
        const modal = (await data("QuickMode")).filter(n=>!nodeById(nodes,n.id)).map(n => ({...n,overlay: true}));
        edit(modal,8818,{active:true});
        const modeGrid=nodeById(modal,2012);modeGrid.p=[modeGrid.p[0],modeGrid.p[1]+dialogScroll];
        const rows=await data("QuickModeItem");
        nodes=nodes.concat(modal);
        modes.forEach((m,i) => nodes.push(...clonePrefab(rows, "mode"+i+"-",2012,-i*110,{1607:m.name},
          {action:() => {
            if(screen!=="LobbyWindow"){setQuick(m.id);return;}
            quickId=m.id;localStorage.setItem("QMQZ.quickMode",String(m.id));
            dialog=false;page=0;selectedRoom=null;command("original-room-filter:"+m.id);render();
          }, quickMode:m.id, label:m.name})));
    }
    if (["LobbyWindow","TableWindow","LineWindow","NewBattleWindow","OfflineWindow","QualifyingWindow","BotLevelWindow","BotRoomWindow",...inventoryViews,...qmqzSocial.windowNames,...posterViews,"PrizeWindow",...upgradeViews,"TalentWindow"].includes(screen)) {
      const shell = (await data("MainUI")).filter(n=>!nodeById(nodes,n.id)).map(n=>({...n}));
      const whitelist = new Set([7805,8632,3106]);
      const rootOf = n => !n ? false : whitelist.has(n.id) || rootOf(shell.find(a=>a.id===n.parent));
      nodes.push(...shell.filter(rootOf));
      edit(nodes,6639,{active:true}); edit(nodes,1433,{active:true}); edit(nodes,7478,{active:true});
      const roots={SocialWindow:8074,FriendWindow:505,TalentWindow:8124,PrizeWindow:5647,UpgradeListWindow:6402,NewPromoteWindow:102,PromoteWindow:5852,NewBattleWindow:837,OfflineWindow:4333,LineWindow:6759,EquipWindow:4147,DepotWindow:3351,BarrackWindow:7145,QualifyingWindow:2386,BotLevelWindow:2818,BotRoomWindow:5478,FusionWindow:6692,ActivityForm:8393,MyCardWindow:8099};
      edit(nodes,roots[screen],{active:true});
      const parentScreen={SocialWindow:"MainUI",FriendWindow:"SocialWindow",PrizeWindow:"MainUI",OfflineWindow:"NewBattleWindow",QualifyingWindow:"NewBattleWindow",BotLevelWindow:"OfflineWindow",BotRoomWindow:"BotLevelWindow",BarrackWindow:"MainUI",EquipWindow:"MainUI",DepotWindow:"EquipWindow"};
      const child=screen!=="NewBattleWindow";
      edit(nodes,2684,{active:child,action:()=>posterViews.includes(screen)?go("MainUI"):parentScreen[screen] ? go(parentScreen[screen]) : command("original-back")});
      edit(nodes,4890,{active:!child});
      if(["QualifyingWindow","BotLevelWindow","BotRoomWindow"].includes(screen))await window.qmqzOfflineModes.render(screen,nodes,state,{data,edit,label,picture,nodeById,clonePrefab,command,go,notify,openDialog,closeDialog,dialog,redraw:render});
      if(qmqzSocial.windowNames.includes(screen))await qmqzSocial.display(screen,nodes,state,socialHooks);
      if(inventoryViews.includes(screen)) await inventory.display(screen,nodes,state,{data,edit,label,picture,nodeById,clonePrefab,go,command,render,openDialog,closeDialog,dialog,notify});
      if(upgradeViews.includes(screen))await qmqzUpgrade.display(screen,nodes,state.profile,{data,edit,label,picture,nodeById,render,clonePrefab,dialog,openDialog,closeDialog,go,notify});
      if(screen==="PrizeWindow")await window.qmqzBonuses.display(nodes,state.profile,{data,edit,label,picture,nodeById,render,clonePrefab,go,openDialog,closeDialog,dialog,notify});
      if(screen==="TalentWindow")await qmqzTalent.display(nodes,state.profile,{data,edit,label,picture,nodeById,render,clonePrefab,dialog,openDialog,closeDialog,go,notify});
      if(posterViews.includes(screen))await window.qmqzPosters.display(screen,nodes,state.profile,
        {data,edit,label,picture,nodeById,render,clonePrefab,dialog,openDialog,closeDialog,go,notify});
      if (screen === "LobbyWindow") {
        const rooms=state.rooms || [];
        if (!rooms.some(r=>r.roomId===selectedRoom)) selectedRoom=rooms[0]?.roomId;
        const selected=rooms.find(r=>r.roomId===selectedRoom);
        const text=await data("strings");
        const line=Number(state.line??0);
        label(nodes,2539, line===0 ? text[189] : line===1 ? "高手线" : line); label(nodes,2037,rooms.length); label(nodes,318,selected?.mapName);
        if(selected?.mapId) picture(nodes,6347,"map-"+selected.mapId+".png");
        edit(nodes,2294,{action:()=> selectedRoom != null && command("original-join:"+selectedRoom)});
        edit(nodes,6243,{action:()=>openDialog("ModeCreate")});
        edit(nodes,3114,{action:()=>openDialog("QuickMode")});
        const modes=await data("quick-games");
        label(nodes,7102,modes.find(m=>m.id===state.quickMode)?.name);
        edit(nodes,2062,{action:async ()=>{
          const items=(await data("inventory")).items;
          const equipped=(state.profile?.equipment?.loadouts || []).flatMap(set=>set.slots || []);
          const allowed=limit=>limit<=2 || (limit===3 && equipped.some(s=>s.position===41)) ||
            ([4,5].includes(limit) && equipped.some(s=>s.position===11 && items.find(i=>i.id===s.itemId)?.subType===(limit===4?16:12)));
          const available=rooms.find(r=>r.players<r.capacity && allowed(r.equiplimitid));
          if(available)command("original-join:"+available.roomId);
        }});
        const rows=await data("BattleListItem");
        const highlight=await data("ShopHighlight");
        const grid=nodeById(nodes,8897);
        const visible=4;
        page=Math.min(Math.max(0,rooms.length-visible),page);
        rooms.slice(page,page+visible).forEach((room,i)=>{
          const prefix="room"+i+"-";
          nodes.push(...clonePrefab(rows,prefix,grid.id,-i*96,{
            1213:room.title,1270:room.mapName,1361:room.creator,1144:room.modeName,
            1319:room.status===1?text[164]:text[165],1395:room.players+"/"+room.capacity
          },{action:()=>{selectedRoom=room.roomId;render();},roomId:room.roomId,label:room.title}));
          if(room.roomId===selectedRoom) nodes.push(...clonePrefab(highlight,prefix+"selected-",prefix+"1453",0,{}, {s:rows.find(n=>!n.parent).hit.slice(2)}));
        });
      } else if(screen==="NewBattleWindow") {
        edit(nodes,1064,{action:()=>{localWindow="";command("original-show-lines");}});
        edit(nodes,6937,{action:()=>go("OfflineWindow")});
        for(const [id,type] of [[2449,0],[803,1]])edit(nodes,id,{action:()=>{window.qmqzOfflineModes.rank(type);go("QualifyingWindow");}});
      } else if(screen==="OfflineWindow") {
        edit(nodes,8552,{action:()=>{window.qmqzOfflineModes.reset();go("BotLevelWindow");}});
        edit(nodes,6135,{action:()=>command("original-range")});
      } else if(screen==="LineWindow") {
        const [rows,text]=await Promise.all([data("LineListItem"),data("strings")]);
        const grid=nodeById(nodes,6944);
        grid.p=[grid.p[0]-lineOffset,grid.p[1]];
        edit(nodes,325,{action:()=>command("original-show-lines")});
        (state.lines||[]).forEach((line,i)=>{
          const prefix="line"+i+"-", fraction=line.maxRoom?line.roomCount/line.maxRoom:0;
          const name=line.line===0 ? text[189] : line.line===1 ? "高手线" : text[175].replace("{0}",line.line);
          const copy=clonePrefab(rows,prefix,6944,0,{1398:name,1323:text[fraction<.25?78:fraction>.25&&fraction<.5?79:80]},
            {p:[160*i,0],line:line.line,label:name,action:()=>command("original-line:"+line.line)});
          const bar=nodeById(copy,prefix+1147);bar.s=[bar.s[0],bar.s[1]*fraction];
          nodes.push(...copy);
        });
      } else if(screen==="TableWindow") {
        edit(nodes,5522,{action:()=>command("original-ready")});
        const room=state.room || {};
        const text=await data("strings");
        label(nodes,4399,room.mapName); label(nodes,7812,room.title); label(nodes,1347,room.isOwner ? text[125] : text[124]); label(nodes,3050,room.capacity);
        // RoomWindow.SynControls uses Judger.IsSingle for the title only. BattleSide still owns its cards.
        const single = [4, 8, 10, 12].includes(room.gameMode);
        edit(nodes,7869,{active:!single});
        edit(nodes,6404,{active:single});
        const special = room.equiplimitid && room.gameMode !== 13
          ? (await data("offline-modes")).special.find(rule => rule.id === room.equiplimitid)
          : null;
        label(nodes,4220,special?.name || room.modeName);
        // Local practice rooms have no password (CurrentRoom.Password, Concept 52).
        label(nodes,1127,"****");
        if(room.mapId) picture(nodes,5392,"map-"+room.mapId+".png");
        if(room.isOwner) {
          edit(nodes,7532,{action:()=>command("original-map-prev")});
          edit(nodes,647,{action:()=>command("original-map-next")});
          edit(nodes,8279,{action:()=>openDialog("ModeSelectNew")});
        }
        for(const side of nodes.filter(n=>n.BattleSide)) {
          side.BattleSide.members.forEach((id,slot)=>{
            const item=nodeById(nodes,id)?.MemberSideItem;
            if(!item) return;
            const player=(room.members||[]).find(m=>m.side===side.BattleSide.side&&m.slot===slot);
            edit(nodes,item.chatObject,{active:false});
            edit(nodes,item.addPlayer,{active:!player}); edit(nodes,item.playerCard,{active:!!player});
            if(!player)return;
            const card=nodeById(nodes,item.playerCard)?.PlayerCard;
            if(!card)return;
            label(nodes,card.playerName,player.name); label(nodes,card.level,player.level);
            const isSelf=player.roleid===state.profile?.roleid;
            if(isSelf) {
              const name=nodeById(nodes,card.playerName);
              name.widget={...name.widget,color:[255,220,0,255]};
            }
            if(availableHead(player.iconid)) picture(nodes,card.head,"head-"+player.iconid+".png");
            if(player.level>=1 && player.level<=120) picture(nodes,card.rank,"rank-"+player.level+".png");
            edit(nodes,card.ready,{active:!!player.ready});
            edit(nodes,card.ownerState,{active:!!room.isOwner&&isSelf});
            edit(nodes,card.monthCard,{active:false}); edit(nodes,card.vipLevel,{active:false});
          });
        }
      }
    }
    if(["GachaWindow","StoreWindow","RechargeWindow","RouletteWindow","WeekCardWindow"].includes(screen))await window.qmqzStore.display(screen,nodes,state,{data,edit,label,picture,clonePrefab,nodeById,command,go,openDialog,closeDialog,dialog,notify,redraw:render});
    if(dialog==="PackItem"||dialog==="StoreItemDetails"){
      const modal=(await data("PackItem")).filter(n=>!nodeById(nodes,n.id)).map(n=>({...n,overlay:true,modalFade:storeModalClock}));
      const h={data,edit,label,picture,nodeById,go,openDialog,closeDialog,notify,redraw:render};
      if(dialog==="PackItem")await qmqzRoleMedia.display(modal,state,h,"PackItem");
      else await qmqzStoreItems.display(modal,state,{...h,catalog:await data("inventory")});
      nodes.push(...modal);
    }
    if(state.profile && ["MainUI","LobbyWindow","TableWindow","NewBattleWindow","OfflineWindow","LineWindow","QualifyingWindow","BotLevelWindow","BotRoomWindow",...inventoryViews,...qmqzSocial.windowNames,...posterViews,"PrizeWindow",...upgradeViews,"TalentWindow"].includes(screen)) {
      const profile=state.profile;
      label(nodes,3964,profile.name); label(nodes,1158,profile.level);
      label(nodes,2201,profile.gold); label(nodes,6612,profile.money); label(nodes,4952,profile.diamond);
      edit(nodes,3102,{label:"钻石充值",action:()=>window.qmqzStore.recharge(go,screen)});
      edit(nodes,7420,{label:"荣誉兑换",action:()=>window.qmqzStore.recharge(go,screen,1)});
      if(availableHead(profile.iconid)) picture(nodes,6214,"head-"+profile.iconid+".png");
      if(profile.level>=1 && profile.level<=120) picture(nodes,5784,"rank-"+profile.level+".png");
    }
    if(state.profile && nodeById(nodes,1987))await qmqzSocial.badge(nodes,state,socialHooks);
    if(nodeById(nodes,1841)){
      const {tabs,pages}=await data("window-navigation");
      const selected=tabs[pages[screen]]?pages[screen]:"Main";
      await Promise.all(Object.values(tabs).flatMap(tab=>tab.states.map(style=>loadImage(style.image))));
      const actions={Main:()=>go("MainUI"),NewBattle:()=>go("NewBattleWindow"),
        UpgradeList:()=>qmqzUpgrade.open(go),Social:()=>qmqzSocial.open("SocialWindow",socialHooks)};
      for(const [name,tab] of Object.entries(tabs)){
        const style=tab.states[Number(name===selected)];
        picture(nodes,tab.icon,style.image);
        picture(nodes,tab.background,style.plate);
        const label=nodeById(nodes,tab.label);
        label.widget={...label.widget,color:style.color,foot:style.foot,shadow:style.shadow};
        let shown=style;
        edit(nodes,tab.button,{action:actions[name],onButtonState:(pressed,art)=>{
          const next=pressed?tab.states[1]:style;
          if(next===shown)return;
          shown=next;
          art.get(tab.icon).style.backgroundImage='url("'+images.get(next.image).src+'")';
          const text=art.get(tab.label);
          text.textContent=label.widget.text;
          text.style.color=color(next.color);
          qmqzFonts.label(text,{...label.widget,foot:next.foot,shadow:next.shadow},parseFloat(text.style.fontSize),next.color);
        }});
      }
    }
    edit(nodes,8808,{action:()=>qmqzSocial.openChat(screen,0,socialHooks)});
    edit(nodes,5082,{action:()=>window.qmqzStore.gacha(go,screen)});
    edit(nodes,4664,{action:()=>qmqzTalent.open(state.profile,go,notify)});
    edit(nodes,2364,{action:()=>window.qmqzPosters.destination("MyCardWindow",go)});
    edit(nodes,4890,{action:()=>openDialog("GameOptions")});
    if(dialog==="LevelUpBouns") {
      const [template,rewards,strings]=await Promise.all([data("LevelUpBouns"),data("bonus-rewards"),data("strings")]);
      const bonus=rewards.levels.find(it=>it.id>(state.profile?.level||1));
      if(bonus) {
        const overlay=template.filter(n=>!nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
        edit(overlay,7486,{active:true});
        edit(overlay,783,{action:closeDialog});
        const image=nodeById(overlay,8469);
        image.widget={...image.widget,image:bonus.image};
        label(overlay,1826,bonus.days?strings[30012].replace("{0}",bonus.name).replace("{1}",bonus.days):bonus.name);
        label(overlay,5418,strings[30011].replace("{0}",bonus.id));
        nodes.push(...overlay);
      }
    }
    if(dialog==="PvEReward")await qmqzChallengeCards.display(nodes,state,{data,edit,label,picture,nodeById,command,closeDialog,notify,render});
    if(dialog==="RewardDialog") {
      const overlay=(await data("RewardDialog")).filter(n=>!nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
      edit(overlay,6501,{active:true}); nodes.push(...overlay);
      const result=state.result||{}, bio=[8,10].includes(result.gameMode);
      const text=await data("room-modes");
      label(nodes,273,text.modes.find(m=>m.id===result.gameMode)?.name);
      const fighters=result.fighters||[], me=fighters.find(f=>f.nickname===state.profile?.name)||fighters[0];
      const human=result.winner==="human";
      edit(nodes,2558,{active:bio&&human});edit(nodes,3576,{active:bio&&!human});edit(nodes,5111,{active:!bio});
      const lost=result.gameMode===4?state.winnerSlot!==0:me && result.winner!==me.side;
      if(!bio && lost) picture(nodes,5111,nodeById(nodes,5111)?.widget?.defeatImage);
      label(nodes,6468,result.score??me?.score);label(nodes,5289,result.exp);label(nodes,4114,result.gold);label(nodes,662,result.bloodGem);
      const {doubleCost}=await data("offline-modes");
      edit(nodes,1880,{active:!result.doubled,action:()=>{qmqzRewardMotion.double(); render();command("original-double-reward");}});label(nodes,5039,doubleCost);edit(nodes,8269,{active:false});edit(nodes,517,{active:false});
      edit(nodes,7030,{active:resultTab==="record"});edit(nodes,2729,{active:resultTab==="loss"});
      edit(nodes,4610,{action:()=>{resultTab="record";qmqzRewardMotion.select(4610);render();}});
      edit(nodes,7892,{action:()=>{resultTab="loss";qmqzRewardMotion.select(7892);render();}});
      edit(nodes,8092,{action:()=>{command("original-close-result");closeDialog();}});
      qmqzRewardMotion.attach(nodes,await data("reward-particles"),result);
      const resultGrid=nodeById(nodes,6876);resultGrid.p=[resultGrid.p[0],resultGrid.p[1]+dialogScroll];
      const rows=await data("BattleRecordListItem");
      fighters.forEach((f,i)=>{
        const prefix="score"+i+"-";
        const copy=clonePrefab(rows,prefix,6876,-60*i,{1148:f.nickname,1218:f.kills,1275:f.deaths,1524:f.score});
        for(const id of [1454,1510,1575])edit(copy,prefix+id,{active:false});
        edit(copy,prefix+1324,{active:f.nickname===state.profile?.name});
        const member=lastRoom?.members?.find(m=>m.name===f.nickname);
        if(availableHead(member?.iconid)) picture(copy,prefix+1399,"head-"+member.iconid+".png");
        nodes.push(...copy);
      });
    }
    if(["ScoreDialog","RewardRobotDialog","LevelUp"].includes(dialog)) {
      const overlay=(await data(dialog)).filter(n=>!nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
      const [tables,strings]=await Promise.all([data("offline-modes"),data("strings")]);
      const close=()=>{command("original-close-result");closeDialog();};
      const r=state.result||{};
      const format=(key,...args)=>strings[key].replace(/\{(\d+)\}/g,(_,index)=>String(args[Number(index)]??""));
      if(dialog==="ScoreDialog") {
        edit(overlay,2253,{active:true});
        const award=state.profile?.reward||{},score=award.score??r.score;
        label(overlay,4822,format(294,score));label(overlay,7622,format(295,Math.max(score,r.previousHigh||0)));
        label(overlay,7647,r.breaks);label(overlay,8562,r.hitRate);label(overlay,6380,r.crazes);
        label(overlay,8869,strings[296]);
        for(const id of [8863,8622])edit(overlay,id,{active:!!r.newRecord});
        // The APK's local robot.on_range_result sends nextgoal as a score and both levels as next-unclaimed ranks.
        const cleared=Math.max(0,award.levelto-award.levelfrom)||0;
        label(overlay,8241,award.nextgoal>0?format(297,award.nextgoal):strings[299]);
        edit(overlay,8022,{active:cleared>0});edit(overlay,8241,{active:!cleared});
        label(overlay,8022,`本次突破[aadd00]${cleared}[-]档，获得经验[aadd00]${award.exp}[-]，金币[aadd00]${award.gold}[-]，荣誉[aadd00]${award.bloodGem}[-]！`);
        // ScoreDialog.StartAnimaton sequences title, best and the three statistics before its high-score effect.
        for(const [id,delay,from,to] of [[4822,0,48,24],[7622,700,48,24],[7647,1400,80,30],[8562,1900,80,30],[6380,2400,80,30]]){
          edit(overlay,id,{s:[to,to],sequence:{name:"range-score",clock:rangeResultClock,delay,duration:500,
            frames:[{opacity:0,transform:"scale("+from/to+")"},{opacity:1,transform:"scale(1)"}]}});
        }
        const particles=await data("range-particles");
        qmqzMenuFX.particle(overlay,particles,"ScoreDialog-EFF",2253,rangeResultClock,2900,
          {offset:nodeById(overlay,7622).p,hideAfter:particles["ScoreDialog-EFF"].frames*50});
        for(const id of [1340,3147])edit(overlay,id,{action:()=>{if(rangeCloseReady())close();}});
      } else if(dialog==="RewardRobotDialog") {
        edit(overlay,3751,{active:true});edit(overlay,4646,{action:close});
        const rows=await data("BotBattleRecordListItem");
        const prize=[[r.gold,150],[r.bloodGem,454],[r.gem,151]].find(([amount])=>amount>0);
        label(overlay,2007,r.score);
        edit(overlay,8158,{active:!!prize});
        if(prize){
          label(overlay,8485,format(301,r.trainingLevel,prize[0],strings[prize[1]],r.exp));
          const next=tables.levels.find(l=>l.id===r.trainingLevel+1);
          label(overlay,2826,next?format(315,next.id,next.name):"");
        }
        const fighters=r.fighters||[];
        const me=fighters[0];
        const lost=r.gameMode===4?state.winnerSlot!==0:me && r.winner!==me.side;
        if(lost)picture(overlay,7383,nodeById(overlay,7383)?.widget?.defeatImage);
        // RewardRobotDialog leaves BattleRecordItemData.mode at zero for all training rows.
        const records=[...fighters].sort((a,b)=>
          (a.side!=="police")-(b.side!=="police") ||
          b.kills-a.kills || a.deaths-b.deaths || b.score-a.score || b.equipScore-a.equipScore);
        const grid=nodeById(overlay,5629);
        robotResultScrollMax=Math.max(0,records.length*grid.cellHeight-nodeById(overlay,1455).clip[3]);
        grid.p=[grid.p[0],grid.p[1]+dialogScroll];
        records.forEach((f,i)=>{
          const prefix="botResult"+i+"-";
          const row=clonePrefab(rows,prefix,5629,-grid.cellHeight*i,{1069:f.deaths,1145:f.kills,1214:f.nickname,1320:f.equipScore}, {overlay:true});
          const bg=nodeById(row,prefix+982);
          const team=f.side==="police"?"police":"terrorist";
          bg.widget={...bg.widget,...bg.widget.teamBackgrounds[team]};
          const color=f===me?[255,220,0,255]:team==="police"?[0,180,194,255]:[255,0,0,255];
          for(const id of [1069,1145,1214,1320]) {
            const label=nodeById(row,prefix+id);
            label.widget={...label.widget,color};
          }
          const mark=nodeById(row,prefix+1428);
          mark.active=f.kills>=20 && f.deaths<=Math.floor(f.kills*0.1);
          if(mark.active) {
            const grade=(f.kills>=30?3:1)+(f.deaths<=0?1:0);
            mark.widget={...mark.widget,image:mark.widget.gradeImages[grade-1]};
          }
          const member=lastRoom?.members?.[fighters.indexOf(f)];
          if(member?.iconid)picture(row,prefix+1362,"head-"+member.iconid+".png");
          if(member?.level)picture(row,prefix+1271,"rank-"+member.level+".png");
          overlay.push(...row);
        });
      } else {
        edit(overlay,8919,{active:true});
        const level=state.profile?.level;
        label(overlay,148,tables.ranks[level]);if(level>=1 && level<=120)picture(overlay,6747,"rank-"+level+".png");
        label(overlay,455,r.levelDetails || strings[388]);
        edit(overlay,7310,{action:close});
      }
      nodes.push(...overlay);
    }
    if(dialog==="ModeCreate") {
      const overlay=(await data(dialog)).filter(n=>!nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
      const root=overlay.find(n=>n.modeCreate);
      root.active=true;
      edit(overlay,root.modeCreate.close,{action:closeDialog});
      edit(overlay,root.modeCreate.pvpObj,{action:()=>command("original-room-create:1")});
      edit(overlay,root.modeCreate.pveObj,{action:()=>command("original-room-create:12")});
      nodes.push(...overlay);
    }
    if(dialog==="GameOptions" || dialog==="ModeSelectNew") {
      const overlay=(await data(dialog)).filter(n=>!nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
      edit(overlay,dialog==="GameOptions" ? 122 : 1519,{active:true});
      nodes.push(...overlay);
      if(dialog==="GameOptions") {
        edit(nodes,2282,{action:closeDialog});
        const content=nodeById(nodes,4439);
        content.p=[content.p[0],content.p[1]+dialogScroll];
        for(const n of overlay.filter(n=>n.ComplexSlider)) {
          const {style,slider,btnMinus,btnPlus}=n.ComplexSlider;
          const axis=["music","effects","x","y","pad"][style];
          const value=style<2?window.qmqzVolume.get(axis):axisValue(axis);
          const track=nodeById(nodes,slider), dims=track.hit;
          const thumb=nodeById(nodes,track.UISlider.thumb), fg=nodeById(nodes,track.UISlider.foreground);
          thumb.p=[dims[2]*value,thumb.p[1]]; fg.s=[293*value,fg.s[1]];
          edit(nodes,btnMinus,{action:()=>setSlider(axis,value-.02),axis:axis+"-minus"});
          edit(nodes,btnPlus,{action:()=>setSlider(axis,value+.02),axis:axis+"-plus"});
          edit(nodes,slider,{slide:axis,value});
        }
      } else {
        const config=await data("room-modes");
        const groups=await data("ModeFamilyItem"), modes=await data("ModeListItem");
        const offline=screen==="BotRoomWindow";
        const list=offline ? config.families.filter(f=>f.mode_offline._size||f.special_offline._size) : config.families;
        list.forEach((f,i)=>nodes.push(...clonePrefab(groups,"family"+i+"-",4801,-90*i,{1639:f.name},
          {action:()=>{family=f.id;render();},family:f.id,label:f.name})));
        const active=list.find(f=>f.id===family)||list[0];
        const group=offline?active.mode_offline:active.mode;
        const entries=group._items.slice(0,group._size);
        const specials=offline?(await data("offline-modes")).special:[];
        if(offline)entries.push(...active.special_offline._items.slice(0,active.special_offline._size).map(id=>-id));
        entries.forEach((id,i)=>{
          const mode=id<0?specials.find(m=>m.id===-id):config.modes.find(m=>m.id===id);
          if(!mode)return;
          const cloned=clonePrefab(modes,"rule"+i+"-",7164,-(i%3)*90,{1576:mode.name},
            {p:[Math.floor(i/3)*160,-(i%3)*90],modeId:id,label:mode.name,action:()=>{if(offline)window.qmqzOfflineModes.setMode(id<0?1:id,id<0?-id:0);else command("original-mode:"+id);closeDialog();}});
          edit(cloned,"rule"+i+"-1577",{active:!!mode.newMode});
          nodes.push(...cloned);
        });
      }
    }
    if(["GachaListDialog","PrizeInfo","QuickMode","Annoncement","BulletPurchase","ModeCreate","ConfirmBuy","PackItem","StoreItemDetails","GoRecharge","StoreReceipt","GachaPrize","OpenRoulette","RouletteHelp","WheelPrize","WheelDetail","ExchangeDialog","FirstRechargeInfo","ResearchPointsMaker","SplinterMaker","UpgradeConfirm","WeekReceipt","WeekUpgrade"].includes(dialog)) {
      const dimmer=(await data("UIDimmer")).filter(n=>!nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
      edit(dimmer,8896,{modalBackground:true,dismissBackground:["QuickMode","PackItem","StoreItemDetails"].includes(dialog)?closeDialog:null});
      if(dialog==="GachaPrize"){
        const bg=nodeById(dimmer,8896);
        bg.widget={...bg.widget,color:[255,255,255,219.140625]};
      }
      nodes.push(...dimmer);
    }
    if(callboard) {
      const text=await data("strings");
      nodes.push({id:"hud-message",parent:0,name:"HUDMessage",active:true,overlay:true,p:[0,0],s:[24,24],z:-100,
        widget:{kind:"UILabel",pivot:4,color:[255,255,255,255],depth:100,text:(typeof callboard==="string"?callboard:text[callboard]||"").replaceAll(/\{(\d+)\}/g,(_,i)=>Array.isArray(callboardArg)?callboardArg[+i]??"":+i===0?callboardArg:""),effect:callboard===302?0:2,shadow:[0,0,0,255],distance:[1,1]}});
    }
    return nodes;
  }

  function layout(nodes,width,height) {
    const byId=new Map(nodes.map(n=>[n.id,n]));
    const result=new Map();
    function place(n) {
      if(result.has(n.id)) return result.get(n.id);
      const p=byId.get(n.parent), parent=p ? place(p) : {x:0,y:0,z:0,sx:1,sy:1,active:true,overlay:false};
      const base=n.height || n.name==="Camera";
      let x=base?0:parent.x + n.p[0]*parent.sx, y=base?0:parent.y + n.p[1]*parent.sy;
      if(n.anchor!==undefined) {
        const a=anchors[n.anchor];
        x=(a[0]/2+n.offset[0])*width; y=(a[1]/2+n.offset[1])*height;
      }
      const world={x,y,z:parent.z+n.z,sx:base?1:parent.sx*n.s[0],sy:base?1:parent.sy*n.s[1],
        active:parent.active&&n.active,overlay:parent.overlay||n.overlay,clip:parent.clip,
        motion:n.motionDuration && n.action ? n : parent.motion, sequence:n.sequence ? n : parent.sequence,
        windowAnimator:n.windowAnimator || parent.windowAnimator};
      if(n.clip) world.clip={id:n.id,x:x+n.clip[0]-n.clip[2]/2,y:-y-n.clip[1]-n.clip[3]/2,w:n.clip[2],h:n.clip[3]};
      result.set(n.id,world); return world;
    }
    nodes.forEach(place);
    return result;
  }
  function box(el,x,y,w,h) {
    Object.assign(el.style,{left:x+"px",top:y+"px",width:w+"px",height:h+"px"});
  }
  let spriteFilters;
  function spriteTint([r,g,b]) {
    if(r===g && g===b)return r===255?"":"brightness("+r/255+")";
    const id="ngui-tint-"+r+"-"+g+"-"+b;
    if(!document.getElementById(id)) {
      const ns="http://www.w3.org/2000/svg";
      if(!spriteFilters) {
        const svg=document.createElementNS(ns,"svg");
        svg.setAttribute("width","0");svg.setAttribute("height","0");svg.setAttribute("aria-hidden","true");
        svg.style.position="absolute";svg.style.pointerEvents="none";
        spriteFilters=document.createElementNS(ns,"defs");
        svg.append(spriteFilters);menu.append(svg);
      }
      // A NGUI sprite multiplies each texture channel by its vertex color, including nine-sliced art.
      const filter=document.createElementNS(ns,"filter"),matrix=document.createElementNS(ns,"feColorMatrix");
      filter.id=id;filter.setAttribute("color-interpolation-filters","sRGB");
      matrix.setAttribute("type","matrix");
      matrix.setAttribute("values",[r/255,0,0,0,0, 0,g/255,0,0,0, 0,0,b/255,0,0, 0,0,0,1,0].join(" "));
      filter.append(matrix);spriteFilters.append(filter);
    }
    return "url(#"+id+")";
  }
  // UIButtonScale.OnPress and UIButtonOffset.OnPress both use UITweener method 0.
  const buttonCurve="linear("+Array.from({length:33},(_,i)=>{
    const t=i/32;
    return (t-Math.sin(t*2*Math.PI)/(2*Math.PI)).toFixed(5);
  }).join(",")+")";
  function widget(n,g) {
    const w=n.widget;
    const el=document.createElement("div"), a=w.color;
    const px=(w.pivot%3)/2, py=Math.floor(w.pivot/3)/2;
    const size=Math.abs(g.sy), width=Math.abs(g.sx);
    if(w.kind==="TalentGraph") {
      el.className="ngui-art";
      box(el,g.x-width/2,-g.y-size/2,width,size);
      el.style.clipPath="polygon("+w.vertices.map(([x,y])=>(50+50*x)+"% "+(50-50*y)+"%").join(",")+")";
      const ys=w.vertices.map(v=>(50-50*v[1]));
      el.style.background="linear-gradient(to bottom,rgba(0,255,255,.75) "+Math.min(...ys)+"%,rgba(0,128,232,.75) "+Math.max(...ys)+"%)";
    } else if(w.kind==="UILabel") {
      if(!w.text) return;
      el.className="ngui-label";
      const colors=[];
      for(const token of (w.encoding===false?[w.text]:w.text.split(/(\[(?:[0-9A-Fa-f]{6}|-)\])/g))) {
        if(w.encoding!==false && token==="[-]")colors.pop();
        else if(w.encoding!==false && /^\[[0-9a-f]{6}\]$/i.test(token))colors.push("#"+token.slice(1,-1));
        else if(colors.length){const span=document.createElement("span");span.style.color=colors.at(-1);span.textContent=token;el.append(span);}
        else el.append(document.createTextNode(token));
      }
      Object.assign(el.style,{left:g.x+"px",top:-g.y+"px",transform:"translate("+(-100*px)+"%,"+(-100*py)+"%)",
        color:color(a),fontSize:size+"px"});
      window.qmqzFonts.label(el,w,size,a);
    } else {
      if(!w.image) return;
      el.className="ngui-art";
      const image=images.get(w.image), density=Number(image.dataset.ratio);
      const url='url("'+image.src+'")';
      box(el,g.x-px*width,-g.y-py*size,width,size);
      if (w.border?.some(v=>v)) {
        el.style.borderStyle="solid"; el.style.borderColor="transparent";
        el.style.borderWidth=w.border.map(i=>i+"px").join(" ");
        // NGUI can stretch a single UV across the center. CSS drops the center when the slices meet.
        const [top,right,bottom,left]=w.border;
        const x=Math.min(1,(image.naturalWidth/density-1)/Math.max(1,right+left));
        const y=Math.min(1,(image.naturalHeight/density-1)/Math.max(1,top+bottom));
        el.style.borderImageSource=url;
        el.style.borderImageSlice=[top*y,right*x,bottom*y,left*x].map(v=>Math.floor(v)*density).join(" ")+" fill";
      } else {
        el.style.backgroundImage=url; el.style.backgroundSize="100% 100%";
        if(w.fitWeapon) Object.assign(el.style,{backgroundSize:"contain",backgroundPosition:"center",
          backgroundRepeat:"no-repeat",backgroundOrigin:"content-box",boxSizing:"border-box",padding:"2px 4px"});
        if(w.uvScale) {
          el.style.backgroundSize=(100/w.uvScale[0])+"% "+(100/w.uvScale[1])+"%";
          el.style.backgroundPosition="left bottom";
        }
      }
      el.style.opacity=a[3]/255;
      el.style.filter=spriteTint(a);
      if(w.depotHighlight)qmqzInventory.highlight(el,image,w);
      if (g.sx<0 || g.sy<0 || n.rotate) el.style.transform="scale("+(g.sx<0?-1:1)+","+(g.sy<0?-1:1)+") rotate("+(n.rotate||0)+"deg)";
    }
    el.dataset.sourceId=n.id;
    return el;
  }

  let windowBegan=0;
  async function render() {
    if(dialog!=="RewardDialog")qmqzRewardMotion.reset();
    const token=++revision;
    const screen = state.mode==="match" ? "" : state.screen==="MainUI" ?
      (localWindow||(state.rankWaiting?"QualifyingWindow":"")||{RoomWindow:"TableWindow",TableWindow:"TableWindow",LobbyWindow:"LobbyWindow",LineWindow:"LineWindow",BotLevelWindow:"BotLevelWindow",OfflineWindow:"OfflineWindow"}[state.window]||"MainUI") :
      state.screen==="CreateCharacter" ? "CreateCharacter" : "InitUI";
    switcher.hidden=screen!=="InitUI" || !entryRoles || entryRoles.roles.length<2;
    if(!screen) {
      localWindow="";
      menu.hidden=true; drawings.replaceChildren();fieldLayer.replaceChildren(); document.querySelector("#unity-canvas").focus();
      window.qmqzPosters.attach(drawings);
      view=""; dialog=false; return;
    }
    if (!window.qmqzUnity || state.booted!==true) return;
    try {
      const nodes=await content(screen);
      const carousel=screen==="MainUI" && nodeById(nodes,4531);
      const destinations=carousel ? await data("poster-links") : null;
      if(carousel)await Promise.all(carousel.posters.map(loadImage));
      const designHeight=nodes.find(n=>n.height).height;
      const width=Math.max(designHeight*16/9, menu.parentElement.clientWidth/menu.parentElement.clientHeight*designHeight);
      const height=designHeight;
      const scale=Math.min(menu.parentElement.clientHeight/height,menu.parentElement.clientWidth/width);
      currentScale=scale;
      const posterHit=nodeById(nodes,"poster-enter");
      if(posterHit) posterHit.hit=[0,0,width,height];
      for(const n of nodes)qmqzButtonFeedback.defaults(n);
      const world=layout(nodes,width,height);
      const visible=nodes.filter(n=>world.get(n.id).active);
      await Promise.all([window.qmqzFonts.load(),...new Set(visible.flatMap(n=>n.widget?.image?[n.widget.image]:[]))].map(v=>typeof v==="string"?loadImage(v):v));
      if(token!==revision) return;
      if(view!==screen)windowBegan=performance.now();
      const frag=document.createDocumentFragment(), fieldNames=new Set();
      const panels=new Map(), motions=new Map(), buttonArt=new Map();
      function append(el,n) {
        const {clip,motion,sequence,windowAnimator}=world.get(n.id);
        if(motion) {
          const target=world.get(motion.id), layer=document.createElement("div");
          layer.className="ngui-motion";
          layer.dataset.motion=motion.id;
          layer.style.left=target.x+"px";layer.style.top=-target.y+"px";
          layer.style.transition="transform "+motion.motionDuration+"s "+buttonCurve;
          el.style.left=(parseFloat(el.style.left)-target.x)+"px";
          el.style.top=(parseFloat(el.style.top)+target.y)+"px";
          layer.append(el);el=layer;
          if(!motions.has(motion.id))motions.set(motion.id,[]);
          motions.get(motion.id).push(layer);
        }
        if(sequence) {
          const target=world.get(sequence.id), stage=sequence.sequence;
          const layer=document.createElement("div");
          layer.className="ngui-motion";
          layer.dataset.sequence=stage.name;
          layer.dataset.sequenceRoot=sequence.id;
          layer.style.left=target.x+"px";layer.style.top=-target.y+"px";
          el.style.left=(parseFloat(el.style.left)-target.x)+"px";
          el.style.top=(parseFloat(el.style.top)+target.y)+"px";
          layer.append(el);el=layer;
          const age=qmqzMenuFX.start(stage.clock);
          if(stage.delay>age) {
            const reveal=el.animate([{visibility:"hidden"},{visibility:"visible"}],
              {duration:stage.delay,easing:"steps(1,end)",fill:"backwards"});
            reveal.currentTime=age;
          }
          if(stage.frames && age<stage.delay+stage.duration) {
            const anim=el.animate(stage.frames,{delay:stage.delay,duration:stage.duration,fill:"both"});
            anim.currentTime=age;
          }
        }
        const age=performance.now()-windowBegan;
        if(windowAnimator && age<300 && !world.get(n.id).overlay) {
          const opacity=Number(el.style.opacity||1);
          const anim=el.animate([{opacity:opacity*.01},{opacity}],{duration:300});
          anim.currentTime=age;el.dataset.windowAnimator="true";
        }
        if(!clip){frag.append(el);return;}
        if(!panels.has(clip.id)) {
          const mask=document.createElement("div"), inside=document.createElement("div");
          mask.className="ngui-clip";mask.dataset.panel=clip.id;
          box(mask,clip.x,clip.y,clip.w,clip.h);
          Object.assign(inside.style,{position:"absolute",left:-clip.x+"px",top:-clip.y+"px"});
          mask.append(inside); frag.append(mask);panels.set(clip.id,inside);
        }
        panels.get(clip.id).append(el);
      }
      const inputs=new Set(visible.filter(n=>n.field).map(n=>n.input.label));
      const widgets=visible.filter(n=>n.widget&&!inputs.has(n.id));
      const group=n=>world.get(n.id).overlay?2:n.stretch?0:1;
      widgets.sort((a,b)=>group(a)-group(b)||world.get(b.id).z-world.get(a.id).z||Number(a.widget.kind==="UILabel")-Number(b.widget.kind==="UILabel")||a.widget.depth-b.widget.depth);
      for(const n of widgets) {
        const g={...world.get(n.id)};
        if(n.stretch===3){g.x=0;g.y=0;g.sx=width;g.sy=height;}
        const el=widget(n,g);
        if(!el)continue;
        buttonArt.set(n.id,el);
        if(n.modalFade){
          const age=qmqzMenuFX.start(n.modalFade);
          if(age<300){const fade=el.animate([{opacity:0},{opacity:Number(el.style.opacity||1)}],{duration:300});fade.currentTime=age;}
          el.dataset.modalFade="300";
        }
        if(n.particle)qmqzMenuFX.paint(el,n);
        if(n.shopShowcase)qmqzShopPrizes.paint(el,n.shopShowcase);
        if(n.rewardDelay!==undefined||n.rewardScore)qmqzRewardMotion.paint(el,n,g);
        if(n.id==="hud-message" && callboard===302) {
          // HUDMessages/message (7730), HUDMessage.UpdateTrans. The source keys have zero tangents.
          const smooth="cubic-bezier(.333333,0,.666667,1)", age=performance.now()-callboardSince;
          const tween=(frames,duration,delay=0)=>{
            const animation=el.animate(frames,{duration,delay,easing:smooth,fill:"both"});
            animation.currentTime=age;
          };
          tween([{opacity:1},{opacity:0}],2000,1000);
          tween([{translate:"0 0"},{translate:"0 -40px"}],3000);
          tween([{transform:"translate(-50%,-50%) scale(0)"},{transform:"translate(-50%,-50%) scale(1.047263)"}],495.303);
        }
        // PackItem's two sliced backgrounds have BoxColliders that shield the dimmer below them.
        if(n.modalFade && n.hit && n.widget.kind==="UISlicedSprite")el.style.pointerEvents="auto";
        if(n.modalBackground) {
          el.dataset.object="UIDimmer";
          el.style.pointerEvents="auto";
          el.onclick=n.dismissBackground;
        }
        append(el,n);
      }
      for(const n of visible) {
        if (n.field && !dialog) {
          const source=nodeById(nodes,n.input.label), s=source.widget, point=world.get(source.id);
          fieldNames.add(n.field);
          let input=fieldLayer.querySelector("[name='"+n.field+"']");
          if(!input) {
            input=document.createElement("input");
            input.className="ngui-input";input.name=n.field;input.type="text";
            input.autocomplete="off";
            input.value=values[n.field]||"";
            const save=()=>{values[n.field]=input.value;};
            for(const type of ["input","change","compositionend"])input.addEventListener(type,save);
            input.onkeydown=e=>{
              if(e.key!=="Enter" || e.isComposing || e.keyCode===229)return;
              e.preventDefault();save();(input.qmqzSubmit||create)();
            };
            fieldLayer.append(input);
          }
          input.qmqzSubmit=n.submit;
          input.placeholder=s.text;input.setAttribute("aria-label",s.text);
          input.style.setProperty("--placeholder",color(s.color));input.style.color=color(n.input.color);
          window.qmqzFonts.decorateInput(input,s,point.sy);
          const width=s.maxWidth||Math.abs(n.hit?.[2]||300)-12;
          box(input,point.x-width*((s.pivot%3)/2),-point.y-point.sy*.72,width,point.sy*1.44);

        } else if(n.slide) {
          const range=document.createElement("input"), g=world.get(n.id), [x,y,w,h]=n.hit;
          range.type="range";range.min=0;range.max=1;range.step=.001;range.value=n.value;range.className="ngui-range";
          range.dataset.axis=n.slide;range.setAttribute("aria-label",({music:"音乐音量",effects:"音效音量",x:"X轴敏感度",y:"Y轴敏感度",pad:"手柄敏感度"})[n.slide]);
          box(range,g.x+x-w/2,-g.y-y-h/2,w,h);
          range.oninput=()=>{
            const value=range.valueAsNumber;
            const thumb=drawings.querySelector('[data-source-id="'+n.UISlider.thumb+'"]');
            const fill=drawings.querySelector('[data-source-id="'+n.UISlider.foreground+'"]');
            if(thumb) thumb.style.translate=(w*(value-n.value))+"px 0";
            if(fill) fill.style.width=(293*value)+"px";
            if(n.slide==="music" || n.slide==="effects") window.qmqzVolume.set(n.slide,value);
          };
          range.onchange=()=>setSlider(n.slide,range.valueAsNumber);append(range,n);
        } else if(n.action&&n.hit&&(!dialog||world.get(n.id).overlay)) {
          const b=document.createElement("button"), g=world.get(n.id), [cx,cy,w,h]=n.hit;
          b.type="button";b.className="ngui-hit";b.dataset.object=n.name;
          b.setAttribute("aria-label",n.label||visible.find(c=>c.parent===n.id&&c.widget?.text)?.widget.text||n.name);
          for(const key of ["actorId","itemId","slot","levelId","shopId"]) if(n[key]!==undefined)b.dataset[key]=n[key];
          if(n.line!==undefined)b.dataset.line=n.line;
          if(n.axis)b.dataset.axis=n.axis;
          if(n.family)b.dataset.family=n.family;
          if(n.modeId)b.dataset.modeId=n.modeId;
          if(n.quickMode!==undefined)b.dataset.quickMode=n.quickMode;
          if(n.roomId!==undefined)b.dataset.roomId=n.roomId;
          box(b,g.x+(cx-w/2)*g.sx,-g.y-(cy+h/2)*g.sy,w*g.sx,h*g.sy); b.onclick=e=>{
            if(e.detail && lastTouchScroll && performance.now()-lastTouchScroll<300)return;
            n.action();
          };
          append(b,n);
          qmqzButtonFeedback.bind(b,n,{motions,art:buttonArt,resource,tint:spriteTint,curve:buttonCurve,scroll:scrollTarget,
            scrolled:()=>lastTouchScroll && performance.now()-lastTouchScroll<300});
        }
      }
      stage.style.transform="scale("+scale+")";
      drawings.replaceChildren(frag);
      window.qmqzPosters.attach(drawings,carousel && {
        urls:carousel.posters.map(name=>images.get(name).src),
        style:{slideWidth:carousel.slideWidth,slideSeconds:carousel.slideSeconds,dots:nodeById(nodes,8231).dots},
        viewportHeight:height*scale,
        open:i=>window.qmqzPosters.destination(destinations[i],go)
      });
      // Keep the actual focused input attached while Safari resizes for its keyboard or composes text.
      for(const input of [...fieldLayer.children]) {
        if(!fieldNames.has(input.name)) {
          values[input.name]=input.value;
          input.remove();
        }
      }
      switcher.hidden=screen!=="InitUI" || entryRoles.roles.length<2;
      if(screen!=="InitUI") chooseRole(false);
      menu.hidden=false; menu.dataset.screen=screen; view=screen;
      if(!ready) {ready=true;requestAnimationFrame(()=>requestAnimationFrame(()=>command("screen-ready")));}
    } catch(error) {
      if(token!==revision)return;
      console.error(error);
      const box=document.querySelector("#status");box.hidden=false;box.querySelector("progress").hidden=true;
      box.querySelector("span").textContent="原版界面加载失败。"+error.message;
    }
  }
  let stateKey="";
  window.addEventListener("qmqz-state",e=>{
    const prev=state;
    state=e.detail||{};
    if(state.screen==="InitUI" && state.storageError) {
      const status=document.querySelector("#status");
      status.hidden=false; status.querySelector("span").textContent="读取本地角色失败，请再次点击进入游戏。";
    }
    if(state.room?.members?.length) lastRoom=state.room;
    if(state.screen==="CreateCharacter" && [1,5].includes(state.createResult) &&
        (state.profileRevision!==prev.profileRevision || state.createResult!==prev.createResult)) notify(state.createResult===1 ? 134 : 133);
    if(prev.screen!==state.screen||prev.window!==state.window){ dialog=false;localWindow="";page=0;lineOffset=0; }
    if(state.dialog==="ScoreDialog" && prev.dialog!==state.dialog){localWindow="";rangeResultClock={};}
    if(state.rankWaiting && (!prev.rankWaiting || prev.rankType!==state.rankType)) {
      window.qmqzOfflineModes.rank(state.rankType===1?1:0);localWindow="QualifyingWindow";dialog="RankMatch";
    } else if(!state.rankWaiting && dialog==="RankMatch")dialog=false;
    if(["RewardDialog","RewardRobotDialog","ScoreDialog","LevelUp","LevelUpDialog"].includes(state.dialog) && prev.dialog!==state.dialog){dialog=state.dialog==="LevelUpDialog"?"LevelUp":state.dialog==="RewardDialog" && state.result?.gameMode===12?"PvEReward":state.dialog;dialogScroll=0;resultTab="record";}
    const key=JSON.stringify([state.booted,state.mode,state.screen,state.window,state.line,state.rooms,state.room,state.profile,state.loginResult,state.createResult,state.sensitivityX,state.sensitivityY,state.sensitivityPad,state.rankType,state.rankWaiting,state.lines,state.dialog,state.result,state.profileRevision]);
    if(key!==stateKey){stateKey=key;render();}
  });
  function scrollTarget(el,event) {
    if(!dialog&&view==="UpgradeListWindow"&&qmqzUpgrade.inCarousel(menu,event))return "upgradePages";
    if(el.closest(".ngui-range"))return "";
    const panel=el.closest("[data-panel]")?.dataset.panel;
    if(!dialog && qmqzSocial.scrollKey(view,panel))return qmqzSocial.scrollKey(view,panel);
    if(dialog==="GachaListDialog" && panel==="2829")return "prizeList";
    if(dialog==="Annoncement")return ({"8097":"noticeList","7823":"noticeText"})[panel]||"";
    if(dialog==="DailyPrizes" && view==="PrizeWindow" && panel==="1529")return "calendar";
    if(!dialog && view==="PrizeWindow" && panel==="5513")return "tasks";
    if(view==="TalentWindow"&&qmqzTalent.panel(panel))return "talent";
    if((posterViews.includes(view)||dialog==="VipPackList") && window.qmqzPosters.scrollPanel(panel))return "poster";
    if(!dialog && view==="StoreWindow" && ["2132","2904"].includes(panel))return "store";
    if(dialog==="ExchangeDialog" && panel==="1794")return "wheelExchange";
    if(!dialog && view==="WeekCardWindow" && ["255","6178","6352"].includes(panel))return "weekcard";
    if(!dialog && view==="GachaWindow" && panel==="1133")return "gacha";
    if(!dialog && view==="BotLevelWindow" && panel==="5676")return "levels";
    if(!dialog && inventoryViews.includes(view) && inventory.scroll(panel))return inventory.scroll(panel);
    if(dialog==="GameOptions" && panel==="6091")return "options";
    if(dialog==="RewardDialog" && panel==="263")return "result";
    if(dialog==="RewardRobotDialog" && panel==="1455")return "robotResult";
    if(!dialog&&view==="LineWindow"&&panel==="1358")return "lines";
    if(!dialog&&view==="LobbyWindow"&&panel==="3500")return "rooms";
    if(dialog==="QuickMode"&&panel==="2854")return "quick";
    return "";
  }
  function scrollValue(key) { if(key==="prizeList")return qmqzShopPrizes.offset(); if(key.startsWith("social:"))return qmqzSocial.offset(key); if(key==="weekcard")return qmqzWeekCards.offset(); if(key==="noticeList"||key==="noticeText")return qmqzAnnouncements.offset(key); if(key==="talent")return qmqzTalent.offset(); if(key==="tasks"||key==="calendar")return window.qmqzBonuses.offset(key==="calendar"); if(key==="wheelExchange")return window.qmqzRoulette.offset(); if(key==="gacha")return window.qmqzStore.gachaOffset(); if(key==="poster")return window.qmqzPosters.offset(); if(key==="store")return window.qmqzStore.offset(); if(key==="levels")return window.qmqzOfflineModes.getOffset(); if(["actors","depot","loadouts"].includes(key))return inventory.offset(key); return key==="lines"?lineOffset:key==="rooms"?page*96:dialogScroll; }
  function setScroll(key,value) {
    if(key.startsWith("social:")){qmqzSocial.scroll(key,value);render();return;}
    if(key==="prizeList"){qmqzShopPrizes.scroll(value);render();return;}
    if(key==="weekcard"){qmqzWeekCards.scroll(value);render();return;}
    if(key==="noticeList"||key==="noticeText"){qmqzAnnouncements.scroll(key,value);render();return;}
    if(key==="wheelExchange"){window.qmqzRoulette.scroll(value);render();return;}
    if(key==="tasks"||key==="calendar"){window.qmqzBonuses.setOffset(value,key==="calendar");render();return;}
    if(key==="gacha"){window.qmqzStore.setGachaOffset(value);render();return;}
    if(key==="talent"){qmqzTalent.scroll(value);render();return;}
    if(key==="poster"){window.qmqzPosters.scroll(value);render();return;}
    if(key==="store"){window.qmqzStore.setOffset(value);render();return;}
    if(key==="levels"){window.qmqzOfflineModes.setOffset(value);render();return;}
    if(["actors","depot","loadouts"].includes(key)){inventory.setOffset(key,value);render();return;}
    const max=key==="lines"?Math.max(0,(state.lines?.length||0)*160-915):
      key==="rooms"?Math.max(0,(state.rooms?.length||0)-4)*96:
      key==="quick"?110:key==="result"?Math.max(0,(state.result?.fighters?.length||0)*60-300):
      key==="robotResult"?robotResultScrollMax:500;
    const clamped=Math.max(0,Math.min(max,value));
    if(key==="lines")lineOffset=clamped;
    else if(key==="rooms")page=Math.round(clamped/96);
    else dialogScroll=clamped;
    render();
  }
  let drag=null;
  menu.addEventListener("pointerdown",e=>{
    // A new contact can activate another button immediately after a list or carousel drag.
    lastTouchScroll=0;
    const key=scrollTarget(e.target,e);
    if(key) drag={id:e.pointerId,x:e.clientX,y:e.clientY,base:scrollValue(key),key};
  });
  menu.addEventListener("pointermove",e=>{
    if(!drag || drag.id!==e.pointerId)return;
    const distance=["lines","actors","loadouts","levels","gacha","upgradePages"].includes(drag.key) ? drag.x-e.clientX : drag.y-e.clientY;
    if(Math.abs(distance)<7&&!drag.moved)return;
    if(!drag.moved){menu.setPointerCapture(e.pointerId);drag.moved=true;}
    if(drag.key==="upgradePages"){drag.distance=distance/currentScale;lastTouchScroll=performance.now();return;}
    setScroll(drag.key,drag.base+distance/currentScale*(drag.key==="loadouts"?3:1));
    lastTouchScroll=performance.now();
  });
  for(const evt of ["pointerup","pointercancel"]) menu.addEventListener(evt,e=>{
    if(drag?.id!==e.pointerId)return;
    if(evt==="pointerup"&&drag.key==="upgradePages"&&Math.abs(drag.distance||0)>=40)qmqzUpgrade.turn(Math.sign(drag.distance),render);
    drag=null;
  });
  let lastUpgradeWheel=0;
  menu.addEventListener("wheel",e=>{
    const key=scrollTarget(e.target,e);
    if(!key)return;
    e.preventDefault();
    if(key==="upgradePages"){
      const delta=e.deltaX||e.deltaY,now=performance.now();
      if(delta&&now-lastUpgradeWheel>180){qmqzUpgrade.turn(Math.sign(delta),render);lastUpgradeWheel=now;}
      return;
    }
    const delta=["lines","actors","loadouts","levels","gacha"].includes(key)?(e.deltaX||e.deltaY):e.deltaY;
    setScroll(key,scrollValue(key)+(key==="loadouts"?Math.sign(delta)*960:key==="rooms"?Math.sign(delta)*96:delta/currentScale));
  },{passive:false});
  window.addEventListener("keydown",e=>{if(e.key==="Escape"&&dialog) {
    if(dialog==="PvEReward"){qmqzChallengeCards.back();return;}
    if(dialog==="ScoreDialog"&&!rangeCloseReady())return;
    if(dialog==="GachaPrize"&&!qmqzStore.canCloseDraw())return;
    if(qmqzUpgrade.backFromSlot(dialog,state.profile,openDialog,closeDialog))return;
    if(dialog==="RankMatch")command("original-rank-cancel");
    if(["RewardDialog","RewardRobotDialog","ScoreDialog"].includes(dialog))command("original-close-result");
    closeDialog();
  }});
  window.addEventListener("qmqz-rank-info",()=>{if(dialog==="RankMatch")render();});
  window.addEventListener("qmqz-protocol",({detail})=>{
    qmqzAmmoShop.protocol(detail,view,dialog,closeDialog,notify);
    window.qmqzRoulette.protocol(detail,localWindow||view,openDialog,render);
    window.qmqzBonuses.protocol(detail,view,render,openDialog);
    window.qmqzStore.protocol(detail,view,openDialog,render);
    if(![1048578,786446].includes(detail.id) || !window.qmqzStore.finishPurchase(detail.fields.id,detail.id) || view!=="StoreWindow")return;
    const success=detail.fields.retcode===0;
    if(success && dialog==="ConfirmBuy")closeDialog();
    notify(success?4:5);
  });
  window.addEventListener("resize",render);
  window.qmqzUiDensity.media.addEventListener("change",render);
  window.addEventListener("qmqz-ready",render);
  if(window.qmqzUnity) render();
})();
