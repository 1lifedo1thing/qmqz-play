(() => {
  "use strict";
  let rankType=0, selectedLevel=1, levelOffset=0, levelCount=0;
  let custom=null, addTarget=null, rankInfo=null;
  window.addEventListener("qmqz-protocol",e=>{if(e.detail?.id===1245245){rankInfo=e.detail.fields;window.dispatchEvent(new Event("qmqz-rank-info"));}});

  const random=arr=>arr[Math.floor(Math.random()*arr.length)];
  function setMode(mode,special=0) {if(custom){custom.gameMode=mode;custom.equiplimitid=special;}}
  function rank(type){rankType=type;rankInfo=null;}
  function reset(){levelOffset=0;}
  function setOffset(value){levelOffset=Math.max(0,Math.min(levelCount*300-915,value));}
  async function render(screen,nodes,state,api) {
    const {data,edit,label,picture,nodeById,clonePrefab,command,go,notify,openDialog,closeDialog,dialog,redraw}=api;
    const [modes,text]=await Promise.all([data("offline-modes"),data("strings")]);
    const profile=state.profile||{};
    function setCard(card,data,bot=false) {
      if(!card||!data)return;
      label(nodes,bot ? card.robotName : card.playerName,data.name);
      label(nodes,card.level,data.level);
      const head=data.head||data.iconid,rank=data.rank||1;
      if(head>=1&&head<=31)picture(nodes,card.head,"head-"+head+".png");
      if(rank>=1&&rank<=43)picture(nodes,card.rank,"rank-"+rank+".png");
      if(!bot) for(const id of [card.ready,card.ownerState,card.monthCard,card.vipLevel])edit(nodes,id,{active:false});
    }
    if(screen==="QualifyingWindow") {
      edit(nodes,8425,{active:rankType===0});edit(nodes,412,{active:rankType===1});
      label(nodes,2145,rankType===0 ? modes.rank : modes.league);
      label(nodes,6470,text[rankType===0 ? 20008 : 20009]);
      label(nodes,1919,(text[rankType===0?559:560]||"").replace("{0}",rankType===0 ? (profile.rankscore??0) : (profile.leaguescore??0)));
      label(nodes,3076,rankType===1 && profile.leagueremain!==undefined ? (text[561]||"").replace("{0}",profile.leagueremain) : "");
      for (const m of nodes.filter(n=>n.QualifyingMember)) {
        const ref=m.QualifyingMember, present=m.id===5823;
        edit(nodes,ref.NoPlayer,{active:!present});edit(nodes,ref.player,{active:present});edit(nodes,ref.medalStatics,{active:false});
        if(present)setCard(nodeById(nodes,ref.player)?.PlayerCard,profile);
      }
      edit(nodes,4722,{action:()=>openDialog("HelpDialog")});
      if(dialog==="HelpDialog" || dialog==="RankMatch") {
        const overlay=(await data(dialog)).filter(n=>!nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
        if(dialog==="HelpDialog") {
          edit(overlay,3135,{active:true});label(overlay,982,rankType===0 ? modes.rankHelp : modes.leagueHelp);
          label(overlay,2843,text[rankType===0?20007:20005]);edit(overlay,7831,{action:closeDialog});
        } else {
          edit(overlay,2583,{active:true});label(overlay,6473,text[rankType===0?569:570]);label(overlay,605,text[rankType===0?571:572]);
          label(overlay,20,text[193].replace("{0}",rankInfo?.fightnum??"-"));
          label(overlay,3210,text[194].replace("{0}",rankInfo?.readynum??"-"));
          const sec=rankInfo?.waittime;
          const time=sec===undefined?"--:--":[Math.floor(sec/60),sec%60].map(i=>String(i).padStart(2,"0")).join(":");
          label(overlay,284,text[195].replace("{0}",time));label(overlay,8041,"");
          label(overlay,3487,rankType===1 && profile.leaguescore!==undefined?text[565].replace("{0}",profile.leaguescore):"");
          label(overlay,8561,rankType===1 && profile.leaguewins!==undefined?text[566].replace("{0}",profile.leaguewins):"");
          edit(overlay,6519,{action:()=>{command("original-rank-cancel");closeDialog();}});
        }
        nodes.push(...overlay);
      }
      edit(nodes,7828,{action:()=>{if(!state.rankWaiting)command("original-rank-ready:"+rankType);}});
    } else if(screen==="BotLevelWindow") {
      edit(nodes,4584,{action:()=>{
        selectedLevel=0;
        const first=modes.maps.find(m=>m.status===1);
        custom={mapId:first.id,gameMode:1,equiplimitid:0,side:1,autoAim:true,police:[null],terrorists:[]};
        go("BotRoomWindow");
      }});
      const rows=await data("LevelListItem"),ref=rows.find(n=>n.RobotLevelListItem).RobotLevelListItem;
      const grid=nodeById(nodes,5038);grid.p=[grid.p[0]-levelOffset,grid.p[1]];
      const openId=profile.robotOpenId ?? 1;
      levelCount=modes.levels.length;
      const first=Math.max(0,Math.floor(levelOffset/300)-1);
      const last=Math.min(levelCount,Math.ceil((levelOffset+915)/300)+1);
      for(let i=first;i<last;i++) {
        const level=modes.levels[i];
        const prefix="level"+level.id+"-", locked=level.id>openId, passed=profile.robotCleared ? profile.robotCleared.includes(level.id) : level.id<openId;
        const {currency,amount}=level.cardReward||{};
        const copy=clonePrefab(rows,prefix,5038,0,{[ref.levelName]:level.name,[ref.rewardValue]:amount},
          {p:[i*300,0],levelId:level.id,label:level.name,action:()=>{
            if(locked){notify(302,level.name);return;}
            selectedLevel=level.id;go("BotRoomWindow");
          }});
        edit(copy,prefix+ref.lockObj,{active:locked});
        edit(copy,prefix+ref.rewardPassed,{active:passed});
        edit(copy,prefix+ref.rewardContent,{active:!passed});
        edit(copy,prefix+ref.lines,{active:i<modes.levels.length-1});
        const art=nodeById(copy,prefix+ref.rewardIcon)?.widget?.currencyImages;
        picture(copy,prefix+ref.rewardIcon,art?.[currency]);
        if(locked)for(const id of [ref.bg,ref.texture]) {
          const n=nodeById(copy,prefix+id);n.widget={...n.widget,color:[128,128,128,255]};
        }
        nodes.push(...copy);
      }
    } else if(screen==="BotRoomWindow") {
      const level=modes.levels.find(l=>l.id===selectedLevel);
      if(!level&&!custom)return;
      const rule=level ? modes.rules.find(r=>r.id===level.levelId) : custom;
      const map=modes.maps.find(m=>m.id===rule?.mapId);
      const roomModes=await data("room-modes");
      const mode=rule.equiplimitid ? modes.special.find(m=>m.id===rule.equiplimitid)?.name : roomModes.modes.find(m=>m.id===rule?.gameMode)?.name;
      label(nodes,5992,map?.name);label(nodes,3686,mode);label(nodes,5346,mode);
      if(map)picture(nodes,4596,"map-"+map.id+".png");
      const choices=nodeById(nodes,5478).RobotRoomWindow;
      const slice=x=>x._items.slice(0,x._size);
      const friends=level ? [null,...slice(level.teamates)] : [], enemies=level ? slice(level.enemies) : [];
      const police=level ? (level.camp===1?friends:enemies):custom.police;
      const terrorists=level ? (level.camp===1?enemies:friends):custom.terrorists;
      function add(ids,index,difficulty) {
        const camp=ids===police?1:2;
        const pool=modes.bots.filter(b=>b.id!==0 && b.level===difficulty && modes.actors[b.actorId]===camp);
        if(pool.length)ids[index]=random(pool).id;
      }
      if(!level) {
        // OfflineAssist.RandomPrototype uses RobotConfigs.RandomLevel(1,4) and the target camp.
        const both=[police,terrorists];
        edit(nodes,4719,{action:()=>{for(const side of both)for(let i=0;i<4;i++)if(side[i]===undefined)add(side,i,random([1,2,3,4]));redraw();}});
        edit(nodes,3790,{action:()=>{
          const was=custom.side===1?police:terrorists, to=custom.side===1?terrorists:police;
          const pos=was.indexOf(null);if(pos>=0)delete was[pos];
          custom.side=custom.side===1?2:1;to[0]=null;redraw();
        }});
        edit(nodes,5290,{action:()=>{custom.autoAim=!custom.autoAim;redraw();}});
        if(custom.autoAim)picture(nodes,6345,nodeById(nodes,6345)?.widget?.onImage);
        for(const [id,step] of [[1845,1],[6355,-1]])edit(nodes,id,{action:()=>{
          const pool=modes.maps.filter(m=>m.status===1 && modes.rules.some(r=>r.mapId===m.id && r.gameMode===custom.gameMode));
          if(pool.length) custom.mapId=pool[(pool.findIndex(m=>m.id===custom.mapId)+step+pool.length)%pool.length].id;
          redraw();
        }});
        edit(nodes,1061,{action:()=>openDialog("ModeSelectNew")});
        if(dialog==="AddBot" && addTarget) {
          const overlay=(await data("AddBot")).filter(n=>!nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
          edit(overlay,4696,{active:true});
          for(const [id,difficulty] of [[4462,1],[6086,2],[1751,3],[8777,4]])edit(overlay,id,{action:()=>{add(addTarget.ids,addTarget.index,difficulty);closeDialog();}});
          edit(overlay,3040,{action:closeDialog});nodes.push(...overlay);
        }
      }
      for(const [side,ids] of [[choices.robotLeft,police],[choices.robotRight,terrorists]]) {
        side.forEach((slot,i)=>{
          const choice=nodeById(nodes,slot).RobotChoice,who=ids[i];
          const has=who!==undefined, self=who===null, bot=has&&!self;
          edit(nodes,choice.addRobot,{active:!has});edit(nodes,choice.cardPanel,{active:has});
          edit(nodes,choice.playerCard,{active:self});edit(nodes,choice.robotCard,{active:bot});edit(nodes,choice.medalGroup,{active:false});
          if(!level&&!self) {
            const addOrRemove=()=>{if(bot){delete ids[i];redraw();}else{addTarget={ids,index:i};openDialog("AddBot");}};
            edit(nodes,choice.addRobot,{action:addOrRemove});edit(nodes,choice.cardPanel,{action:addOrRemove});
          }
          if(self)setCard(nodeById(nodes,choice.playerCard)?.PlayerCard,profile);
          if(bot)setCard(nodeById(nodes,choice.robotCard)?.RobotCard,modes.bots.find(b=>b.id===who),true);
        });
      }
      edit(nodes,1026,{action:()=>{
        if(level){command("original-robot-start:"+level.id);return;}
        if(!police.some(id=>id!==undefined)||!terrorists.some(id=>id!==undefined)){notify(346);return;}
        command("original-robot-custom:"+JSON.stringify({...custom,police:police.filter(Number.isInteger),terrorists:terrorists.filter(Number.isInteger)}));
      }});
    }
  }
  window.qmqzOfflineModes={render,rank,reset,setMode,getOffset:()=>levelOffset,setOffset};
})();
