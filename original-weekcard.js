(() => {
  "use strict";
  // WeekCardSync clears the other weekly tier in the original ActivityManager.
  let selected=2, until={}, offset=0, pending=0, receipt="", clock={},
    api=null,scrollMax=0;
  const epoch=1356998400;
  const rows={
    1:{button:7991,panel:7381,grid:6178,time:4581,remaining:5940,vip:301,honor:828},
    2:{button:4558,panel:929,grid:255,time:1528,remaining:6366,price:1667,renew:7352,vip:6900,honor:2438},
    3:{button:4981,panel:8628,grid:6352,time:8700,remaining:5219,price:3867,renew:3875,vip:8656,honor:4948}
  };
  const cells={2:[[8340,5860,8403],[5481,3017,6045],[6449,1527,4702]],
    3:[[6794,2147,830],[3883,4467,2552],[6364,5794,7825],[436,4990,646],[3803,4966,2215]]};
  const left=id=>Math.max(0,(until[id]||0)-Date.now()/1000);
  const shown=()=>document.querySelector("#original-menu")?.dataset.screen==="WeekCardWindow";
  function choose(id) {selected=id;offset=0;clock={};}
  function open(go,previous,id=2) {
    if(previous==="WeekCardWindow")return;
    choose(id);pending=0;until={};go("WeekCardWindow");
    qmqzUnity.SendMessage("WebClient","Command","original-menu:"+JSON.stringify({view:"week-cards"}));
  }
  window.addEventListener("qmqz-protocol",e=>{
    const {id,fields:f}=e.detail;
    if(id===1048597){delete until[f.cardid===2?3:2];until[f.cardid]=f.desttime+epoch;}
    else if(id===1048598){until[1]=f.desttime>0?f.desttime+epoch:0;}
    else if(id===1048594 && pending===f.cardid) {
      pending=0;receipt= f.cardid===1?"月卡已在本地开通。":"购买成功，有效期七天。";
      if(shown())api?.openDialog("WeekReceipt");
    } else if(id===1048605 && shown()) {
      receipt="本日月卡到账："+f.addgem+" 钻石、"+f.researchpoint+" 强化点。";api?.openDialog("WeekReceipt");
    } else return;
    if(shown())api?.redraw();
  });
  window.addEventListener("qmqz-state",e=>{
    if(!pending||!e.detail?.storageError)return;
    pending=0;receipt="保存失败，请重试。";if(shown())api?.openDialog("WeekReceipt");
  });
  function send(h,id){
    if(pending)return;
    pending=id;
    const p=id===1?{id:1048580,fields:{cashitemid:-1}}:{id:1048593,fields:{cardid:id}};
    h.command("original-menu:"+JSON.stringify(p));
  }
  async function modal(nodes,h,kind,cards) {
    const m=(await h.data("ConfirmBox")).filter(n=>!h.nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
    h.edit(m,8009,{active:true});h.label(m,1335,kind==="WeekUpgrade"?"周卡升级":"提示");
    h.label(m,8538,kind==="WeekUpgrade"?"本地升级黄金周卡将消耗 "+cards[3].priceGem+" 钻石，有效期从现在起七天。现有周卡剩余时间不会折现。":receipt);
    for(const id of [2021,8510])h.edit(m,id,{active:kind==="WeekUpgrade"});
    h.edit(m,5286,{active:kind!=="WeekUpgrade",action:h.closeDialog});h.edit(m,7840,{action:h.closeDialog});
    h.edit(m,8510,{action:h.closeDialog});h.edit(m,2021,{action:()=>{h.closeDialog();send(h,3);}});nodes.push(...m);
  }
  async function display(nodes,state,h) {
    api=h;
    const [config,inventory,effects]=await Promise.all([h.data("store-rewards"),h.data("inventory"),h.data("week-particles")]);
    const cards=Object.fromEntries(config.cards.map(r=>[r.id,r])), current=cards[selected];
    h.edit(nodes,8721,{active:true});h.edit(nodes,568,{action:()=>{api=null;h.go("MainUI");}});
    for(const [key,r] of Object.entries(rows)) {
      const id=Number(key),card=cards[id],active=left(id)>0;
      h.edit(nodes,r.panel,{active:selected===id});
      h.edit(nodes,r.button,{label:card.name,action:()=>{if(!pending && selected!==id){choose(id);h.redraw();}}});
      h.edit(nodes,r.time,{active});h.label(nodes,r.remaining,"剩余 "+Math.ceil(left(id)/86400)+" 天");
      h.label(nodes,r.vip,"经验 +"+card.addExp+"%   金币 +"+card.addGold+"%");
      h.label(nodes,r.honor,id===1?card.honorTip:card.honorTip+"\n本地结算只发金币、经验加成。");
      if(r.price) {
        h.edit(nodes,r.renew,{active});h.label(nodes,r.price,active?card.renewGem:card.priceGem);
      }
      for(const [i,[root,name,icon]] of (cells[id]||[]).entries()) {
        const item=inventory.items.find(v=>v.id===card.item._items[i]);if(!item)continue;
        h.label(nodes,name,item.name);h.picture(nodes,icon,item.icon);
        h.edit(nodes,root,{itemId:item.id,label:item.name,action:()=>qmqzStoreItems.open(item,h.openDialog,"WeekCardWindow")});
      }
    }
    const card=rows[selected],grid=card.grid;
    if(!h.dialog)qmqzMenuFX.particle(nodes,effects,"lingqu01",card.button,clock,0,{z:-3,loop:true});
    const tiles=nodes.filter(n=>n.parent===grid&&n.active);
    scrollMax=Math.max(0,-Math.min(...tiles.map(n=>n.p[1]))+82-258);
    for(const n of tiles)n.p=[n.p[0],n.p[1]+offset];
    h.label(nodes,4532,"每日首次登录返还："+cards[1].dailyGem+"钻石、"+cards[1].dailyRP+"强化点（30天）");
    h.label(nodes,1626,"本地免费月卡");
    const active=left(selected)>0;
    const caption=selected===1?(active?"已开通":"本地开通（免费）"):(active?"续期":"购买")+" "+current.priceGem+"钻";
    h.label(nodes,910,caption);
    if(selected!==1 && active) {
      const sample=h.nodeById(nodes,910);
      nodes.push({...sample,id:"week-renewal-charge",parent:8966,p:[523,-252],s:[17,17],widget:{...sample.widget,
        text:"本地实扣 "+current.priceGem+" 钻\n自本次购买起七天",maxWidth:220,maxLines:2}});
    }
    h.edit(nodes,2511,{label:caption,action:()=>{
      if(pending)return;
      if(selected===1&&active){receipt="月卡已生效，本日福利只到账一次。";h.openDialog("WeekReceipt");return;}
      if(selected!==1 && state.profile.gold<current.priceGem){h.notify(30);return;}
      if(selected===2&&left(3)>0){h.notify(392);return;}
      if(selected===3&&left(2)>0){h.openDialog("WeekUpgrade");return;}
      send(h,selected);
    }});
    if(h.dialog && ["WeekReceipt","WeekUpgrade"].includes(h.dialog))await modal(nodes,h,h.dialog,cards);
  }
  window.qmqzWeekCards={open,display,goldActive:()=>left(3)>0,offset:()=>offset,scroll:v=>{offset=Math.min(scrollMax,Math.max(0,v));}};
})();
