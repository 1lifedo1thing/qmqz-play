(() => {
  "use strict";
  let group=8,currency="",subtype=0,offset=0,total=0,viewFilter="",selection=null;
  const filters=new Map();
  let listKey="";
  const offerEntries=new Map();
  let gachaOffset=0, gachaBack="MainUI", rechargeTab=0, rechargeBack="StoreWindow", pending=null, receipt=null, lastDraw=null;
  const pools=[
    {id:1048646,buttons:[3959,7612],prices:[14,16],name:"荣誉抽奖"},
    {id:1048647,buttons:[5115,6738],prices:[15,17],name:"钻石抽奖"},
    {id:1048656,buttons:[7864,3599],prices:[18,19],name:"高级抽奖"}
  ];
  const send=(id,fields)=>window.qmqzUnity?.SendMessage("WebClient","Command","original-menu:"+JSON.stringify({id,fields}));
  const setOffset=n=>{offset=Math.max(0,Math.min(n,Math.max(0,Math.ceil(total/2)*236-520)));};
  const tabIds=[[5422,8],[1800,1],[4054,2],[2783,3],[4482,4],[4255,5]];
  function gacha(go,back="MainUI"){begin();gachaBack=back;go("GachaWindow");}
  function begin(){gachaBack="MainUI";listKey="";qmqzShopPrizes.begin();group=8;offset=0;selection=null;currency="";subtype=0;viewFilter="";filters.clear();gachaOffset=0;rechargeTab=0;lastDraw=null;}
  function filterProgress(m,now) {
    const age=Math.min(1,(now-m.start)/m.duration);
    return m.from+(m.to-m.from)*age;
  }
  function changeFilter(name,redraw) {
    const now=performance.now();
    for(const type of ["model","currency"]){
      const prior=filters.get(type), to=Number(type===name);
      if((prior?.to||0)===to)continue;
      const from=prior?filterProgress(prior,now):0;
      const motion={from,to,start:now,duration:Math.max(1,Math.abs(to-from)*500)};
      filters.set(type,motion);
      if(!to)setTimeout(()=>{if(filters.get(type)===motion){filters.delete(type);redraw();}},motion.duration);
    }
    viewFilter=name;redraw();
  }
  function recharge(go,back,tab=0){
    rechargeBack=back;rechargeTab=tab;go("RechargeWindow");
  }
  function request(kind,id,fields,extra={}) {
    if(pending)return;
    pending={kind,...extra};
    send(id,fields);
  }
  function protocol(detail,view,openDialog,redraw) {
    qmqzShopPrizes.protocol(detail,redraw);
    if(!pending)return;
    const f=detail.fields||{},q=pending;
    if(q.kind==="draw" && [1048648,1048649].includes(detail.id)){
      pending=null;
      if(view!=="GachaWindow")return;
      if(detail.id===1048649 && f.gachas?.length){
        const d=lastDraw={...q,ids:f.gachas,status:f.status||[],clock:{}};
        d.clock.onStart=()=>{
          qmqzAudio("event",57);
          d.ids.forEach((_,i)=>setTimeout(()=>{
            if(lastDraw===d && document.querySelector('[data-sequence="gacha-item"]'))qmqzAudio("event",51);
          },1500+i*300));
        };
        openDialog("GachaPrize");
      }else{
        receipt=q.pool===2&&q.level<50?"高级抽奖需要达到50级。":f.reason===1?"抽奖所需货币不足。":"本次抽奖失败，请稍后再试。";
        openDialog("StoreReceipt");
      }
    }else if(q.kind==="gems" && detail.id===1048582 && f.cashitemid===q.id){
      pending=null;receipt=f.result===0?"本地免费充值成功，获得 "+f.localGems+" 钻石。":"充值失败。";
      if(view==="RechargeWindow")openDialog("StoreReceipt");
    }else if(q.kind==="honor" && detail.id===1048584 && f.rechargeid===q.id){
      pending=null;receipt=f.honor?"消耗 "+f.usegold+" 钻石，获得 "+f.honor+" 荣誉。":"钻石不足，未兑换荣誉。";
      if(view==="RechargeWindow")openDialog("StoreReceipt");
    }else if(q.kind==="week" && detail.id===1048594 && f.cardid===q.id){
      pending=null;receipt="周卡购买成功。";if(view==="RechargeWindow")openDialog("StoreReceipt");
    }else if(q.kind==="month" && detail.id===1048598){
      pending=null;receipt="月卡已生效。每天首次领取可获得本期月卡奖励。";
      if(view==="RechargeWindow")openDialog("StoreReceipt");
    }
  }
  function finishPurchase(id,protocol) {
    if (!selection?.pending || selection.row.id !== id || protocol!==(selection.actor?786446:1048578)) return false;
    selection.pending=false;
    return true;
  }
  window.addEventListener("qmqz-state",({detail})=>{
    if (detail.storageError){pending=null;if(selection)selection.pending=false;}
  });
  function priceOf(row) {
    const currency=row?.gem?"gem":row?.bloodGem?"bloodGem":"gold";
    const list=row?.[currency]||0;
    return [currency,row?.discount===1 ? Math.ceil(list/2) : list,list];
  }
  async function shell(screen,nodes,profile,api) {
    const {data,edit,label,picture,nodeById,go}=api;
    const shell=(await data("StoreShell")).filter(n=>!nodeById(nodes,n.id)).map(n=>({...n}));
    const bg=(await data("MainUI")).find(n=>n.id===7805);
    nodes.push(...shell,{...bg});edit(nodes,1066,{active:true});edit(nodes,5531,{active:true});
    edit(nodes,568,{action:()=>go(screen==="RechargeWindow"?rechargeBack:screen==="GachaWindow"?gachaBack:"MainUI")});
    edit(nodes,3822,{action:()=>{if(screen!=="GachaWindow")gachaBack="MainUI";qmqzShopPrizes.begin();go("GachaWindow");}});
    edit(nodes,3871,{action:()=>{begin();go("StoreWindow");}});
    edit(nodes,1129,{action:()=>{if(screen!=="ActivityForm")window.qmqzPosters.destination("ActivityForm|6",go,screen);}});
    edit(nodes,2561,{action:()=>window.qmqzRoulette.enter(go,screen==="RouletteWindow"?screen:"MainUI")});
    edit(nodes,773,{action:()=>qmqzWeekCards.open(go,screen)});
    const {storeTabs,pages}=await data("window-navigation"),active=pages[screen==="RechargeWindow"?rechargeBack:screen];
    for(const [name,tab] of Object.entries(storeTabs)){
      const style=tab.states[Number(name===active)];
      picture(nodes,tab.icon,style.image);picture(nodes,tab.background,style.plate);
      const text=nodeById(nodes,tab.label);
      text.widget={...text.widget,color:style.color,foot:style.foot,shadow:style.shadow};
    }
    edit(nodes,1926,{label:"钻石充值",action:()=>recharge(go,screen==="RechargeWindow"?rechargeBack:screen)});
    edit(nodes,7441,{label:"荣誉兑换",action:()=>recharge(go,screen==="RechargeWindow"?rechargeBack:screen,1)});
    // Original server uses role.money for client gold, role.gold for client gem and role.diamond for honor.
    label(nodes,1908,profile.money);label(nodes,2605,profile.gold);label(nodes,1491,profile.diamond);
  }
  async function display(screen,nodes,state,api) {
    const {data,edit,label,picture,clonePrefab,nodeById,command,go,openDialog,closeDialog,dialog,notify,redraw}=api;
    const [store,catalog,strings]=await Promise.all([data("store"),data("inventory"),data("strings")]);
    const profile=state.profile||{}, owned=profile.equipment?.ownedItems||[];
    await shell(screen,nodes,profile,api);
    if(dialog==="PrizeInfo")await qmqzShopPrizes.showInfo(nodes,api);
    if(screen==="RouletteWindow"){await window.qmqzRoulette.display(nodes,state,api);return;}
    if(screen==="WeekCardWindow"){await qmqzWeekCards.display(nodes,state,api);return;}
    const child=(list,parent,name)=>list.find(n=>n.parent===parent && n.name===name);
    const modalNodes=async name=>(await data(name)).filter(n=>!nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
    async function showReceipt(){
      const prompt=await modalNodes("GoRecharge");
      edit(prompt,8813,{active:true});label(prompt,5544,"提示");label(prompt,2446,receipt);
      edit(prompt,8079,{active:false});edit(prompt,3278,{p:[0,-84],action:closeDialog});label(prompt,6466,"确定");
      nodes.push(...prompt);
    }
    function draw(pool,count){
      const spec=pools[pool],price=store.prices.find(row=>row.id===spec.prices[count===10?1:0]);
      const [kind,amount]=priceOf(price);
      if(!(pool===2&&profile.level<50) && profile[kind==="bloodGem"?"diamond":"gold"]<amount){
        recharge(go,"GachaWindow",kind==="bloodGem"?1:0);return;
      }
      request("draw",spec.id,{multiple:count},{pool,count,level:profile.level,amount});
    }
    if(screen==="RechargeWindow") {
      edit(nodes,5747,{active:true});
      edit(nodes,1503,{active:rechargeTab===0});edit(nodes,593,{active:rechargeTab===1});
      picture(nodes,rechargeTab?26:3246,nodeById(nodes,3246).widget.pressedImage);
      edit(nodes,1871,{action:()=>{rechargeTab=0;redraw();}});
      edit(nodes,3142,{action:()=>{rechargeTab=1;redraw();}});
      if(!rechargeTab)await qmqzPosters.rechargeVip(nodes,profile,api);
      label(nodes,7106,"说明：选择[ffc800]本地免费[-]即可领取该档钻石和标注的赠量。\n钻石和 VIP 累计记录保存在当前角色。");
      label(nodes,2346,"说明：选择档位，用[ffc800]钻石兑换荣誉[-]，赠送荣誉一并到账。\n荣誉可在商城购买装备，也可在强化点制造机中换取强化点。");
      // The two-line explanation shares the same readable ink as the original blue-gray label.
      const description=nodeById(nodes,rechargeTab?2346:7106);
      description.widget={...description.widget,foot:undefined};
      // RechargeItem.PreRender fills the eight original slots from the RechargeGem table.
      const rewards=await data("store-rewards");
      const part=(parent,name)=>child(nodes,parent,name);
      for(const tier of await data("recharge-tiers")) {
        const card=part(1503,"Rechange"+tier.id),button=part(card.id,"Rechange");
        picture(nodes,part(card.id,"weapon").id,"Icon_Gem_"+tier.id+".png");
        label(nodes,part(part(card.id,"Gem").id,"GemVal").id,strings[182].replace("{0}",tier.gem));
        label(nodes,part(button.id,"RechangeVal").id,"本地免费");
        edit(nodes,button.id,{label:"免费领取 "+(tier.gem+tier.giftGem)+" 钻石",action:()=>request("gems",1048580,{cashitemid:tier.id},{id:tier.id})});
        const gift=part(card.id,"GiftVal");
        edit(nodes,gift.id,{active:tier.giftGem>0});
        label(nodes,gift.id,strings[181].replace("{0}",tier.giftGem));
        edit(nodes,part(card.id,"HotSeller").id,{active:!!tier.hot});
      }
      for(const tier of rewards.honor){
        const card=part(593,"Exchange"+tier.id),button=part(card.id,"Exchange"),amount=part(card.id,"Honor");
        const text=(parent)=>nodes.find(n=>n.parent===parent && n.widget?.kind==="UILabel");
        const price=text(button.id),quantity=text(amount.id),icon=part(button.id,"Icon");
        // The source button already contains the diamond sprite. Fit five price digits alongside it.
        label(nodes,price.id,tier.gem);label(nodes,quantity.id,tier.honor+"荣誉");
        edit(nodes,icon.id,{p:[-38,icon.p[1]]});
        edit(nodes,price.id,{p:[14,-1],widget:{...price.widget,pivot:4,foot:undefined}});
        edit(nodes,quantity.id,{p:[0,-17],widget:{...quantity.widget,foot:undefined}});
        const gift=part(card.id,"GiftVal");edit(nodes,gift.id,{active:tier.giftHonor>0});label(nodes,gift.id,"赠送"+tier.giftHonor);
        if(tier.giftHonor)gift.widget={...gift.widget,foot:undefined};
        edit(nodes,button.id,{label:"兑换 "+(tier.honor+tier.giftHonor)+" 荣誉",action:()=>request("honor",1048583,{rechargeid:tier.id},{id:tier.id})});
      }
      // Texts displayed by the bundled offline client on a fresh account.
      label(nodes,5065,"90钻");label(nodes,5831,"本地免费");
      edit(nodes,1737,{label:"本地免费月卡",action:()=>request("month",1048580,{cashitemid:-1})});
      edit(nodes,174,{label:"周卡说明",action:()=>qmqzWeekCards.open(go,screen,2)});
      edit(nodes,7107,{label:"购买周卡",action:()=>{
        if(qmqzWeekCards.goldActive()){api.notify(392);return;}
        const week=rewards.cards.find(r=>r.id===2);
        if(profile.gold<week.priceGem){receipt="购买周卡需要 "+week.priceGem+" 钻石。";openDialog("StoreReceipt");return;}
        request("week",1048593,{cardid:week.id},{id:week.id});
      }});
      if(dialog==="StoreReceipt")await showReceipt();
      return;
    }
    if(screen==="GachaWindow") {
      edit(nodes,2803,{active:true});
      await qmqzShopPrizes.display(nodes,profile,api,catalog);
      // The packaged offline handlers charge every draw and do not publish free countdowns.
      for(const id of [109,653,1417,4192])edit(nodes,id,{active:false});
      for(const [id,priceId] of [[1366,14],[1344,16],[701,15],[1254,17],[3387,18],[8904,19]]) {
        label(nodes,id,priceOf(store.prices.find(p=>p.id===priceId))[1]);
      }
      const grid=nodeById(nodes,7016);grid.p=[grid.p[0]-gachaOffset,grid.p[1]];
      edit(nodes,3164,{active:gachaOffset>0});edit(nodes,6887,{active:gachaOffset<512});
      edit(nodes,7993,{action:()=>{gachaOffset=512;redraw();}});edit(nodes,8741,{action:()=>{gachaOffset=0;redraw();}});
      pools.forEach((spec,idx)=>spec.buttons.forEach((id,i)=>edit(nodes,id,{label:spec.name+(i?"十连":"单抽"),action:()=>draw(idx,i?10:1)})));
      if(dialog==="StoreReceipt")await showReceipt();
      if((dialog==="GachaPrize" || (["StoreItemDetails","PackItem","PrizeInfo"].includes(dialog)&&qmqzStoreItems.previous()==="GachaPrize")) && lastDraw){
        const [rewardData,effects,box]=await Promise.all([data("store-rewards"),data("menu-particles"),modalNodes("GachaPrize")]),d=lastDraw;
        const {particle,smooth,bounce}=qmqzMenuFX;
        const sequence=(id,name,delay,duration,frames)=>edit(box,id,{sequence:{name,delay,duration,frames,clock:d.clock}});
        edit(box,8832,{active:true});edit(box,781,{active:false});
        edit(box,2602,{active:true});
        sequence(2602,"gacha-points",1000,250,[{scale:"0",easing:smooth},{scale:"1"}]);
        particle(box,effects,"Rec_Goods_01",8832,d.clock,0,{offset:[0,280],z:-4});
        edit(box,607,{active:d.ids.length>1});edit(box,2216,{active:d.ids.length===1});
        particle(box,effects,d.ids.length===1?"Prize_Grid_BG_01":"Radial_2d_02",
          d.ids.length===1?2216:607,d.clock,1500,{loop:true});
        const boxes=nodeById(box,3659).widget.rewardBoxes;
        d.ids.forEach((id,i)=>{
          const slot=d.ids.length===1?nodeById(box,2708):child(box,607,"Prize"+(i+1));
          const prize=rewardData.prizes.find(r=>r.ID===id);
          if(!slot || !prize)return;
          edit(box,slot.id,{active:true,hit:[0,0,215,140],action:dialog==="GachaPrize"?()=>qmqzShopPrizes.open(prize,catalog,"GachaWindow",api,"GachaPrize"):null});
          const delay=1500+i*300, x=d.ids.length===1?-slot.p[0]/2:200, y=d.ids.length===1?slot.p[1]/2:0;
          sequence(slot.id,"gacha-item",delay,350,[
            {translate:x+"px "+y+"px",scale:"1",offset:0,easing:bounce},
            {translate:"0 0",scale:"1",offset:150/350,easing:smooth},
            {scale:".95",offset:225/350},{scale:".95",offset:300/350,easing:smooth},{scale:"1",offset:1}]);
          particle(box,effects,"Prize_Appeared",slot.id,d.clock,delay,{z:-1,hideAfter:150});
          const item=catalog.items.find(x=>x.id===prize.itemId),actor=catalog.actors.find(a=>a.id===prize.roleId);
          const title=prize.alias||item?.name||actor?.name||prize.info||(prize.exp?prize.exp+" 经验":prize.rPoint+" 强化点");
          const name=child(box,slot.id,"Label"),icon=child(box,slot.id,"Item"),sprite=child(box,slot.id,"Sprite");
          label(box,name.id,title);
          name.widget={...name.widget,color:[...prize.color.match(/../g).map(c=>parseInt(c,16)),255]};
          picture(box,child(box,slot.id,"Box").id,boxes[prize.bg]);
          edit(box,icon.id,{active:!!(item||actor),s:actor?[74,82]:[208,88],rotate:actor||item?.subType===24?0:25});
          picture(box,icon.id,item?.icon||actor?.image);
          edit(box,sprite.id,{active:!item&&!actor});
          picture(box,sprite.id,prize.rPoint?"Icon_ResearchPoints-964777403.png":"Icon_exp-964777403.png");
          const amount=prize.exp||prize.rPoint||((prize.ammoVal>1||prize.footer)?prize.ammoVal:0);
          label(box,child(box,slot.id,"Val")?.id,amount?"×"+amount:d.status[i]===2?"重复转碎片":d.status[i]===1?"新获得":"");
        });
        const points=rewardData.points.find(r=>r.id===d.pool*2+(d.count===10?2:1)).rPoint;
        label(box,2134,"获得强化点 "+points);label(box,3127,d.count===10?"再抽十次":"再抽一次");label(box,5220,d.amount);
        edit(box,6536,{action:dialog==="GachaPrize"?closeDialog:null});edit(box,3578,{action:dialog==="GachaPrize"?()=>draw(d.pool,d.count):null});
        for(const id of [6536,3578])sequence(id,"gacha-confirm",1650+d.ids.length*300,400,[{scale:"2",easing:smooth},{scale:"1"}]);
        nodes.push(...box);
      }
      return;
    }
    if(screen!=="StoreWindow")return;
    edit(nodes,543,{active:true});
    const roles=group===5, portraits=roles?await data("role-media"):[];
    const panel=roles?2904:2132,grid=roles?5168:478;
    edit(nodes,2904,{active:roles});edit(nodes,2132,{active:!roles});
    const opened=nodeById(nodes,4111).p, travel=opened[0]-nodeById(nodes,4398).p[0];
    for(const [type,id] of [["currency",3465],["model",7736]]) {
      const motion=filters.get(type);
      edit(nodes,id,{active:!!motion,p:opened});
      if(!motion||performance.now()-motion.start>=motion.duration)continue;
      // Original TweenTransform method 3 samples sin(pi*t/2) between the two scene transforms.
      const frames=Array.from({length:33},(_,i)=>{
        const factor=motion.from+(motion.to-motion.from)*i/32;
        return {translate:(Math.sin(Math.PI*factor/2)-1)*travel+"px 0"};
      });
      edit(nodes,id,{sequence:{name:"store-filter-"+type,clock:motion,delay:0,duration:motion.duration,frames}});
    }
    edit(nodes,1471,{active:true});
    for(const [type,parent] of [[1,4421],[2,5615],[3,3813],[4,1971]])edit(nodes,parent,{active:group===type});
    const canFilterModel=group>=1&&group<=4;
    edit(nodes,1544,{active:!roles,action:canFilterModel?()=>changeFilter(viewFilter==="model"?"":"model",redraw):null});
    edit(nodes,6706,{active:!roles,action:()=>changeFilter(viewFilter==="currency"?"":"currency",redraw)});
    for(const [id,value] of tabIds) {
      const sprite=nodeById(nodes,id).buttonSprite;
      if(value===group && sprite)picture(nodes,sprite.target,sprite.pressed);
      edit(nodes,id,{action:()=>{group=value;currency="";subtype=0;offset=0;changeFilter("",redraw);}});
    }
    const filterGroups=new Map(store.groups.map(g=>[g.id,g]));
    for(const n of nodes.filter(n=>n.hit)) {
      if(n.parent===1471){
        const value={All:"",Gold:"gold",Hornor:"bloodGem",Diamond:"gem"}[n.name];
        if(value!==undefined)edit(nodes,n.id,{action:()=>{currency=value;offset=0;changeFilter("",redraw);}});
        continue;
      }
      if(![1971,2487,3813,5615].includes(n.parent))continue;
      const choose=v=>()=>{subtype=v;offset=0;changeFilter("",redraw);};
      const map={Pistol:11,SubMachineGun:13,Rifle:14,MachineGun:15,ShotGun:12,Sniper:16,Melee:10,Hamlet:35,Armor:36,Boot:37,Grenade:41,Flash:42,Ammo:23,Subjoin:24,Piece:27,Clip:26,Extra:99};
      if(n.name==="All")edit(nodes,n.id,{action:choose(0)});
      else if(map[n.name])edit(nodes,n.id,{action:choose(map[n.name])});
    }
    const template=await data(roles?"StoreRoleListItem":"StoreItemListItem");
    const pref=template.find(n=>n.StoreItemListItem||n.StoreRoleListItem);
    const ref=pref.StoreItemListItem||pref.StoreRoleListItem;
    const items=new Map(catalog.items.map(it=>[it.id,it]));
    let offers;
    if(roles){
      const rolesForSale=(await data("role-media")).filter(r=>r.gem>0 || r.gold>0 || r.bloodGem>0);
      offers=rolesForSale.filter(row=>!currency||priceOf(row)[0]===currency).map(row=>({
        row,item:catalog.actors.find(actor=>actor.id===row.id)
      }));
    }else{
      offers=store.offers.map(row=>({row,item:items.get(row.itemId)})).filter(({row,item})=>
        item && (group===8 ? row.hot : filterGroups.get(item.subType)?.group===group)
        &&(!currency||priceOf(row)[0]===currency) && (!subtype||subtype===item.subType));
      offers.sort((a,b)=>a.row.order-b.row.order || a.row.id-b.row.id);
    }
    total=offers.length;
    const list=[group,currency,subtype].join("/");
    if(list!==listKey){listKey=list;offerEntries.clear();}
    const gridNode=nodeById(nodes,grid);gridNode.p=[gridNode.p[0],gridNode.p[1]+offset];
    function cost(target,id,kind){
      const w=nodeById(target,id)?.widget;
      picture(target,id,w?.currencyImages?.[kind]);
    }
    function canBuy(row) {
      const [kind,price]=priceOf(row);
      const wallet={gem:"gold",gold:"money",bloodGem:"diamond"}[kind];
      if(profile[wallet]>=price)return true;
      if(kind==="gem")openDialog("GoRecharge");
      else notify(kind==="bloodGem"?29:31);
      return false;
    }
    // Schedule a card when it enters the clipped grid. Scrolls and modal redraws retain its clock.
    const cardHeight=pref.hit[3], clip=nodeById(nodes,panel).clip;
    const firstTop=gridNode.p[1]+cardHeight/2;
    const firstRow=Math.max(0,Math.floor((firstTop-clip[1]-clip[3]/2)/cardHeight));
    const lastRow=Math.ceil((firstTop-clip[1]+clip[3]/2)/cardHeight);
    const clock={};
    let entering=0;
    for(const [idx,{row,item}] of offers.entries()) {
      const rowIndex=Math.floor(idx/2);
      if(!offerEntries.has(row.id) && rowIndex>=firstRow && rowIndex<lastRow)offerEntries.set(row.id,{
        name:"store-list-item",clock,delay:200*entering++,duration:200,
        frames:[{transform:"scaleX(0)",easing:"linear"},{transform:"scaleX(1)"}]
      });
      const prefix="offer"+row.id+"-", [kind,amount,listPrice]=priceOf(row);
      const active=roles || profile.level>=row.unlockLevel;
      const actor=roles?item:null;
      const copy=clonePrefab(template,prefix,grid,0,{[ref.itemName]:actor?strings[435].replace("{0}",actor.name).replace("{1}",row.time?Math.round(row.time/86400)+"天":catalog.permanent):item.name,[ref.price]:ref.saleObj?listPrice:amount,
        [ref.lockLabel]:!active?strings[166].replace("{0}",row.unlockLevel):"",[ref.itemDecs]:actor?"":item.info||""},
        {p:[(idx%2)*466,-rowIndex*cardHeight],sequence:offerEntries.get(row.id)});
      picture(copy,prefix+ref.itemIcon,actor?portraits.find(p=>p.id===actor.id)?.bust:item.icon);cost(copy,prefix+ref.currency,kind);
      if(roles && actor)edit(copy,prefix+pref.id,{label:actor.name,action:()=>{qmqzStoreItems.origin("StoreWindow");qmqzRoleMedia.store(actor.id,"StoreWindow",openDialog);}});
      else edit(copy,prefix+pref.id,{label:item.name,itemId:item.id,action:()=>qmqzStoreItems.open(item,openDialog)});
      if(ref.ownerStateSprite)edit(copy,prefix+ref.ownerStateSprite,{active:owned.includes(item.id)});
      if(ref.stars){label(copy,prefix+1605,item.star);edit(copy,prefix+ref.stars,{active:!!item.star});}
      if(ref.saleObj){
        edit(copy,prefix+ref.saleObj,{active:amount<listPrice});
        label(copy,prefix+ref.priceSale,amount);
        const sale=nodeById(copy,prefix+ref.priceSale);
        if(sale)sale.widget={...sale.widget,foot:undefined,effect:2};
      }
      if(ref.levelTag)edit(copy,prefix+ref.levelTag,{active:false});
      if(ref.lockLabel)edit(copy,prefix+ref.lockLabel,{active:!active});
      edit(copy,prefix+ref.buy,{...(actor?{actorId:actor.id}:{shopId:row.id}),label:item.name,action:()=>{
        if(!active){notify(123);return;}
        const alreadyOwned=actor ? profile.equipment?.ownedActors?.includes(actor.id) :
          [11,12,31,32,33,50].includes(item.equipPos)&&owned.includes(item.id);
        if(!alreadyOwned&&!canBuy(row))return;
        selection={row,item,actor,alreadyOwned};openDialog("ConfirmBuy");
      }});
      // Both original colliders overlap. The purchase button is in front of its card.
      const buyButton=nodeById(copy,prefix+ref.buy);
      nodes.push(...copy.filter(n=>n!==buyButton),buyButton);
    }
    if(dialog==="GoRecharge") {
      const prompt=(await data("GoRecharge")).filter(n=>!nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
      edit(prompt,8813,{active:true});label(prompt,2446,strings[212]);
      edit(prompt,8079,{action:closeDialog});edit(prompt,3278,{action:()=>recharge(go,"StoreWindow")});
      nodes.push(...prompt);return;
    }
    if(dialog!=="ConfirmBuy" || !selection)return;
    const overlay=await modalNodes("ConfirmBuy");
    const fields=nodeById(overlay,4799).ConfirmBuyDialog, {row,item,actor}=selection,[kind,amount]=priceOf(row);
    edit(overlay,4799,{active:true});label(overlay,fields.title,item.name);
    edit(overlay,fields.itemIcon,{active:!actor});edit(overlay,fields.roleIcon,{active:!!actor});
    picture(overlay,actor?fields.roleIcon:fields.itemIcon,actor?portraits.find(p=>p.id===actor.id)?.bust:item.icon);
    const presentable=row.gem>0;
    edit(overlay,fields.consumeGem,{active:presentable});edit(overlay,fields.consumeOther,{active:!presentable});
    for(const [textId,spriteId] of [[fields.myPrice,fields.myCurrency],[fields.onlyPrice,fields.onlyCurrency],[fields.otherPrice,fields.otherCurrency]]) {
      label(overlay,textId,amount);cost(overlay,spriteId,kind);
    }
    const buy=()=>{
      if(selection.alreadyOwned){closeDialog();notify(actor?50:81);return;}
      if (selection.pending || !canBuy(row)) return;
      selection.pending=true;
      if(actor)send(786445,{id:actor.id});else send(1048577,{id:row.id,count:1});
    };
    const buyAction=actor?{actorId:actor.id,action:buy}:{shopId:row.id,action:buy};
    edit(overlay,fields.myBuy,buyAction);edit(overlay,fields.onlyBuy,buyAction);
    // GiftManager.HasPresent first checks PresentRemains. Only ScGiveTimesSync writes it;
    // the APK's offline login sends the inbox but never that quota message, so the local value stays zero.
    edit(overlay,fields.otherBuy,{label:"赠送",action:()=>notify(472)});
    edit(overlay,fields.close,{action:closeDialog});nodes.push(...overlay);
  }
  window.qmqzStore={display,shell,begin,gacha,finishPurchase,protocol,recharge,priceOf,offset:()=>offset,setOffset,
    canCloseDraw:()=>!!lastDraw?.clock.start && performance.now()-lastDraw.clock.start>=1650+lastDraw.ids.length*300,
    gachaOffset:()=>gachaOffset,setGachaOffset:value=>{gachaOffset=Math.max(0,Math.min(512,value));}};
})();
