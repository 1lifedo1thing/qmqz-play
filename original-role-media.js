(() => {
  "use strict";
  let selected=0,origin="BarrackWindow",pending=false,shopInfo="";
  function open(id,source,go) {
    selected=id;origin=source;pending=false;go("RolePurchase");
  }
  function store(id,source,openDialog,info="") {
    shopInfo=info;selected=id;origin=source;pending=false;openDialog("PackItem");
  }
  window.addEventListener("qmqz-protocol",e=>{
    if(e.detail.id===786446)pending=false;
  });
  async function display(nodes,state,h,screen) {
    const [roles,inventory,text]=await Promise.all([h.data("role-media"),h.data("inventory"),h.data("strings")]);
    const row=roles.find(v=>v.id===selected),eq=state.profile?.equipment;
    if(!row||!eq)return;
    const owned=eq.ownedActors||[],human=row.camp!==3;
    if(screen==="PackItem"||h.nodeById(nodes,2274)) {
      h.edit(nodes,2274,{active:true});h.edit(nodes,1334,{active:false});h.edit(nodes,8049,{active:true});
      h.label(nodes,4521,row.name);h.label(nodes,8802,shopInfo||row.info);
      h.picture(nodes,8435,row.bust);
      for(const id of [2879,2486])h.edit(nodes,id,{action:h.closeDialog});
      return;
    }
    h.edit(nodes,359,{active:true});
    h.edit(nodes,2188,{active:human});h.edit(nodes,484,{active:!human});
    h.edit(nodes,7997,{active:row.camp===1});h.edit(nodes,7954,{active:row.camp===2});
    for(const id of [8850,1499])h.label(nodes,id,row.name);
    for(const id of [8892,8962])h.label(nodes,id,row.info);
    if(human)h.picture(nodes,5955,row.body);
    h.picture(nodes,human?622:1682,row.bust);
    for(const [button,pos,icon,title] of [[7281,101,5557,2385],[4104,104,5997,7484],
      [4447,102,5415,3980],[8710,103,2915,2027]]) {
      const equipped=(eq.subjoins||[]).find(s=>s.actor===row.id && s.pos===pos);
      const item=inventory.items.find(i=>i.id===equipped?.itemId);
      if(item){h.picture(nodes,icon,item.icon);h.label(nodes,title,item.name);}
      h.edit(nodes,button,{slot:pos,label:h.nodeById(nodes,title)?.widget?.text,action:()=>{
        if(!human){h.notify(588);return;}
        if(!owned.includes(row.id)){h.notify(507);return;}
        qmqzInventory.openAccessory(row.id,pos,state,h.go);
      }});
    }
    h.label(nodes,6802,String(Math.max(0,row.gem)));
    h.edit(nodes,7448,{active:owned.includes(row.id)});
    if(owned.includes(row.id))h.label(nodes,7448,(text[[0,414,415,606][row.camp]]||"{0}").replace("{0}",inventory.permanent));
    h.edit(nodes,126,{action:()=>h.go(origin)});
    const exhibit=()=>{
      if(row.gem<0&&!owned.includes(row.id)){h.notify(614,row.name);return;}
      const slot=eq.loadouts[0]?.slots.find(v=>v.position===11);
      const weapon=inventory.items.find(v=>v.id===(slot?.itemId||slot?.effectiveItemId));
      const visible=roles.filter(v=>v.gem>=0||owned.includes(v.id))
        .map(v=>({...v,gender:inventory.actors.find(a=>a.id===v.id)?.gender}));
      qmqzExhibition.role(visible,row.id,weapon,h,eq);
    };
    for(const id of [3619,5636])h.edit(nodes,id,{label:"3D预览",action:exhibit});
    h.edit(nodes,3843,{active:row.gem>0,label:"购买角色",action:()=>{
      if(owned.includes(row.id)){h.notify(50);return;}
      if(state.profile.gold<row.gem){qmqzStore.recharge(h.go,"RolePurchase");return;}
      if(pending)return;
      pending=true;h.command("original-menu:"+JSON.stringify({id:786445,fields:{id:row.id}}));
    }});
    // GiftManager.HasPresent starts at zero until ScPresentList supplies a gift allowance.
    h.edit(nodes,5488,{active:row.gem<0?!owned.includes(row.id):row.gem>0,action:()=>{
      if(row.gem<0)qmqzStore.gacha(h.go,"RolePurchase");
      else h.notify(472);
    }});
  }
  window.qmqzRoleMedia={open,store,display};
})();
