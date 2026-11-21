(() => {
  "use strict";
  let daily=0,requested=false,clock={},pool=0,listOffset=0,maxOffset=0,notice=null;
  const nameOf=(row,catalog)=>row.alias||catalog.items.find(i=>i.id===row.itemId)?.name||
    catalog.actors.find(i=>i.id===row.roleId)?.name||row.info||(row.rPoint?row.rPoint+" 强化点":row.exp+" 经验");
  function begin(){daily=0;requested=false;clock={};}
  function openList(type,h){pool=type;listOffset=0;h.openDialog("GachaListDialog");}
  function info(name,text,screen,h,parent="") {
    notice={name,text};qmqzStoreItems.origin(screen,parent);h.openDialog("PrizeInfo");
  }
  function open(row,catalog,screen,h,parent=""){
    if(!row)return;
    const item=catalog.items.find(i=>i.id===row.itemId),role=catalog.actors.find(i=>i.id===row.roleId);
    if(item){qmqzStoreItems.open(item,h.openDialog,screen,parent);return;}
    qmqzStoreItems.origin(screen,parent);
    if(role){qmqzRoleMedia.store(role.id,screen,h.openDialog,row.info||"");return;}
    info(nameOf(row,catalog),row.info||[row.rPoint?row.rPoint+" 强化点":"",row.exp?row.exp+" 经验":""].filter(Boolean).join("、"),screen,h,parent);
  }
  let nextFilter=0;
  function paint(el,{part,clock}){
    const age=qmqzMenuFX.start(clock);
    el.dataset.shopShowcase=part;
    if(part==="title"){
      const animation=el.animate([{opacity:0,scale:"2",offset:0},{opacity:0,scale:"2",offset:.66666},
        {opacity:1,scale:"2",offset:2/3,easing:qmqzMenuFX.smooth},{opacity:1,scale:"1"}],{duration:1500,fill:"both"});
      animation.currentTime=age;
      return;
    }
    // Original GLES fragment equation: rgb *= mix(1, (2.08,1.82,1.82), _lerp);
    // alpha *= 2 * clamp(2.5 * (u - _fadeOutX) + 0.5, 0, 1).
    const ns="http://www.w3.org/2000/svg",key="gacha-showcase-"+(++nextFilter);
    function make(parent,tag,attrs={}){
      const node=document.createElementNS(ns,tag);
      for(const [name,value] of Object.entries(attrs))node.setAttribute(name,String(value));
      parent.append(node);return node;
    }
    const svg=make(el,"svg",{width:"100%",height:"100%","aria-hidden":"true"}),defs=make(svg,"defs");
    const gradient=make(defs,"linearGradient",{id:key+"-sweep",x1:"-20%",x2:"20%"});
    make(gradient,"stop",{offset:0,"stop-color":"white","stop-opacity":0});
    make(gradient,"stop",{offset:1,"stop-color":"white"});
    make(gradient,"animateTransform",{attributeName:"gradientTransform",type:"translate",from:"1 0",to:"0 0",
      begin:-age/1000+"s",dur:"1s",fill:"freeze"});
    const mask=make(defs,"mask",{id:key+"-mask",x:0,y:0,width:"100%",height:"100%"});
    make(mask,"rect",{width:"100%",height:"100%",fill:"url(#"+key+"-sweep)"});
    const filter=make(defs,"filter",{id:key+"-color","color-interpolation-filters":"sRGB"});
    const transfer=make(filter,"feComponentTransfer");
    for(const [channel,peak] of [["R",2.08],["G",1.82],["B",1.82]]){
      const f=make(transfer,"feFunc"+channel,{type:"linear",slope:1});
      make(f,"animate",{attributeName:"slope",values:[1,peak,peak,1,1].join(";"),keyTimes:"0;.125;.25;.375;1",
        begin:((part==="daily"?5500:1500)-age)/1000+"s",dur:"8s",repeatCount:"indefinite"});
    }
    make(transfer,"feFuncA",{type:"linear",slope:2});
    const group=make(svg,"g",{filter:"url(#"+key+"-color)"});
    const image=el.style.backgroundImage.slice(5,-2);
    make(group,"image",{width:"100%",height:"100%",preserveAspectRatio:"none",href:image,mask:"url(#"+key+"-mask)"});
    el.style.backgroundSize="0 0";
  }
  async function display(nodes,profile,h,catalog) {
    const [cfg,rewards]=await Promise.all([h.data("shop-prizes"),h.data("store-rewards")]);
    if(!requested){requested=true;h.command("original-menu:"+JSON.stringify({id:1048657,fields:{}}));}
    const byId=new Map(rewards.prizes.map(r=>[r.ID,r])),top=[[1485,2076,cfg.month,"month"],[6842,3948,daily||cfg.initialDaily,"daily"]];
    for(const [button,art,id,part] of top){
      const r=byId.get(id);if(!r)continue;
      const image=cfg.images[id]||catalog.items.find(i=>i.id===r.itemId)?.icon;
      h.picture(nodes,art,image);h.edit(nodes,art,{active:!!image,shopShowcase:{part,clock}});
      h.edit(nodes,button,{label:nameOf(r,catalog),action:()=>open(r,catalog,"GachaWindow",h)});
    }
    h.edit(nodes,1720,{active:true,shopShowcase:{part:"title",clock}});
    for(const [kind,cap,check] of [[0,2514,1975],[1,1333,6175]]){
      const action=()=>openList(kind,h);
      h.edit(nodes,cap,{label:kind?"中礼包奖品列表":"小礼包奖品列表",action});
      h.edit(nodes,check,{action});
    }
    const detailShown=["StoreItemDetails","PackItem","PrizeInfo"].includes(h.dialog);
    if(h.dialog!=="GachaListDialog" && !(detailShown && qmqzStoreItems.previous()==="GachaListDialog"))return;
    const [layout,pref]=await Promise.all([h.data("GachaListDialog"),h.data("GachaListItem")]);
    const box=layout.filter(n=>!h.nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
    h.edit(box,1947,{active:true});h.edit(box,2718,{action:detailShown?null:h.closeDialog});
    const ids=pool?[...cfg.types[3],...cfg.types[2]]:cfg.types[1];
    maxOffset=Math.max(0,Math.ceil(ids.length/2)*172-510);
    const grid=h.nodeById(box,8010);grid.p=[grid.p[0],grid.p[1]+listOffset];
    for(let idx=0;idx<ids.length;idx++){
      const y=-Math.floor(idx/2)*172;
      if(y+listOffset>175||y+listOffset < -590)continue;
      const r=byId.get(ids[idx]);if(!r)continue;
      const prefix="gacha-list-"+r.ID+"-", item=catalog.items.find(i=>i.id===r.itemId),actor=catalog.actors.find(i=>i.id===r.roleId), title=nameOf(r,catalog);
      const group=h.clonePrefab(pref,prefix,8010,0,{1287:title,1161:r.unlockLevel+"级解锁"},
        {p:[idx%2*300,y],label:title,action:detailShown?null:()=>open(r,catalog,"GachaWindow",h,"GachaListDialog")});
      for(const [id,visible] of [[1409,!!item],[1481,!!actor],[1000,!item&&!actor],[1086,!!actor&&profile.equipment?.ownedActors?.includes(actor.id)],
        [1461,r.unlockLevel>profile.level],[1498,false]])h.edit(group,prefix+id,{active:!!visible});
      if(item)h.picture(group,prefix+1409,item.icon);
      else if(actor)h.picture(group,prefix+1481,actor.image);
      else h.picture(group,prefix+1000,(r.rPoint?"Icon_ResearchPoints":"Icon_exp")+"-964777403.png");
      box.push(...group);
    }
    nodes.push(...box);
  }
  async function showInfo(nodes,h) {
    if(!notice)return;
    const m=(await h.data("GoRecharge")).filter(n=>!h.nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
    h.edit(m,8813,{active:true});h.label(m,5544,notice.name);h.label(m,2446,notice.text);
    h.edit(m,8079,{active:false});h.edit(m,3278,{p:[0,-84],action:h.closeDialog});h.label(m,6466,"确定");nodes.push(...m);
  }
  function protocol(message,render){if(message.id===1048658){daily=message.fields.gachaid;render();}}
  window.qmqzShopPrizes={begin,open,info,display,paint,protocol,showInfo,offset:()=>listOffset,
    scroll:v=>{listOffset=Math.max(0,Math.min(v,maxOffset));}};
})();
