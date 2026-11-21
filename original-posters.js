// AdvertisePanel.PlayAdvertise and DynamicListCarousel.Swipe in the original lobby.
(() => {
  "use strict";
  let index=0, interval, lastChange=-Infinity, previous=0, direction=1, press=null, suppressClick=false, art, hit, style, config;
  let selectedGift, goalId, selectedHead, medalId, rankId, cardTab="archive", rankGroup=1, vipLevel=0, returnTo="MainUI";
  let offset=0, limit=0, panel="", busy=false, fusionMessage="", picks=new Map();
  const clearScroll=()=>{offset=0;limit=0;panel="";};

  function rows(nodes,grid,panelId,total,columns,width,height,which,h) {
    if(which) {
      panel=String(panelId);
      limit=Math.max(0,Math.ceil(total/columns)*height-(h.nodeById(nodes,panelId)?.clip?.[3]||0));
      offset=Math.min(limit,offset);
    }
    const n=h.nodeById(nodes,grid);
    if(n&&which)n.p=[n.p[0],n.p[1]+offset];
    return i=>[i%columns*width,-Math.floor(i/columns)*height];
  }
  function tint(nodes,id,value,h) {
    const n=h.nodeById(nodes,id);
    if(n?.widget)n.widget={...n.widget,color:[value,value,value,255]};
  }
  async function transact(id,fields,response) {
    if(busy)return;
    busy=true;
    let reply;
    const listener=e=>{if(e.detail.id===response)reply=e.detail.fields;};
    window.addEventListener("qmqz-protocol",listener);
    try {
      await window.qmqzProfileCommand("menu",JSON.stringify({id,fields}));
      return reply;
    } finally {
      window.removeEventListener("qmqz-protocol",listener);
      busy=false;
    }
  }
  async function modal(name,root,nodes,h) {
    const overlay=(await h.data(name)).filter(n=>!h.nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
    h.edit(overlay,root,{active:true});
    nodes.push(...overlay);
    if(name!=="GoRecharge") {
      const dim=(await h.data("UIDimmer")).filter(n=>!h.nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
      h.edit(dim,8896,{modalBackground:true});nodes.push(...dim);
    }
  }
  async function recharge(nodes,h,strings) {
    await modal("GoRecharge",8813,nodes,h);
    h.label(nodes,2446,strings[212]);h.edit(nodes,8079,{action:h.closeDialog});
    h.edit(nodes,3278,{action:()=>window.qmqzStore.recharge(h.go,h.nodeById(nodes,6692)?"FusionWindow":"ActivityForm")});
  }

  async function fusion(nodes,role,profile,content,strings,h) {
    const {edit,label,picture,clonePrefab,render}=h, goal=content.fusion.find(row=>row.id===goalId);
    const held=id=>Number(role.counts[id]??Number(role.items.includes(id)));
    const candidates=goal?content.fusion.filter(r=>r.material===goal.exchange && held(r.id)>0):[];
    for(const [id,amount] of picks)picks.set(id,Math.min(held(id),amount));
    const used=[...picks.values()].reduce((a,b)=>a+b,0), count=goal?Math.floor(used/goal.per):0;
    const remain=goal?used%goal.per:0, charge=count*(goal?.gem||0);
    edit(nodes,7408,{action:()=>{clearScroll();h.openDialog("ChooseChips");},label:"选择碎片"});
    edit(nodes,5237,{active:!!goal});edit(nodes,8131,{active:!!goal});
    if(goal)picture(nodes,5237,goal.image);
    label(nodes,7221,goal?.name);label(nodes,2343,goal?count:"");label(nodes,5285,goal?remain+"/"+goal.per:"");
    label(nodes,8308,goal?charge:"-");label(nodes,1119,fusionMessage||strings[charge>profile.gold?690:688]);
    if(goal) {
      const words=h.nodeById(nodes,1119), bubble=h.nodeById(nodes,2936);
      // In the Web renderer the front face of the original sliced sprite can hide its own label.
      // Use the actual UIFont line breaks to extend the interior for multi-line instructions.
      const inset=bubble.p[1]-words.p[1], textHeight=window.qmqzFonts.labelHeight(words.widget,words.s[1]);
      edit(nodes,1119,{z:bubble.z});
      edit(nodes,2936,{s:[bubble.s[0],Math.max(bubble.s[1],textHeight+2*inset)]});
    }
    const progress=h.nodeById(nodes,2298);
    edit(nodes,2298,{active:remain>0,s:[progress.s[0]*(goal?remain/goal.per:0),progress.s[1]]});
    for(const id of [1600,763])tint(nodes,id,count?255:128,h);
    if(count)edit(nodes,7262,{action:async()=>{
      if(busy)return;
      if(charge>profile.gold){h.openDialog("GoRecharge");return;}
      const reply=await transact(786491,{partsid:goal.id,partsnum:count,consumeparts:[...picks].filter(([,v])=>v>0)
        .map(([first,second])=>({first,second}))},786492);
      if(reply?.res===0){picks.clear();fusionMessage=strings[689].replace("{0}",goal.name).replace("{1}",count);}
      else h.notify(30009);
      render();
    },label:"确认兑换"});
    const source=await h.data("ChipsListItem");
    const pos=rows(nodes,8119,8160,candidates.length,3,172,202,!h.dialog,h);
    candidates.forEach((r,i)=>{
      const prefix="material-"+r.id+"-", current=picks.get(r.id)||0;
      const change=delta=>{fusionMessage="";picks.set(r.id,Math.min(held(r.id),Math.max(0,(picks.get(r.id)||0)+delta)));render();};
      const copy=clonePrefab(source,prefix,8119,0,{1641:current+"/"+held(r.id),1644:r.name},
        {p:pos(i),action:()=>change(1),label:r.name});
      picture(copy,prefix+1643,r.image);
      edit(copy,prefix+1581,{active:current>0,action:()=>change(-1),label:"减少"+r.name});
      nodes.push(...copy);
    });
    if(h.dialog==="GoRecharge")await recharge(nodes,h,strings);
    if(h.dialog!=="ChooseChips")return;
    await modal("ChooseChips",8675,nodes,h);
    edit(nodes,7588,{action:()=>{clearScroll();h.closeDialog();}});
    const targets=content.fusion.filter(r=>r.exchange>0), item=await h.data("ChipsListItem2");
    const at=rows(nodes,7376,6482,targets.length,4,172,202,true,h);
    targets.forEach((r,i)=>{
      const prefix="target-"+r.id+"-";
      const copy=clonePrefab(item,prefix,7376,0,{1609:held(r.id),1612:r.name},
        {p:at(i),overlay:true,action:()=>{goalId=r.id;picks.clear();fusionMessage="";clearScroll();h.closeDialog();},label:r.name});
      picture(copy,prefix+1611,r.image);nodes.push(...copy);
    });
  }

  async function vipDialog(nodes,profile,role,content,strings,vip,h) {
    const {edit,label,picture,nodeById,render}=h;
    if(h.dialog==="GoRecharge") {
      await recharge(nodes,h,strings);
      edit(nodes,3278,{action:()=>window.qmqzStore.recharge(h.go,"MyCardWindow")});
      return;
    }
    if(h.dialog==="VipPackList") {
      await modal("VipPackList",8703,nodes,h);
      edit(nodes,6812,{action:()=>{clearScroll();h.openDialog("CheckVip");}});
      const src=await h.data("VIPPacklistItem"),pos=rows(nodes,8362,3130,content.vipGifts.length,1,500,100,true,h);
      content.vipGifts.forEach((gift,i)=>{
        const prefix="vip-gift-"+gift.id+"-", enabled=vip>=gift.vipLevel&&!role.vipGifts.includes(gift.id);
        const copy=h.clonePrefab(src,prefix,8362,0,{1419:gift.title,1521:gift.info,1028:gift.gem},{p:pos(i),overlay:true});
        picture(copy,prefix+1386,nodeById(src,1386).widget.packs[gift.pic]);
        picture(copy,prefix+1447,nodeById(src,1447).widget.levels[gift.vipLevel]);
        if(enabled)edit(copy,prefix+1349,{action:async()=>{
          if(busy)return;
          if(gift.gem>profile.gold){h.openDialog("GoRecharge");return;}
          const reply=await transact(1048643,{giftid:gift.id},1048644);
          if(reply?.giftid===gift.id)h.notify(600,gift.name);else h.notify(5);
        },label:"购买 VIP"+gift.vipLevel+" 礼包"});
        else for(const id of [1303,1248])tint(copy,prefix+id,128,h);
        nodes.push(...copy);
      });
      return;
    }
    await modal("CheckVip",2321,nodes,h);
    const row=content.vip.find(r=>r.level===vipLevel), gift=content.vipGifts.find(r=>r.id===row?.vipGift);
    picture(nodes,3657,(row?.bg||"BG_Vip0")+".png");
    label(nodes,1445,vipLevel);
    for(const id of [5699,3124])label(nodes,id,strings[341].replace("{0}",row?.gold||0));
    for(const id of [6901,5731])label(nodes,id,strings[342].replace("{0}",row?.exp||0));
    edit(nodes,5729,{active:!!gift});edit(nodes,4432,{active:!gift});
    if(gift)picture(nodes,3706,nodeById(nodes,3706).widget.packs[gift.pic]);
    edit(nodes,8386,{active:!!gift&&role.vipGifts.includes(gift.id)});
    for(const id of [3332,4153])edit(nodes,id,{action:()=>{clearScroll();h.openDialog("VipPackList");}});
    edit(nodes,8864,{action:h.closeDialog});edit(nodes,5471,{action:()=>window.qmqzStore.recharge(h.go,"MyCardWindow")});
    for(const [id,delta] of [[7971,-1],[7511,1]]) {
      const next=vipLevel+delta;
      if(next<0||next>25){tint(nodes,delta<0?7233:8058,128,h);continue;}
      edit(nodes,id,{action:()=>{
        const requirement=content.vip.find(r=>r.level===next)?.vipShow||0;
        if(requirement>vip){h.notify(527,requirement);return;}
        vipLevel=next;render();
      }});
    }
  }

  async function card(nodes,profile,role,content,strings,h) {
    const {edit,label,picture,clonePrefab,render}=h;
    const vip=Math.max(0,...content.vip.filter(r=>role.cash>=r.recharge).map(r=>r.level));
    for(const [id,key] of [[7797,"archive"],[7818,"medal"],[5081,"rank"]])edit(nodes,id,{action:()=>{
      if(cardTab!==key){cardTab=key;clearScroll();render();}
    },label:({archive:"档案",medal:"勋章",rank:"军衔"})[key]});
    for(const [id,key] of [[4899,"archive"],[2659,"medal"],[3587,"rank"]])edit(nodes,id,{active:cardTab===key});
    if(cardTab==="archive") {
      edit(nodes,2350,{action:()=>{vipLevel=vip;clearScroll();h.openDialog("CheckVip");}});
      if(["CheckVip","VipPackList","GoRecharge"].includes(h.dialog))return vipDialog(nodes,profile,role,content,strings,vip,h);
      edit(nodes,3474,{action:()=>{selectedHead=profile.iconid;clearScroll();h.openDialog("ChangeAvatar");}});
      if(h.dialog!=="ChangeAvatar")return;
      await modal("ChangeAvatar",3983,nodes,h);
      edit(nodes,5211,{active:false});edit(nodes,2481,{action:()=>{clearScroll();h.closeDialog();}});
      const source=await h.data("HeadIconTableItem"), highlight=await h.data("HeadHighlight");
      const pos=rows(nodes,4319,5708,content.heads.length,8,70,70,true,h);
      content.heads.forEach((r,i)=>{
        const prefix="avatar-"+r.id+"-",owned=r.vip<=vip && (!r.gift||role.gifts.includes(r.gift));
        const copy=clonePrefab(source,prefix,4319,0,{},{p:pos(i),overlay:true,
          action:owned?()=>{selectedHead=r.id;render();}:undefined,label:"头像 "+r.id});
        picture(copy,prefix+1003,r.image);if(!owned)tint(copy,prefix+1003,128,h);
        nodes.push(...copy);
        if(selectedHead===r.id)nodes.push(...clonePrefab(highlight,prefix+"selected-",prefix+1087,0,{}, {overlay:true}));
      });
      edit(nodes,1988,{action:async()=>{
        if(busy)return;
        const reply=await transact(1114128,{iconid:selectedHead},1114128);
        if(reply?.iconid===selectedHead){clearScroll();h.closeDialog();}else render();
      }});
      return;
    }
    if(cardTab==="medal") {
      const source=await h.data("MedalListItem"), chosen=content.medals.find(r=>r.id===medalId)||content.medals[0];
      const pos=rows(nodes,7962,8816,content.medals.length,3,210,185,true,h);
      label(nodes,6381,strings[198].replace("{0}",0));
      label(nodes,2957,chosen.name);label(nodes,700,chosen.info);
      content.medals.forEach((r,i)=>{
        const prefix="medal-"+r.id+"-";
        const copy=clonePrefab(source,prefix,7962,0,{1013:0},{p:pos(i),action:()=>{medalId=r.id;render();},label:r.name});
        picture(copy,prefix+1378,r.image);nodes.push(...copy);
      });
      return;
    }
    for(const [id,group] of [[5048,1],[6418,3],[2960,4],[4517,5],[383,2]])edit(nodes,id,{action:()=>{
      rankGroup=group;rankId=null;clearScroll();render();
    }});
    const list=content.ranks.filter(r=>r.group===rankGroup);
    const active=list.find(r=>r.id===(rankId||profile.level))||list[0];
    if(!active)return;
    const pos=rows(nodes,8422,6568,list.length,4,140,122,true,h),source=await h.data("RankListItem");
    list.forEach((r,i)=>{
      const prefix="rank-"+r.id+"-";
      const copy=clonePrefab(source,prefix,8422,0,{1093:r.name},{p:pos(i),action:()=>{rankId=r.id;render();},label:r.name});
      picture(copy,prefix+1166,r.image);edit(copy,prefix+1379,{active:r.id===profile.level});nodes.push(...copy);
    });
    label(nodes,2005,active.name);label(nodes,4863,"LV."+active.id);
    const completed=active.id<=profile.level, current=completed?active.exp:active.id===profile.level+1?profile.exp:0;
    label(nodes,2311,current);label(nodes,8396,active.exp);
    const bar=h.nodeById(nodes,2129),fraction=completed?1:active.exp?Math.min(1,current/active.exp):1;
    edit(nodes,2129,{active:fraction>0,s:[bar.s[0]*fraction,bar.s[1]]});
  }

  async function rechargeVip(nodes,profile,h) {
    const [role,content,strings]=await Promise.all([qmqzReadPosterRole(profile.roleid),h.data("poster-actions"),h.data("strings")]);
    if(!role)return;
    const vip=Math.max(0,...content.vip.filter(r=>role.cash>=r.recharge).map(r=>r.level));
    h.edit(nodes,1644,{label:"查看VIP",action:()=>{vipLevel=vip;clearScroll();h.openDialog("CheckVip");}});
    const next=content.vip.find(r=>r.level===vip+1), current=content.vip.find(r=>r.level===vip);
    h.edit(nodes,5541,{active:vip>0});h.edit(nodes,3452,{active:Boolean(next)});
    if(vip)h.picture(nodes,3869,"Icon_Vip_"+vip+"--2078032047.png");
    if(next)h.picture(nodes,5278,"Icon_Vip_"+next.level+"--2078032047.png");
    const fill=h.nodeById(nodes,1063);
    const fraction=next?Math.max(0,(role.cash-(current?.recharge||0))/(next.recharge-(current?.recharge||0))):1;
    h.edit(nodes,1063,{active:fraction>0,s:[416*fraction,fill.s[1]]});
    h.label(nodes,2973,next ? role.cash+" / "+next.recharge : "已达最高 VIP");
    if(["CheckVip","VipPackList","GoRecharge"].includes(h.dialog)){
      await vipDialog(nodes,profile,role,content,strings,vip,{...h,render:h.redraw});
      if(h.dialog==="CheckVip")h.edit(nodes,5471,{action:h.closeDialog});
      if(h.dialog==="GoRecharge")h.edit(nodes,3278,{action:h.closeDialog});
    }
  }

  function paint() {
    art.getAnimations().forEach(motion=>motion.cancel());
    art.parentElement.querySelector("[data-outgoing-poster]")?.remove();
    const setImage=(el,i)=>{el.style.backgroundImage='url("'+config.urls[i]+'")';};
    setImage(art,index);
    style.dots.forEach((dot,i)=>{
      const el=art.parentElement.querySelector('[data-source-id="'+dot+'"]');
      if(el)el.style.filter=i===index?"":"brightness("+100/255+")";
    });
    const duration=style.slideSeconds*1000, age=performance.now()-lastChange;
    if(age>=duration)return;
    const old=art.cloneNode(false);
    old.removeAttribute("data-source-id");
    old.dataset.outgoingPoster="";
    setImage(old,previous);
    art.before(old);
    const dx=direction*style.slideWidth;
    const motion=(el,from,to)=>el.animate([{transform:"translateX("+from+"px)"},{transform:"translateX("+to+"px)"}],
      {duration,easing:"linear"});
    const out=motion(old,0,-dx), into=motion(art,dx,0);
    out.currentTime=into.currentTime=age;
    out.onfinish=()=>old.remove();
  }

  function slide(step) {
    if(!art?.isConnected || performance.now()-lastChange<style.slideSeconds*1000)return;
    previous=index;
    index=(index+step+config.urls.length)%config.urls.length;
    lastChange=performance.now();
    direction=step;
    paint();
  }

  function attach(stage,setup) {
    art=setup && stage.querySelector('[data-source-id="389"]');
    hit=stage.querySelector('button[data-object="adv1"]');
    press=null;
    if(!art) {
      clearInterval(interval);
      interval=undefined;
      lastChange=-Infinity;
      return;
    }
    config=setup;
    style=setup.style;
    // ADBackground has an opaque nine-slice center. Its native panel sits behind the clipped artwork.
    const frame=stage.querySelector('[data-source-id="2105"]');
    const panel=art.closest('[data-panel="8272"]');
    if(frame&&panel&&frame.parentElement===panel.parentElement)panel.before(frame);
    paint();
    if(!interval)interval=setInterval(()=>slide(1),5000);
    if(!hit)return;
    hit.onpointerdown=e=>{
      if(!e.isPrimary || e.button!==0)return;
      suppressClick=false;
      press={id:e.pointerId,x:e.clientX};
      hit.setPointerCapture(e.pointerId);
    };
    hit.onpointercancel=()=>{press=null;};
    hit.onpointerup=e=>{
      if(press?.id!==e.pointerId)return;
      const delta=e.clientX-press.x;
      press=null;
      // The original horizontal swipe threshold is 0.1 in a two-unit orthographic viewport.
      if(Math.abs(delta)>=setup.viewportHeight*.05) {
        suppressClick=true;
        slide(delta<0?1:-1);
      }
    };
  }
  function open() {
    if(!suppressClick && art?.isConnected && performance.now()-lastChange>=style.slideSeconds*1000)config.open(index);
    suppressClick=false;
  }

  async function display(screen,nodes,profile,h) {
    const {data,edit,label,picture,nodeById,render}=h;
    const [pages,role,content,strings]=await Promise.all([data("poster-pages"),window.qmqzReadPosterRole(profile.roleid),
      data("poster-actions"),data("strings")]);
    if(!role)return;
    edit(nodes,2684,{action:()=>h.go(returnTo)});
    if(screen==="FusionWindow")return fusion(nodes,role,profile,content,strings,h);
    if(screen==="MyCardWindow") {
      const rank=pages.ranks.find(r=>r.id===profile.level);
      label(nodes,899,profile.name);
      label(nodes,6158,profile.roleid);
      label(nodes,1864,"LV."+profile.level);
      label(nodes,7902,rank?.name);
      label(nodes,1389,pages.ranks.filter(r=>r.id<=profile.level).reduce((total,r)=>total+r.exp,profile.exp));
      if(rank)picture(nodes,3681,rank.image);
      const avatar=content.heads.find(r=>r.id===profile.iconid);
      if(avatar)picture(nodes,8365,avatar.image);
      label(nodes,1369,role?.killnum);label(nodes,890,role?.headshots);
      label(nodes,6800,role?Math.trunc(role.killrate*100)+"%":"");
      label(nodes,2228,role?.teamname);
      // APK profile._rank_stats supplies these three fields as zero; Property.medals is empty.
      for(const id of [4353,6191,2905,7379,8515,2937])label(nodes,id,0);
      edit(nodes,5805,{active:(role?.vipstatus||0)>0}); label(nodes,8444,role?.vipstatus);
      edit(nodes,2717,{active:false});
      return card(nodes,profile,role,content,strings,h);
    }
    const selected=pages.gifts.find(gift=>gift.id===selectedGift)||pages.gifts[0];
    if(!selected)return;
    edit(nodes,4154,{active:false});edit(nodes,1164,{active:false});
    const slots=[275,3512,5793,903,3203,4212];
    for(const [i,slot] of slots.entries()) {
      const row=pages.gifts[i],children=nodes.filter(n=>n.parent===slot);
      const icon=children.find(n=>n.name==="Pack").id, owned=children.find(n=>n.name==="Owned").id;
      label(nodes,children.find(n=>n.name==="Label").id,row?.name);
      edit(nodes,owned,{active:!!row && (role.gifts.includes(row.id)||role.bought.includes(row.id))});
      edit(nodes,icon,{active:!!row});
      if(row) {
        picture(nodes,icon,row.icon);
        edit(nodes,slot,{action:()=>{selectedGift=row.id;render();},label:row.name});
      }
    }
    label(nodes,2984,selected.name);label(nodes,7728,selected.price);
    label(nodes,4483,selected.weapon);label(nodes,1639,selected.stars);
    // NGUI draws the name at widget depth 1 in front of its depth-0 background.
    // Keep that ordering in the browser when the text and UITexture use different materials.
    edit(nodes,4483,{z:nodeById(nodes,128).z});
    edit(nodes,177,{hit:[0,0,1,1],label:selected.weapon,action:async()=>{
      const inventory=await h.data("inventory"),item=inventory.items.find(v=>v.id===selected.itemId);
      if(item)qmqzStoreItems.open(item,h.openDialog,"ActivityForm");
    }});
    picture(nodes,177,selected.weaponImage);picture(nodes,6631,selected.headImage);
    label(nodes,7943,pages.headLabel);label(nodes,304,selected.chipName);
    label(nodes,8144,selected.description??strings[selected.message].replace("{0}",String(selected.value)));
    picture(nodes,2581,nodeById(nodes,2581).widget.chips[selected.chip]);
    edit(nodes,4728,{action:async()=>{
      if(busy)return;
      const vip=content.vip.some(r=>r.level>=1 && role.cash>=r.recharge);
      if(!vip){h.notify(589);return;}
      if(role.gifts.includes(selected.id)||role.bought.includes(selected.id)){h.notify(348);return;}
      if(profile.gold<selected.price){h.openDialog("GoRecharge");return;}
      const reply=await transact(1048590,{giftid:selected.id},1048591);
      h.notify(reply?.giftid===selected.id?4:5);
    },label:"购买"+selected.name});
    if(h.dialog==="GoRecharge")await recharge(nodes,h,strings);
  }
  function destination(route,go,source="MainUI") {
    const [name,parameter]=route.split("|");
    clearScroll();picks.clear();goalId=null;fusionMessage="";cardTab="archive";rankGroup=1;rankId=null;medalId=null;
    returnTo=route.startsWith("ActivityForm|")? "MainUI":source;
    if(name==="ActivityForm")selectedGift=Number(parameter);
    go(name);
  }
  window.qmqzPosters={attach,open,display,destination,rechargeVip,scrollPanel:id=>!!panel&&panel===id,
    offset:()=>offset,scroll:value=>{offset=Math.max(0,Math.min(limit,value));}};
})();
