// PVERewardDialog and PvEResultModal in the original MainUI scene.
(() => {
  const grades=["C","B","A","S","SS"];
  let active="",layer="",pending=null,flop=null,current=null,gradeClock={};
  function reset(id) {
    active=id;layer="";pending=null;flop=null;current=null;gradeClock={};
  }
  function update() { current?.h.render(); }
  function finish() {
    const h=current?.h;
    reset("");
    if(h){h.command("original-close-result");h.closeDialog();}
  }
  function send(id,fields={}) {
    if(!current || pending || flop)return;
    const tx={id,slot:fields.slot};
    pending=tx;
    current.h.command("original-menu:"+JSON.stringify({id,fields:{matchId:active,...fields}}));
    // Original card request times out in 5 seconds. A late reply remains in the saved record.
    setTimeout(()=>{if(pending===tx){pending=null;update();}},5000);
  }
  function close() {
    if(pending || flop || !current)return;
    if(layer==="score"){layer="";update();return;}
    if(layer==="confirm"){layer="";send(1245279);return;}
    if(!current.record.remaining){layer="confirm";update();return;}
    send(1245279);
  }
  function pick(slot) {
    if(pending || flop || layer || !current)return;
    const {record,h}=current;
    if(record.remaining<1){layer="confirm";update();return;}
    if(slot===4 && record.grade<4){h.notify(708);return;}
    if(record.grade<1){h.notify(701);return;}
    if(slot<4 && Object.keys(record.rolls).filter(i=>i!=="4").length>=2){h.notify(702);return;}
    if(record.rolls[slot])return;
    send(1245268,{slot});
  }
  function add(nodes,template,h) {
    const rows=template.filter(n=>!h.nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
    nodes.push(...rows);
  }
  function detail(nodes,record,mode,cfg,strings,h) {
    const d=h.nodeById(nodes,6394).pve, score=record.detail;
    h.edit(nodes,6394,{active:true});h.edit(nodes,d.close,{action:close});
    h.label(nodes,d.totalscore,score.sumscore);
    const gradeNode=h.nodeById(nodes,d.gradeIcon);
    h.picture(nodes,d.gradeIcon,gradeNode.widget.variants["Icon_Rank"+grades[record.grade]]);
    const edges=mode.gradeScore;
    for(let i=0;i<d.grades.length;i++){
      const id=d.grades[i], refs=h.nodeById(nodes,id).pve;
      const left=h.nodeById(nodes,d.left).p[0],right=h.nodeById(nodes,d.right).p[0];
      h.edit(nodes,id,{p:[left+(right-left)*mode.gradeProg[i]/100,0]});
      h.label(nodes,refs.score,i?edges[i-1]:0);
    }
    const bar=nodes.find(n=>n.parent===d.grade_prog && n.name==="Foreground");
    if(bar){
      const bounds=[0,...edges,mode.maxScore],stops=[...mode.gradeProg,100];
      const grade=record.grade;
      const fraction=Math.min(1,(score.sumscore-bounds[grade])/(bounds[grade+1]-bounds[grade]));
      const fill=(stops[grade]+fraction*(stops[grade+1]-stops[grade]))/100;
      h.edit(nodes,bar.id,{s:[bar.s[0]*fill,bar.s[1]]});
    }
    const terms=cfg.terms.filter(t=>!t.isMedal), medals=cfg.terms.filter(t=>t.isMedal && score.medals[t.id]>0);
    for(let i=0;i<d.terms.length;i++){
      const t=terms[i];
      h.label(nodes,d.terms[i],strings[t.textid].replace("{0}",score.medals[t.id]||0));
      h.label(nodes,d.scores[i],strings[677].replace("{0}",score.scores[t.id]||0));
    }
    for(let i=0;i<d.medals.length;i++){
      const t=medals[i];
      h.edit(nodes,d.medals[i],{active:!!t});h.edit(nodes,d.medal_scores[i],{active:!!t});
      if(t){h.picture(nodes,d.medals[i],t.medalIcon+".png");h.label(nodes,d.medal_scores[i],strings[677].replace("{0}",t.num));}
    }
    for(const id of d.gradeFXs)h.edit(nodes,id,{active:false});
  }
  function renderPrize(nodes,refs,prize,h) {
    const group=!prize.itemId?"money":prize.subType===41?"ammo":"weapon";
    for(const key of ["ammo","money","role","weapon"])h.edit(nodes,refs[key+"Obj"],{active:key===group});
    const colour=value=>"["+prize.color+"]"+value+"[-]";
    if(group==="money"){
      h.label(nodes,refs.moneyName,colour("强化点"));h.label(nodes,refs.moneyNum,colour(prize.rPoint));
    } else {
      h.picture(nodes,refs[group+"Icon"],prize.image);h.label(nodes,refs[group+"Name"],colour(prize.name));
      const amount=group==="weapon" && [10,11,12,13,14,15,16].includes(prize.subType)?
        (prize.itemDuration?Math.ceil(prize.itemDuration/86400)+"天":"永久"):"x"+prize.num;
      h.label(nodes,refs[group==="weapon"?"weaponState":"ammoNum"],colour(amount));
    }
  }
  async function display(nodes,state,h) {
    const profile=state.profile;
    if(!profile)return;
    const [role,y,cfg,strings,gradeFx,flipFx]=await Promise.all([window.qmqzReadPosterRole(profile.roleid),h.data("PvEReward"),h.data("challenge-cards"),h.data("strings"),h.data("challenge-grades"),h.data("challenge-flops")]);
    const record=role?.pve;
    if(!record || (profile.reward?.matchId && record.matchId!==profile.reward.matchId))return;
    if(record.matchId!==active)reset(record.matchId);
    current={h,record};
    if(record.closed){finish();return;}
    add(nodes,y,h);
    const panel=h.nodeById(nodes,5748).pve;
    h.edit(nodes,5748,{active:true});
    const mode=cfg.modes.find(m=>m.id===record.ruleId),raw=record.detail;
    const fmt=(base,bonus)=>bonus?base+"+[4040ff]"+bonus+"[-]":String(base);
    h.label(nodes,panel.surplus,strings[680].replace("{0}",record.remaining));
    h.edit(nodes,panel.lotteryNote,{active:!record.grade});
    h.edit(nodes,panel.monthNote,{active:!record.monthly});h.edit(nodes,panel.monthRewardObj,{active:record.monthly});
    h.label(nodes,panel.monthRewardLbl,record.won?mode.rPointMonth:0);
    h.label(nodes,panel.gems,fmt(record.won?mode.expReward:0,raw.vipexp));
    h.label(nodes,panel.honors,fmt(record.won?mode.honoReward:0,raw.firstwinbloodgem));
    h.label(nodes,panel.golds,fmt(record.won?mode.goldReward:0,raw.vipmoney));h.label(nodes,panel.points,record.won?mode.rPointAward:0);
    for(const id of panel.gradeFXs)h.edit(nodes,id,{active:false});
    const standings=Object.entries(record.playerScores).sort((a,b)=>b[1]-a[1]);
    panel.ranks.forEach((id,i)=>{
      const row=standings[i], refs=h.nodeById(nodes,id).pve;h.edit(nodes,id,{active:!!row});
      if(!row)return;
      const grade=mode.gradeScore.filter(n=>row[1]>=n).length;
      h.label(nodes,refs.Name,Number(row[0])===profile.roleid?profile.name:String(row[0]));
      h.label(nodes,refs.Score,strings[677].replace("{0}",row[1]));h.picture(nodes,refs.Grade,h.nodeById(nodes,refs.Grade).widget.variants["Icon_Rank"+grades[grade]]);
    });
    qmqzMenuFX.particle(nodes,gradeFx,"P_"+grades[record.grade]+"_DekaronWin",4743,gradeClock,500,{z:-2});
    if(flop){
      const ids=[...panel.cards,panel.card_ss], item=h.nodeById(nodes,ids[flop.slot]);
      const effectIndex=flop.slot===4?3:Math.min(Math.max(record.grade-1,0),2);
      const name=h.nodeById(nodes,panel.flops[effectIndex]).name;
      qmqzMenuFX.particle(nodes,flipFx,name,item.id,flop.clock,0,{z:-2,hideAfter:2000});
    }
    const draws=Object.keys(record.rolls).filter(i=>i!=="4").length;
    [...panel.cards,panel.card_ss].forEach((id,slot)=>{
      const refs=h.nodeById(nodes,id).pve;
      const shown=record.rolls[slot] && !(flop?.slot===slot && performance.now()<flop.focus);
      const face=slot===4?(record.grade===4?"Red":"Failed"):["Failed","Bronze","Silver","Golden","Golden"][record.grade];
      h.edit(nodes,id,{action:layer?null:()=>pick(slot)});
      h.edit(nodes,refs.back,{active:!shown});h.picture(nodes,refs.back,face+"_Back.png");
      h.edit(nodes,refs.front,{active:!!shown});if(shown)h.picture(nodes,refs.front,face+"_Front.png");
      h.edit(nodes,refs.reward,{active:!!shown});
      if(shown)renderPrize(nodes,h.nodeById(nodes,refs.reward).pve,cfg.prizes[record.rolls[slot]],h);
      if(refs.price){h.edit(nodes,refs.price,{active:!shown && record.grade>0 && record.remaining>0 && draws<2});
        h.label(nodes,refs.priceLabel,draws?cfg.prices[20]:"免费");}
    });
    h.edit(nodes,panel.myscore,{action:layer?null:()=>{if(!pending&&!flop){layer="score";update();}}});
    h.edit(nodes,panel.close,{action:layer?null:close});
    if(!layer)return;
    add(nodes,await h.data("UIDimmer"),h);h.edit(nodes,8896,{modalBackground:true});
    if(layer==="score"){add(nodes,await h.data("PvEResult"),h);detail(nodes,record,mode,cfg,strings,h);return;}
    add(nodes,await h.data("ConfirmBox"),h);h.edit(nodes,8009,{active:true});h.edit(nodes,5286,{active:false});h.edit(nodes,2454,{active:false});
    h.label(nodes,1335,"");h.label(nodes,8538,strings[703].replace("{0}",cfg.prices[21]));h.label(nodes,471,strings[120]);h.label(nodes,4135,strings[121]);
    h.edit(nodes,2021,{action:()=>{if(pending||flop)return;layer="";if(profile.gold<cfg.prices[21]){h.notify(690);update();}else send(1245270);}});
    h.edit(nodes,8510,{action:close});h.edit(nodes,7840,{action:close});
  }
  window.addEventListener("qmqz-protocol",({detail:{id,fields}})=>{
    if(!current || !pending)return;
    if(pending.id===1245268 && id===1245269){
      const slot=pending.slot;pending=null;
      if(fields.res<1){current.h.notify(fields.res===-2?690:702);update();return;}
      const begin=performance.now(), idAtStart=active;
      qmqzAudio("event",118);
      const anim=flop={slot,focus:begin+1100,clock:{start:begin}};
      setTimeout(()=>{if(flop===anim && active===idAtStart)update();},1101);
      setTimeout(()=>{if(flop===anim && active===idAtStart){flop=null;update();}},2000);update();
    } else if(pending.id===1245270 && id===1245271){pending=null;update();}
    else if(pending.id===1245279 && id===1245280){pending=null;finish();}
  });
  window.addEventListener("qmqz-state",e=>{if(e.detail?.storageError && pending){pending=null;update();}});
  window.qmqzChallengeCards={display,back:close};
})();
