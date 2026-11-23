// APK WindowNavigator.OnUpgrade, PartItemSolt.OnTransform and PromoteUnit.
(() => {
  "use strict";
  let page=0, pageCount=0, pageTurn=null, model, inspectedId=0, pending=false, legendDetail=false;
  let makerStake=[1,1], makerRunning=false, reelMotion=null, makerClock={}, speechClock={}, confirmation=null;
  let returnTo="MainUI";
  function open(go,source="MainUI") {returnTo=source;page=0;pageTurn=null;model=null;inspectedId=0;go("UpgradeListWindow");}
  function item(part,go,source) {returnTo=source;page=0;pageTurn=null;legendDetail=false;model=part.modelType;inspectedId=part.id;go(part.type===1?"PromoteWindow":"NewPromoteWindow");}
  window.addEventListener("qmqz-protocol",({detail})=>{
    if(inspectedId && detail.id===786460)inspectedId=detail.fields.newgunid;
  });
  function turn(direction,render) {
    const next=Math.max(0,Math.min(pageCount-1,page+direction));
    selectPage(next,render);
  }
  function selectPage(next,render) {
    if(next===page)return;
    pageTurn={from:page,direction:Math.sign(next-page),clock:{}};
    const turn=pageTurn;
    turn.clock.onStart=()=>setTimeout(()=>{if(pageTurn===turn){pageTurn=null;render();}},350);
    page=next;render();
  }
  function inCarousel(menu,event) {
    if(!event)return false;
    const buttons=Array.from(menu.querySelectorAll('button[data-object="PartItemSlot"]'));
    const rows=buttons.map(b=>b.getBoundingClientRect());
    const dots=menu.querySelector('button[data-object="dot"]');
    if(!rows.length||!dots)return false;
    const scale=rows[0].width/220;
    const moving=buttons[0].closest('[data-sequence="page-in"]');
    const translation=moving?(parseFloat(getComputedStyle(moving).translate)||0):0;
    const left=Math.min(...rows.map(r=>r.left))-translation*scale;
    return event.clientX>=left-16*scale && event.clientX<=left+950*scale &&
      event.clientY>=Math.min(...rows.map(r=>r.top))-16*scale && event.clientY<dots.getBoundingClientRect().top;
  }
  async function command(id,fields) {
    if(pending)return;
    pending=true;
    try {await qmqzProfileCommand("menu",JSON.stringify({id,fields}));}
    finally {pending=false;}
  }
  async function overlay(name,nodes,h) {
    return (await h.data(name)).filter(n=>!h.nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
  }
  function maker(h) {
    makerStake=[1,1];makerClock={};speechClock={};h.openDialog("SlotForm");
  }
  const reelIds=[7325,8634,4884,6353];
  const matchCount=ids=>Math.max(0,...ids.map(id=>ids.filter(other=>other===id).length));
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,Math.max(0,ms)));
  // TumbleSlot.Update accelerates at 1000 units/s², caps at 1000 units/s, then focuses after 2.7s.
  function reelFrames(index,first,last) {
    const pitch=120, cycle=7*pitch, initial=((index-first+7)%7)*pitch;
    const frame=(offset,y)=>({offset,translate:"0 "+y+"px"});
    const frames=[];
    const timeAt=distance=>distance<500?Math.sqrt(distance/500):1+(distance-500)/1000;
    const times=Array.from({length:17},(_,i)=>({t:i/16}));
    for(let distance=initial+pitch;distance<=2200;distance+=cycle)times.push({t:timeAt(distance),wrap:true});
    times.push({t:2.7});
    let loops=0;
    for(const {t,wrap} of times.sort((a,b)=>a.t-b.t)) {
      const distance=t<=1?500*t*t:500+1000*(t-1);
      frames.push(frame(t/2.7,initial-distance+loops*cycle));
      if(wrap)frames.push(frame(t/2.7,initial-distance+(++loops)*cycle));
    }
    frames.push(frame(1,((index-last+7)%7)*pitch));
    return frames;
  }
  function paintSlot(el,motion) {
    if(motion.focus)el.style.mixBlendMode="plus-lighter";
    const age=qmqzMenuFX.start(motion.clock);
    const animation=el.animate(motion.frames,motion.options);
    animation.currentTime=age;
  }
  function slotReels(nodes,saved,h) {
    reelIds.forEach((id,i)=>{
      const children=nodes.filter(n=>n.parent===id);
      const cells=children.filter(n=>/^Icon[1-7]$/.test(n.name)).sort((a,b)=>a.name.localeCompare(b.name));
      const icons=cells.map(cell=>nodes.find(n=>n.parent===cell.id&&n.name==="Icon"));
      const cardIds=icons.map(n=>Number(n.widget.image.match(/Icon_Slot_(\d+)/)[1]));
      const spinning=reelMotion?.indices.includes(i);
      const showing=spinning?reelMotion.result.ids[i]:saved?.ids[i];
      const previous=spinning?reelMotion.before?.ids[i]:null;
      const first=Math.max(0,cardIds.indexOf(previous)),last=cardIds.indexOf(showing);
      const empty=children.find(n=>n.name==="Empty");
      h.edit(nodes,empty.id,{active:!showing||spinning&&!previous,z:-3});
      if(spinning&&!previous)empty.slotMotion={clock:reelMotion.clock,frames:[{translate:"0 0"},{translate:"-100px 0"}],
        options:{duration:300,fill:"both"}};
      if(!spinning&&showing&&saved.ids.filter(card=>card===showing).length>1) {
        // TumbleSlot.Focus instantiates laohuji. Its emitter stacks five 0.6s billboards at 30/s.
        const part=h.nodeById(nodes,id);
        for(let particle=0;particle<5;particle++)nodes.push({id:"slot-focus-"+id+"-"+particle,parent:part.parent,
          name:"laohuji",active:true,p:[part.p[0]-4.51,part.p[1]-5.88],s:[289.44,289.44],z:-2,
          widget:{kind:"UITexture",pivot:4,color:[229,122,248,255],depth:0,image:"slot-focus.png"},
          slotMotion:{focus:true,clock:speechClock,frames:[{opacity:0,scale:.954},{offset:.11,opacity:1,scale:.964},
            {offset:.48,opacity:1,scale:.996},{offset:.76,opacity:1,scale:.999},{opacity:0,scale:1}],
            options:{delay:particle*1000/30,duration:600,iterations:Infinity,fill:"both"}}});
      }
      cells.forEach((cell,k)=>{
        cell.active=spinning||k===last;
        if(spinning)icons[k].slotMotion={clock:reelMotion.clock,frames:reelFrames(k,first,last),
          options:{delay:300+reelMotion.indices.indexOf(i)*125,duration:2700,fill:"both"}};
      });
    });
  }
  async function roll(before,result,indices,render) {
    const clock={};
    reelMotion={before,result,indices,clock};
    await render();
    const elapsed=()=>qmqzMenuFX.start(clock);
    for(let i=0;i<indices.length;i++) {
      await pause(3000+i*125-elapsed());
      qmqzAudio("event",46);
    }
    await pause(3500+(indices.length-1)*125-elapsed());
    const matches=matchCount(result.ids);
    qmqzAudio("event",matches>=2?45+matches:50);
    reelMotion=null;speechClock={};
  }
  async function showSlot(nodes,profile,save,h) {
    const {edit,label,dialog,render,openDialog,closeDialog,notify}=h;
    const [m,strings]=await Promise.all([overlay("SlotForm",nodes,h),h.data("strings")]);
    const saved=save.slot,shown=makerRunning?(reelMotion?.before||null):saved;
    const current=saved?[saved.moneytype,saved.multiple]:makerStake;
    // SlotForm's stretched texture is behind the machine, inside the Forms layer above the calling window.
    edit(m,8153,{z:1});
    edit(m,6434,{active:true});edit(m,2004,{active:!makerRunning&&!saved});edit(m,7402,{active:!makerRunning&&!!saved});
    const format=(id,...args)=>strings[id].replace(/\{(\d+)\}/g,(_,k)=>args[k]);
    const balance=n=>n>=100000000?Math.floor(n/10000)+"w":n;
    label(m,4831,format(365,balance(save.study)));label(m,6807,format(366,balance(profile.diamond)));label(m,4766,format(367,balance(profile.gold)));
    const matches=shown?matchCount(shown.ids):0;
    const words=shown?.ids.length===4?(shown.points===shown.best?378:377):373+matches;
    label(m,917,format(words,shown?.points??200*current[1],shown?.best??100000*current[1]));
    [8134,3163,4206].forEach((id,i)=>edit(m,id,{active:i===(matches>=3?2:matches===2?1:0)}));
    edit(m,2442,{sequence:{name:"maker-speech",clock:speechClock,delay:0,duration:500,
      frames:[{translate:"440px 0",scale:0},{translate:"0 0",scale:1}]}});
    for(const light of m.filter(n=>n.parent===7218))light.slotMotion={clock:makerClock,
      frames:[{rotate:"0deg"},{rotate:"180deg"},{rotate:"360deg"}],options:{duration:1000,easing:"steps(2,end)",iterations:Infinity}};
    label(m,4835,saved?.appendCost||"");
    const betIds=[[5536,1,1],[2853,1,10],[1716,0,1],[8958,0,10],[5310,0,100]];
    const interact=(id,fn)=>{if(dialog==="SlotForm"&&!makerRunning)edit(m,id,{action:()=>{if(!makerRunning)fn();}});};
    for(const [id,type,multiple] of betIds) {
      const check=m.find(n=>n.parent===id&&n.name==="Checked");
      if(check)edit(m,check.id,{active:current[0]===type && current[1]===multiple});
      if(!saved)interact(id,()=>{makerStake=[type,multiple];speechClock={};render();});
    }
    slotReels(m,makerRunning?reelMotion?.before:saved,h);
    const run=async(limit,stop,append=false)=>{
      if(makerRunning)return;
      makerRunning=true;render();
      try {
        for(let i=0;i<limit;i++) {
          await command(append?786468:786466,append?{}:{moneytype:makerStake[0],multiple:makerStake[1]});
          const now=(await qmqzReadPosterRole(profile.roleid)).slot;
          if(!now){notify(makerStake[0]?29:28);break;}
          if(append && now.appends===saved.appends)break;
          await roll(append?saved:null,now,append?[3]:[0,1,2],render);
          if(limit===1 || matchCount(now.ids)>=stop)break;
          await command(786470,{});
          notify(356,now.points);
        }
      } finally {reelMotion=null;makerRunning=false;render();}
    };
    if(!saved){
      interact(4394,()=>run(1,0));interact(1614,()=>openDialog("10TimesResearch"));
    } else {
      interact(8830,async()=>{await command(786470,{});notify(356,saved.points);speechClock={};render();});
      interact(3684,()=>{
        if(saved.appends>=3){notify(328);return;}
        if(saved.ids.length===4 && saved.points>=saved.best){notify(330);return;}
        if(profile.gold<saved.appendCost){notify(28);return;}
        run(1,0,true);
      });
    }
    interact(4977,async()=>{if(saved)await command(786470,{});closeDialog();});
    interact(3501,()=>openDialog("OddsTable"));nodes.push(...m);
    if(dialog==="SlotForm")return;
    const nested=await overlay(dialog,nodes,h);
    const back=()=>openDialog("SlotForm");
    if(dialog==="OddsTable"){edit(nested,4792,{active:true});edit(nested,951,{action:back});}
    if(dialog==="10TimesResearch"){
      edit(nested,2396,{active:true});edit(nested,1095,{action:back});
      for(const [id,stop] of [[1398,2],[7604,3]])edit(nested,id,{action:()=>{back();run(10,stop);}});
    }
    nodes.push(...nested);
  }
  function backFromSlot(dialog,profile,openDialog,closeDialog) {
    if(dialog==="OddsTable"||dialog==="10TimesResearch"){openDialog("SlotForm");return true;}
    if(dialog!=="SlotForm")return false;
    if(!makerRunning)qmqzReadPosterRole(profile.roleid).then(async save=>{
      if(save.slot)await command(786470,{});
      closeDialog();
    });
    return true;
  }
  async function displaySlot(nodes,profile,h) {
    await showSlot(nodes,profile,await qmqzReadPosterRole(profile.roleid),h);
  }
  function ask(h,text,yes) {confirmation={text,yes};h.openDialog("UpgradeConfirm");}
  async function showGuide(nodes,profile,save,h,screen) {
    const {edit,label,dialog,closeDialog,openDialog,go}=h;
    if(["SlotForm","10TimesResearch","OddsTable"].includes(dialog)){await showSlot(nodes,profile,save,h);return;}
    if(dialog==="UpgradeConfirm"&&confirmation) {
      const m=await overlay("ConfirmBox",nodes,h);
      edit(m,8009,{active:true});edit(m,5286,{active:false});
      label(m,1335,"提示");label(m,8538,confirmation.text);
      for(const id of [7840,8510])edit(m,id,{active:true,action:closeDialog});
      edit(m,2021,{active:true,action:()=>{const yes=confirmation.yes;closeDialog();yes();}});
      nodes.push(...m);return;
    }
    if(!["ResearchPointsMaker","SplinterMaker"].includes(dialog))return;
    const m=await overlay(dialog,nodes,h);const root=m.find(n=>n.name===dialog);
    edit(m,root.id,{active:true});
    for(const n of m.filter(n=>n.hit)) {
      if(n.name==="Close")edit(m,n.id,{action:closeDialog});
      if(n.name==="Slot")edit(m,n.id,{action:()=>maker(h)});
      if(n.name==="Gacha")edit(m,n.id,{action:()=>qmqzStore.gacha(go,screen)});
    }
    nodes.push(...m);
  }
  function prototype(nodes,part,group,offers,mine,buy,priceId,iconId,profile,h,screen) {
    // GameData.GetItemShopEx / Compare selects the first diamond, honor, then coin offer.
    const rows=offers.filter(r=>r.itemId===group[0].id);
    const shop=rows.find(r=>r.gem>0)||rows.find(r=>r.bloodGem>0)||rows[0];
    h.edit(nodes,buy,{active:!mine&&!!shop});
    if(mine||!shop)return;
    const [field,unit,icon]=shop.gem?["gold","钻石","Icon_Bluegem"]:shop.bloodGem?["diamond","荣誉","Icon_whitegem"]:["money","金币","Icon_gold"];
    const price=qmqzStore.priceOf(shop)[1];
    h.label(nodes,priceId,price);h.picture(nodes,iconId,icon+"-964777403.png");
    h.edit(nodes,buy,{label:"购买原型 "+part.name,action:()=>{
      if(profile.level<shop.unlockLevel){h.notify(166,shop.unlockLevel);return;}
      if(profile[field]<price){
        if(shop.gem)qmqzStore.recharge(h.go,screen);
        else h.notify(shop.bloodGem?29:31);
        return;
      }
      ask(h,"购买 "+part.name+"，消耗 "+price+unit+"？",async()=>{await command(1048577,{id:shop.id,count:1});h.render();});
    }});
  }
  function ratio(nodes,id,fraction,h) {
    const n=h.nodeById(nodes,id);
    if(n)h.edit(nodes,id,{active:fraction>0,s:[n.s[0]*Math.max(0,Math.min(1,fraction)),n.s[1]]});
  }
  function equipLevel(nodes,root,stars,h) {
    const children=nodes.filter(n=>n.parent===root);
    const sprite=children.find(n=>n.widget?.starImages);
    const number=children.find(n=>n.widget?.kind==="UILabel");
    h.edit(nodes,root,{active:stars>0});
    if(sprite)h.picture(nodes,sprite.id,sprite.widget.starImages[stars<4?0:stars<7?1:stars<10?2:3]);
    if(number)h.label(nodes,number.id,stars>=10?stars-9:stars);
  }
  function carouselProgress(nodes,slot,refs,part,group,owned,pieces,h) {
    const final=!group.some(p=>p.version===part.version+1);
    const locked=h.nodeById(nodes,refs.locked);
    const flag=nodes.find(n=>n.parent===slot&&n.name==="Splinter");
    if(flag)h.edit(nodes,flag.id,{active:!final&&owned&&part.parts>0&&pieces>=part.parts,s:[30,30]});
    const prototype=group.find(p=>p.version===0)||group[0];
    const lastStar=prototype.star+group.length-1;
    const large=part.star>=9&&lastStar>9;
    for(const [id,big] of [[refs.transformProccess,false],[refs.bigProccess,true]]) {
      const visible=!final&&large===big;
      h.edit(nodes,id,{active:visible});
      if(!visible)continue;
      const bg=nodes.find(n=>n.parent===id&&n.name==="Background");
      ratio(nodes,bg.id,(big?lastStar-9:Math.min(9-prototype.star,group.length-1))/9,h);
      ratio(nodes,h.nodeById(nodes,id).UISlider.foreground,(big?part.star-9:part.star-prototype.star)/9,h);
    }
    if(final&&locked.widget.maxImage)nodes.push({...locked,id:"max-"+slot,parent:slot,name:"Max",
      p:[52,-44],z:-1,s:locked.widget.maxSize,active:true,widget:{...locked.widget,image:locked.widget.maxImage,border:[]}});
  }
  function legendPerformance(nodes,part,h) {
    equipLevel(nodes,7243,part.star,h);
    const fields=[[6456,"damageBar"],[6833,"shootSpeedBar"],[3725,"DistributionBar"],[3220,"cameraJumpBar"],
      [8163,"runBar"],[2522,"penetrationBar"],[7722,"rangeBar"]];
    if(part.stats) {
      for(const [id,key] of fields) {
        const add=part.stats[key+"Addend"];
        h.label(nodes,id,String(part.stats[key])+(add>0?"+"+add:add<0?String(add):""));
      }
      h.label(nodes,1167,part.stats.clip+"/"+(part.stats.ammo-part.stats.clip));
    } else if(part.melee) {
      for(const id of [5424,4426,2377,4397,4321])h.edit(nodes,id,{active:false});
      h.label(nodes,3620,"速度");h.label(nodes,5193,"伤害范围");
      h.edit(nodes,7722,{p:[52,0]});
      h.label(nodes,6456,part.melee.damageBar);h.label(nodes,6833,part.melee.atkSpeedBar);h.label(nodes,7722,part.melee.rangeBar);
    }
    for(const n of nodes.filter(n=>n.parent===7053&&/^Icon\d+$/.test(n.name)))
      h.edit(nodes,n.id,{active:Number(n.name.slice(4))<=(part.stats||part.melee).bioBar});
  }
  function weaponStats(nodes,part,next,progress,h) {
    const current=part.stats,after=next?.stats||current;
    if(!current)return;
    const {edit,label}=h;
    function pair(parent,before,value,changed) {
      for(const child of nodes.filter(n=>n.parent===parent)) {
        if(child.name==="Arrow")edit(nodes,child.id,{active:changed});
        if(child.name==="Final")label(nodes,child.id,changed?"":before);
        if(child.name==="Before")label(nodes,child.id,changed?before:"");
        if(child.name==="After")label(nodes,child.id,changed?value:"");
      }
    }
    for(const [id,key] of [[5537,"damageBar"],[3960,"shootSpeedBar"],[6480,"DistributionBar"],
        [6188,"cameraJumpBar"],[6873,"runBar"],[869,"penetrationBar"],[6516,"rangeBar"]]) {
      pair(id,current[key]+current[key+"Addend"],after[key]+after[key+"Addend"],!!next);
    }
    label(nodes,6360,current.clip+"/"+(current.ammo-current.clip));
    edit(nodes,4324,{active:!!current.spSkill});label(nodes,3913,current.spSkill);
    const amount=current.heroBasicDamageBar+current.heroDamageAddendBar*progress;
    const val=progress<part.maxHolding?amount+current.heroDamageAddendBar:after.heroBasicDamageBar;
    pair(7116,next||progress<part.maxHolding?Math.ceil(amount):current.heroBasicDamageBar,Math.ceil(val),progress<part.maxHolding||!!next);
    edit(nodes,6298,{active:current.bioBar<1});
    for(const n of nodes.filter(n=>n.parent===8349&&n.name.startsWith("Icon")))
      edit(nodes,n.id,{active:Number(n.name.slice(4))<=current.bioBar});
    const diamonds=[2393,5178,8973,2354,4915,4691,4,6080];
    diamonds.forEach((id,i)=>edit(nodes,id,{active:!next||i<progress}));
    edit(nodes,1749,{active:!next});
    edit(nodes,7412,{active:part.pieceId>0||!!next&&part.parts>0});label(nodes,6850,part.parts||"");
  }
  async function display(screen,nodes,profile,h) {
    const [d,save]=await Promise.all([h.data("upgrade-data"),qmqzReadPosterRole(profile.roleid)]);
    const {edit,label,picture,nodeById,go,render}=h;
    const groups=new Map();
    for(const row of d.parts) {
      if(!groups.has(row.modelType))groups.set(row.modelType,[]);
      groups.get(row.modelType).push(row);
    }
    const owned=new Set(save.items);
    const current=group=>group.find(r=>r.version===save.legendVersions?.[r.modelType])||
      group.filter(r=>owned.has(r.id)).sort((a,b)=>b.version-a.version)[0]||group[0];
    await showGuide(nodes,profile,save,h,screen);
    if(screen==="UpgradeListWindow") {
      inspectedId=0;
      edit(nodes,2684,{action:()=>typeof returnTo==="function"?returnTo():go(returnTo)});
      label(nodes,4093,save.study);
      edit(nodes,3731,{action:()=>qmqzPosters.destination("FusionWindow",go,screen)});
      edit(nodes,4643,{action:()=>qmqzStore.gacha(go,screen)});
      edit(nodes,7213,{active:true,action:()=>maker(h)});
      const entries=[...groups.values()].map(current);
      const legend=entries.filter(r=>r.rarity===1), general=entries.filter(r=>r.rarity!==1);
      general.sort((a,b)=>Number(owned.has(b.id))-Number(owned.has(a.id))||b.family-a.family||b.star-a.star||a.id-b.id);
      const all=(save.cards>0||legend.some(r=>owned.has(r.id)))?legend.concat(general):general;
      pageCount=Math.ceil(all.length/12);page=Math.min(page,pageCount-1);
      const turn=pageTurn;
      for(const [panel,shownPage] of [[1414,page],[1764,turn?.from]]){
        edit(nodes,panel,{active:shownPage!==undefined});
        if(shownPage===undefined)continue;
        if(turn){
          const x=950*turn.direction, entering=panel===1414;
          edit(nodes,panel,{sequence:{name:entering?"page-in":"page-out",clock:turn.clock,delay:0,duration:350,
            frames:[{translate:(entering?x:0)+"px 0",easing:qmqzMenuFX.smooth},{translate:(entering?0:-x)+"px 0"}]}});
        }
        d.pages[panel].itemSlots.forEach((slot,i)=>{
          const row=all[shownPage*12+i],refs=d.slots[slot];
          edit(nodes,slot,{active:!!row,s:[1,1]});
          if(!row)return;
          label(nodes,refs.partsName,row.name);picture(nodes,refs.weapon,row.image);
          edit(nodes,refs.locked,{active:!owned.has(row.id)});
          equipLevel(nodes,refs.level,row.star,h);
          carouselProgress(nodes,slot,refs,row,groups.get(row.modelType),owned.has(row.id),save.counts[row.pieceId]||0,h);
          if(panel===1414)edit(nodes,slot,{action:()=>{pageTurn=null;model=row.modelType;inspectedId=0;legendDetail=false;go(row.type===1?"PromoteWindow":"NewPromoteWindow");},label:row.name});
        });
      }
      const dots=nodes.filter(n=>n.name==="dot"&&n.parent===4132).sort((a,b)=>a.p[0]-b.p[0]);
      dots.forEach((dot,i)=>{
        edit(nodes,dot.id,{active:i<pageCount,action:()=>selectPage(i,render),label:"第"+(i+1)+"页"});
        const background=nodes.find(n=>n.parent===dot.id&&n.name==="Background");
        picture(nodes,background.id,(i===page?"Bar_next2":"Bar_next")+"-964777403.png");
      });
      return;
    }
    const group=groups.get(model);
    if(!group)return;
    const part=group.find(r=>r.id===inspectedId)||current(group), next=group.find(r=>r.version===part.version+1);
    const progress=Number(save.progress[part.id]||0), pieces=save.counts[part.pieceId]??Number(owned.has(part.pieceId));
    edit(nodes,2684,{action:()=>{if(typeof returnTo==="function")returnTo();else go("UpgradeListWindow");}});
    if(screen==="PromoteWindow") {
      const text=await h.data("strings"),mine=owned.has(part.id);
      if(!next)legendDetail=false;
      edit(nodes,895,{active:false});edit(nodes,3353,{active:!legendDetail});edit(nodes,4919,{active:legendDetail});
      edit(nodes,3890,{active:false});edit(nodes,8291,{active:!next});edit(nodes,5033,{active:true});
      label(nodes,2622,part.name);picture(nodes,2271,part.detailImage||part.image);label(nodes,456,part.name);
      const hint=nodeById(nodes,472);
      hint.widget={...hint.widget,maxWidth:300};
      if(!next)legendPerformance(nodes,part,h);
      edit(nodes,4155,{active:!!next,action:()=>{if(!mine){h.notify(574,part.name);return;}legendDetail=true;render();}});
      label(nodes,8702,save.cards);label(nodes,4533,next?text[537].replace("{0}",next.price):"");
      label(nodes,6176,text[next?20003:20004]);label(nodes,8101,part.name);picture(nodes,8602,part.image);label(nodes,572,part.star);
      if(next){label(nodes,812,next.name);picture(nodes,634,next.image);label(nodes,7114,next.star);}
      const getCard=()=>ask(h,text[580],()=>qmqzRoulette.enter(go,screen,true));
      edit(nodes,3839,{action:getCard});
      if(next)edit(nodes,558,{active:!owned.has(next.id)||save.legendVersions?.[part.modelType]===part.version,action:async()=>{
        if(save.cards<next.price){h.notify(536);getCard();return;}
        await command(786459,{gunid:part.id,newgunid:next.id});render();
      }});
      return;
    }
    if(screen==="NewPromoteWindow") {
      const u=d.units[3075];
      weaponStats(nodes,part,next,progress,h);
      edit(nodes,3075,{active:true});edit(nodes,6139,{active:false});edit(nodes,8014,{active:false});
      label(nodes,u.title,part.name);picture(nodes,u.texture,part.detailImage||part.image);
      equipLevel(nodes,u.stars,part.star,h);
      const tag=nodeById(nodes,u.levelTag)?.widget?.tagImages?.[part.levelTag];
      edit(nodes,u.levelTag,{active:!!tag});if(tag)picture(nodes,u.levelTag,tag);
      edit(nodes,u.advance,{active:!!next});edit(nodes,u.final,{active:!next});
      label(nodes,u.pointCount,save.study);label(nodes,u.pieceCount,pieces);edit(nodes,u.buy,{active:false});
      const below=progress<part.maxHolding, mine=owned.has(part.id);
      prototype(nodes,part,group,(await h.data("store")).offers,mine,u.buy,u.price,u.currency,profile,h,screen);
      edit(nodes,u.pointProgObj,{active:below});
      edit(nodes,u.pieceProgObj,{active:!below&&part.pieceId>0});
      label(nodes,u.point_progress,part.price?Math.min(save.study,part.price)+"/"+part.price:"");
      label(nodes,u.piece_progress,part.parts?Math.min(pieces,part.parts)+"/"+part.parts:"");
      ratio(nodes,3006,part.price?save.study/part.price:0,h);ratio(nodes,1345,part.parts?pieces/part.parts:0,h);
      edit(nodes,u.strength,{active:!!next&&mine&&below,action:async()=>{
        if(save.study<part.price){h.openDialog("ResearchPointsMaker");return;}
        await command(786477,{gunid:part.id});render();
      }});
      edit(nodes,u.promote,{active:!!next&&!owned.has(next.id)&&mine&&!below,action:async()=>{
        if(pieces<part.parts){h.openDialog("SplinterMaker");return;}
        if(next){await command(786459,{gunid:part.id,newgunid:next.id});render();}
      }});

    }
  }
  window.qmqzUpgrade={open,item,display,inCarousel,turn,maker,displaySlot,backFromSlot,paintSlot};
})();

