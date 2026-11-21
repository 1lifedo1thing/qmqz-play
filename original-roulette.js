(() => {
  "use strict";
  const infoId=1048588, normalDraw=1048585, advancedDraw=1048639, reset=1048641;
  let plate=0, cash=0, vip=0, credits=0, tickets=0;
  let info={}, gifts=[], finished=[], busy=false, ready=false, highlight=-1, animation=0, resetting=false;
  let selected=0, exchangeOffset=0, firstCallback=null, celebration=null, catalog, showNotice;
  const send=(id,fields={})=>window.qmqzUnity.SendMessage("WebClient","Command","original-menu:"+JSON.stringify({id,fields}));
  const balance=()=>window.qmqzUnity.SendMessage("WebClient","Command","original-menu:"+JSON.stringify({view:"recharge-status"}));
  function changePlate(next) {
    plate=next;ready=false;highlight=-1;info={};busy=false;resetting=false;celebration=null;animation++;
    send(infoId,{lotterytype:next});
  }
  function enter(go,from,advanced=false) {
    go("RouletteWindow");changePlate(advanced?2:0);
  }
  function first(go,open) {
    if(firstCallback)return;
    firstCallback=()=>cash?window.qmqzStore.recharge(go,"MainUI"):open("FirstRechargeInfo");
    balance();
  }
  const modal=async(name,nodes,{data,nodeById})=>(await data(name)).filter(n=>!nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
  async function firstDialog(nodes,api) {
    const overlay=await modal("FirstRechargeInfo",nodes,api);
    api.edit(overlay,7254,{active:true});api.edit(overlay,3088,{action:api.closeDialog});
    api.edit(overlay,470,{action:()=>window.qmqzStore.recharge(api.go,"MainUI")});
    api.label(overlay,5484,"本地免费充值\n\n钻石按页面所示的档位和赠送数量到账。领取任一档位即可开启幸运转盘，累计达到原 VIP 3 档位后可进入神秘转盘。");
    nodes.push(...overlay);
  }
  function spinTo(index,count,prize,redraw) {
    const epoch=++animation;
    const advanced=plate===2, pass=advanced?16:28;
    const minimum=advanced?50:40, maximum=advanced?200:150, idle=advanced?1000:100;
    const available=Array.from({length:count},(_,i)=>i).filter(i=>!advanced||i===index||!finished.includes(i));
    const started=performance.now();
    celebration=null;
    let pos=available.indexOf(highlight<0?0:highlight), steps=0;
    function tick() {
      if(epoch!==animation)return;
      pos=(pos+1)%available.length;highlight=available[pos];steps++;
      if(steps>pass && highlight===index) {
        const row=catalog.prizes.find(r=>r.id===prize.id);
        celebration={clock:{start:performance.now()},large:!!row?.broadcast};
        qmqzAudio("event",row?.broadcast?45:44);
        redraw();
        setTimeout(()=>{
          if(epoch!==animation)return;
          const units=["金币","荣誉","钻石","经验","积分"];
          const kind=["gold","honor","gem","exp","coupon"].findIndex(k=>row?.[k]>0);
          if(row?.poolRatio||kind>=0)showNotice(row.poolRatio?334:333,[prize.value,row.poolRatio?"钻石":units[kind]]);
          if(advanced&&finished.length===8){resetting=true;send(reset);}
          else busy=false;
          redraw();
        },idle);
        return;
      }
      qmqzAudio("event",43);
      redraw();
      setTimeout(tick,Math.max(minimum,maximum-(performance.now()-started)));
    }
    setTimeout(tick,maximum/2);
  }
  function protocol({id,fields:f},view,open,redraw) {
    if(id===1048606) {
      cash=f.cashall;vip=f.viplevel;
      if(firstCallback){const cb=firstCallback;firstCallback=null;cb();}
    }
    if(view!=="RouletteWindow")return;
    switch(id) {
      case 1048595: credits=f.ticketnum;break;
      case 1048596: tickets=f.ticketnum;break;
      case 1048589: info=f;plate=f.lotterytype;ready=plate===0;break;
      case 1048642: if(resetting){resetting=false;busy=false;}gifts=f.lotterys;finished=f.finishids;ready=true;break;
      case 1048586: if(f.lottery.id>=1 && f.lottery.id<=14)spinTo(f.lottery.id-1,14,f.lottery,redraw);return;
      case 1048640: spinTo(f.pos,8,f.lottery,redraw);return;
      case 1048609: busy=false;break;
      default:return;
    }
    redraw();
  }
  window.addEventListener("qmqz-state",({detail:s})=>{if(s.storageError){busy=false;firstCallback=null;}});
  const sprite=(name)=>name==="Icon_gold"||name==="Icon_whitegem"||name==="Icon_exp"?name+"-964777403.png":name+"--2078032047.png";
  function prize(row,config,value) {
    if(!row)return "";
    if(row.id===25 && row.type===4)return config.legend;
    if(row.poolRatio)return value===undefined?row.poolRatio/100+"% 奖池钻石":value+" 钻石";
    if(row.item){const count=row.itemNum>1?" ×"+row.itemNum:"";return (config.items[row.item]?.name||String(row.item))+count;}
    for(const [key,unit] of [["gold","金币"],["honor","荣誉"],["gem","钻石"],["exp","经验"],["coupon","积分"]])if(row[key])return row[key]+" "+unit;
    return "";
  }
  function scroll(value) {exchangeOffset=Math.max(0,Math.min(260,value));}
  async function display(nodes,state,api) {
    const {edit,label,picture,clonePrefab,nodeById,data,go,openDialog,closeDialog,notify,redraw,dialog}=api;
    const [cfg,effects]=await Promise.all([data("roulette-prizes"),data("menu-particles")]), advanced=plate===2, profile=state.profile||{};
    catalog=cfg;showNotice=notify;
    const byId=id=>cfg.prizes.find(r=>r.id===id),child=(id,name)=>nodes.find(n=>n.parent===id&&n.name===name);
    const show=(id,active)=>edit(nodes,id,{active});
    const act=(id,action,name)=>edit(nodes,id,{action,...(name?{label:name}:{})});
    function inspect(row,inList=false){
      const parent=inList?"ExchangeDialog":"";
      data("inventory").then(inventory=>{
        const item=inventory.items.find(v=>v.id===row.item);
        if(item)qmqzStoreItems.open(item,openDialog,"RouletteWindow",parent);
        else qmqzShopPrizes.info(prize(row,cfg),cfg.items[row.item]?.info||prize(row,cfg),"RouletteWindow",api,parent);
      });
    }
    show(6971,true);show(8305,!advanced);show(922,!advanced);show(4994,advanced);show(8834,false);show(591,false);
    show(4855,advanced);show(4088,!advanced);
    label(nodes,911,credits);label(nodes,2175,credits);label(nodes,2220,info.cashpool||0);
    label(nodes,3376,cfg.spinPrice*Math.max(0,1-tickets));label(nodes,8267,cfg.spinPrice*Math.max(0,10-tickets));
    label(nodes,6663,cfg.prices[Math.min(finished.length,7)].price);
    show(554,finished.length===8);show(4316,finished.length!==8);
    act(568,()=>{animation++;busy=false;go("MainUI");});
    act(1593,()=>{if(!busy&&advanced)changePlate(0);});
    act(3431,()=>{if(busy||advanced)return;if(vip<3){notify(519,3);return;}changePlate(2);});
    act(962,()=>openDialog("RouletteHelp"));
    function draw(count) {
      if(!ready||busy)return;
      if(cash<=0){openDialog("OpenRoulette");return;}
      const cost=advanced?cfg.prices[Math.min(finished.length,7)].price:cfg.spinPrice*Math.max(0,count-tickets);
      if(profile.gold<cost){window.qmqzStore.recharge(go,"RouletteWindow");return;}
      busy=true;redraw();send(advanced?advancedDraw:normalDraw,advanced?{}:{multiple:count});
    }
    act(317,ready&&!busy?()=>draw(1):null,"转动一次");act(5662,ready&&!busy?()=>draw(10):null,"转动十次");act(7509,ready&&!busy?()=>draw(1):null,"高级转动");
    act(1342,()=>{if(!ready||busy)return;if(finished.length<8 && profile.money<500){notify(579);return;}busy=true;resetting=true;send(reset);},"刷新转盘");
    const exchange=()=>{if(busy)return;selected=0;exchangeOffset=0;openDialog("ExchangeDialog");};
    act(8445,exchange);act(2221,exchange);
    const order=nodeById(nodes,advanced?1069:7364).lotteryOrder;
    const frame=(await data("RouletteHighlight"))[0];
    order.forEach((node,pos)=>{
      const id=advanced?gifts[pos]:nodeById(nodes,node).lotteryId,row=byId(id);
      if(!row)return;
      const part=name=>child(node,name)?.id, item=cfg.items[row.item], name=prize(row,cfg);
      label(nodes,part("Label"),name);
      const image=item?.icon,tex=part("Texture"),icon=part("Icon");
      if(tex){show(tex,!!image);if(image)picture(nodes,tex,image);}
      show(icon,!image);if(!image)picture(nodes,icon,sprite(row.icon));
      show(part("State"),!!row.state);show(part("LevelTag"),false);
      picture(nodes,part("Background"),sprite(row.bg));
      if(advanced)show(part("Block"),finished.includes(pos));
      if(!busy&&(!advanced||!finished.includes(pos)))act(node,()=>inspect(row),name);
      if(highlight===pos){
        const bg=child(node,"Background");
        nodes.push({...frame,id:"wheel-highlight",parent:node,p:[0,0],s:bg.s,z:-2});
        if(celebration){
          qmqzMenuFX.particle(nodes,effects,"xinyunchoujiang",node,celebration.clock,0,{z:-3,loop:true});
          qmqzMenuFX.particle(nodes,effects,celebration.large?"zhongjiangda":"zhongjiangxiao",
            advanced?1069:7364,celebration.clock,0,{z:-4,hideAfter:2000});
        }
      }
    });
    const winners=await data("WinnerListItem");
    (info.lotteryhistory||[]).slice().reverse().forEach((h,i)=>nodes.push(...clonePrefab(winners,"wheel-winner-"+i+"-",7700,-i*42,{979:prize(byId(h.id),cfg,h.value),1211:h.rolename})));
    const big=info.cashlottery;
    if(big?.rolename){label(nodes,306,big.rolename);label(nodes,6246,prize(byId(big.id),cfg,big.value));}
    if(dialog==="OpenRoulette"){
      const m=await modal(dialog,nodes,api);edit(m,1212,{active:true});edit(m,8596,{action:closeDialog});
      edit(m,914,{action:()=>window.qmqzStore.recharge(go,"RouletteWindow")});nodes.push(...m);
    } else if(dialog==="RouletteHelp"){
      const m=await modal(dialog,nodes,api),strings=await data("strings");
      edit(m,8361,{active:true});edit(m,3682,{action:closeDialog});
      label(m,8618,advanced?"神秘转盘帮助":"幸运转盘帮助");label(m,2162,strings[advanced?20012:20001]);label(m,8377,advanced?"":strings[20002]);nodes.push(...m);
    } else if(dialog==="ExchangeDialog"||(["StoreItemDetails","PrizeInfo"].includes(dialog)&&qmqzStoreItems.previous()==="ExchangeDialog")){
      const onList=dialog==="ExchangeDialog";
      const m=await modal("ExchangeDialog",nodes,api),prefab=await data("ExchangeListItem");
      edit(m,4667,{active:true});edit(m,8314,{action:onList?closeDialog:null});label(m,651,credits);
      const table=nodeById(m,1643);table.p=[table.p[0],table.p[1]+exchangeOffset];
      edit(m,6710,{active:false});
      cfg.exchange.forEach((row,i)=>{
        const head="exchange-"+row.id+"-",text=prize(row,cfg), x=103+(i%3)*207,y=-63-Math.floor(i/3)*131;
        const r=clonePrefab(prefab,head,1643,y,{1286:text,1085:row.coupon},{p:[x,y],label:text,action:onList?()=>{selected=row.id;redraw();}:null});
        const item=cfg.items[row.item];
        edit(r,head+1408,{active:!!item?.icon});edit(r,head+999,{active:!item?.icon});edit(r,head+1438,{active:false});
        if(item?.icon)picture(r,head+1408,item.icon);else picture(r,head+999,sprite(row.icon));
        if(selected===row.id){const h=nodeById(m,6710);r.push({...h,id:"wheel-selected",parent:head+1373,p:[0,0],active:true});}
        m.push(...r);
      });
      const row=cfg.exchange.find(r=>r.id===selected);
      edit(m,3180,{action:onList&&row?()=>inspect(row,true):null});
      edit(m,1641,{action:onList&&row?()=>{if(busy)return;if(credits<row.coupon){notify(411);return;}busy=true;send(1048608,{exchangeid:row.id});}:null});
      nodes.push(...m);
    }
  }
  window.qmqzRoulette={enter,display,protocol,first,firstDialog,offset:()=>exchangeOffset,scroll};
})();
