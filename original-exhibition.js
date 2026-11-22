(() => {
  "use strict";
  let quotedCount=0, restoreTab=-1, actors=[], weapons=[], actorIndex=0, weaponIndex=0, yaw=15, loaded=false, redraw=null;
  let source="EquipWindow", equipmentState=null, selectedSlot=0, tryItem=null, page=0, pending=false, saveError=false, appearance="";
  const slots=[
    {pos:101,root:4810,grid:6476,title:"头部饰品"},{pos:104,root:7131,grid:4786,title:"面部饰品"},
    {pos:102,root:8770,grid:6262,title:"背部饰品"},{pos:103,root:4988,grid:6004,title:"尾部饰品"}
  ];
  function show(dress=false) {
    const actor=actors[actorIndex], request={role:actor.id,weapon:weapons[weaponIndex].id,yaw};
    if(dress && actor.camp!==3) {
      const saved=(equipmentState?.subjoins||[]).filter(s=>s.actor===actor.id);
      const subjoins=tryItem===null ? saved : saved.filter(s=>s.pos!==selectedSlot);
      if(tryItem>0)subjoins.push({actor:actor.id,pos:selectedSlot,itemId:tryItem});
      const key=JSON.stringify([actor.id,actor.gender,subjoins]);
      if(appearance===key)return;
      appearance=key;
      Object.assign(request,{dress:true,gender:actor.gender,subjoins});
    }
    qmqzUnity.SendMessage("WebClient","Exhibit",JSON.stringify(request));
  }
  function resetSlot() { selectedSlot=0;tryItem=null;page=0;pending=false;saveError=false;appearance=""; }
  function fittingYaw(pos) { return pos===102 || pos===103 ? 165 : 15; }
  function change(actor,weapon,h) {
    actorIndex=actor;weaponIndex=weapon;yaw=15;loaded=false;resetSlot();show(true);h.render();
  }
  function close() {
    redraw=null;actors=[];weapons=[];resetSlot();equipmentState=null;
    qmqzUnity.SendMessage("WebClient","Exhibit","close");
  }
  function role(available,id,weapon,h,eq,pos=0) {
    const index=available.findIndex(actor=>actor.id===id);
    if(index<0 || !weapon)return;
    source="RolePurchase";
    actors=available;weapons=[weapon];actorIndex=index;weaponIndex=0;
    yaw=fittingYaw(pos);loaded=false;redraw=h.render;equipmentState=eq;resetSlot();selectedSlot=pos;
    h.go("Exhibition");show(true);
  }
  function shopItem(item,catalog,eq,h,back="StoreWindow") {
    const accessory=item.subType===24;
    const slot=eq.loadouts[0]?.slots.find(s=>s.position===11);
    const weapon=accessory?catalog.items.find(v=>v.id===(slot?.itemId||slot?.effectiveItemId)):item;
    const available=catalog.actors.filter(v=>v.camp!==3 && eq.ownedActors.includes(v.id) && (!accessory||!item.actorId||v.id===item.actorId));
    if(!available.length||!weapon){h.notify(667);return;}
    source=back;actors=available;weapons=[weapon];actorIndex=0;weaponIndex=0;
    yaw=15;loaded=false;redraw=h.redraw;equipmentState=eq;resetSlot();
    if(accessory){selectedSlot=item.equipPos;tryItem=item.id;yaw=fittingYaw(selectedSlot);}
    h.go("Exhibition");show(true);
  }
  window.addEventListener("qmqz-exhibit-ready",e=>{
    if(e.detail.role!==actors[actorIndex]?.id || e.detail.weapon!==weapons[weaponIndex]?.id)return;
    loaded=e.detail.meshes>0;redraw?.();
  });
  window.addEventListener("qmqz-state",e=>{
    if(!pending||!e.detail?.storageError)return;
    pending=false;saveError=true;tryItem=null;
    equipmentState=e.detail.profile?.equipment||equipmentState;
    show(true);redraw?.();
  });
  let drag, touchButton, lastTouch;
  document.addEventListener("pointerdown",e=>{
    lastTouch=null;
    const menu=e.target.closest('#original-menu[data-screen="Exhibition"]');
    if(!menu)return;
    const button=e.target.closest("button");
    if(button && button.dataset.object!=="Stage") {
      if(e.pointerType==="touch")touchButton={id:e.pointerId,button,x:e.clientX,y:e.clientY};
      return;
    }
    const stage=menu.querySelector('[data-object="Stage"]')?.getBoundingClientRect();
    if(!stage||e.clientX<stage.left||e.clientX>stage.right||e.clientY<stage.top||e.clientY>stage.bottom)return;
    drag={id:e.pointerId,x:e.clientX};
    menu.setPointerCapture(e.pointerId);
  });
  document.addEventListener("pointermove",e=>{
    if(!drag||drag.id!==e.pointerId||!loaded)return;
    yaw-=(e.clientX-drag.x)*.5;drag.x=e.clientX;show();
  });
  document.addEventListener("pointerup",e=>{
    drag=null;
    const tap=touchButton;touchButton=null;
    if(!tap||tap.id!==e.pointerId||e.target!==tap.button||Math.hypot(e.clientX-tap.x,e.clientY-tap.y)>8)return;
    // Mobile browsers can suppress the compatibility click that follows a rotated model.
    lastTouch={x:e.clientX,y:e.clientY,time:performance.now()};
    tap.button.click();
  });
  document.addEventListener("pointercancel",()=>{drag=null;touchButton=null;});
  document.addEventListener("click",e=>{
    if(e.detail>0 && (e.pointerType==="touch" || e.sourceCapabilities?.firesTouchEvents) &&
      lastTouch && performance.now()-lastTouch.time<600 &&
      Math.hypot(e.clientX-lastTouch.x,e.clientY-lastTouch.y)<8) {
      e.preventDefault();e.stopImmediatePropagation();lastTouch=null;
    }
  },true);

  async function equipment(nodes,state,tab,catalog,h) {
    const eq=state.profile.equipment, count=eq.loadouts.length;
    h.edit(nodes,63,{label:"购买档位",action:()=>{
      if(count>=10){h.notify(350);return;}
      quotedCount=count;restoreTab=-1;h.openDialog("GetEquipBar");
    }});
    h.edit(nodes,1700,{label:"预览装备",action:()=>{
      const byId=new Map(catalog.items.map(item=>[item.id,item]));
      const slots=eq.loadouts[tab].slots;
      weapons=[11,12,50].map(pos=>slots.find(s=>s.position===pos)).filter(Boolean)
        .map(s=>byId.get(s.itemId||s.effectiveItemId)).filter(Boolean);
      actors=catalog.actors.filter(a=>a.camp!==3&&eq.ownedActors.includes(a.id));
      if(!actors.length||!weapons.length)return;
      source="EquipWindow";
      actorIndex=0;weaponIndex=0;yaw=15;loaded=false;redraw=h.render;equipmentState=eq;resetSlot();
      h.go("Exhibition");show(true);
    }});
    if(eq.loadouts[tab]?.canRestoreDefaults){
      h.label(nodes,4087,"恢复默认");
      h.edit(nodes,1700,{label:"恢复默认装备",action:()=>{restoreTab=tab;h.openDialog("GetEquipBar");}});
    }
    if(h.dialog!=="GetEquipBar")return;
    const [layout,prices,text]=await Promise.all([h.data("GetEquipBar"),h.data("equip-set-prices"),h.data("strings")]);
    const panel=layout.filter(n=>!h.nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
    const cost=prices.find(r=>r.id===quotedCount+1)?.gem;
    h.edit(panel,6722,{active:true});h.label(panel,6984,text[379].replace("{0}",cost));
    h.edit(panel,1282,{action:h.closeDialog});
    if(restoreTab>=0){
      h.label(panel,6577,"恢复默认装备");
      h.label(panel,6984,"为背包 "+(restoreTab+1)+" 补齐默认装备？已有装备会保留。");
      h.edit(panel,2270,{action:()=>{
        const index=restoreTab;restoreTab=-1;h.closeDialog();
        h.command("original-menu:"+JSON.stringify({view:"restore-loadout",fields:{tab:index}}));
      }});
      nodes.push(...panel);return;
    }
    h.edit(panel,2270,{action:()=>{
      h.closeDialog();
      if(count!==quotedCount||cost===undefined)return;
      if(state.profile.gold<cost){qmqzStore.recharge(h.go,"EquipWindow");return;}
      h.command("original-menu:"+JSON.stringify({id:786448,expectedCount:quotedCount,fields:{}}));
    }});
    nodes.push(...panel);
  }
  function pickerButton(nodes,h,confirm,text,name,p,action) {
    const tree=confirm.filter(n=>n.id===5286||n.parent===5286).map(n=>n.id===5286?{...n,parent:0}:n);
    const prefix="accessory-"+name+"-";
    nodes.push(...h.clonePrefab(tree,prefix,6177,p[1],{4562:text},{p,name,label:text,action,active:true,s:[.87,.87]}));
  }
  function pickerArrow(nodes,h,name,step,x,count) {
    const root=step<0?3422:3460;
    const tree=nodes.filter(n=>n.id===root||n.parent===root).map(n=>n.id===root?{...n,parent:0}:n);
    const target=page+step;
    nodes.push(...h.clonePrefab(tree,"accessory-page-"+name+"-",6177,0,{},{
      name,label:step<0?"上一页饰品":"下一页饰品",p:[x,-243],active:target>=0&&target<count,
      action:()=>{page=target;h.render();}
    }));
  }
  function accessoryList(nodes,h,prefab,highlight,confirm,catalog,actor) {
    const saved=(equipmentState.subjoins||[]).filter(s=>s.actor===actor.id);
    const selected=slots.find(s=>s.pos===selectedSlot);
    const chosen=saved.find(s=>s.pos===selectedSlot)?.itemId||-1;
    if(pending && chosen===tryItem){pending=false;tryItem=null;}
    for(const slot of slots) {
      h.edit(nodes,slot.root,{label:slot.title,slot:slot.pos,hit:[0,0,148,140],action:()=>{
        if(pending)return;
        selectedSlot=slot.pos===selectedSlot?0:slot.pos;tryItem=null;page=0;saveError=false;
        yaw=fittingYaw(selectedSlot);show();show(true);h.render();
      }});
      const id=slot.pos===selectedSlot && tryItem!==null?tryItem:saved.find(s=>s.pos===slot.pos)?.itemId;
      const item=catalog.items.find(i=>i.id===id);
      if(item) {
        const prefix="worn-"+slot.pos+"-";
        const row=h.clonePrefab(prefab,prefix,slot.grid,0,{1101:item.name});
        h.picture(row,prefix+1173,item.icon);nodes.push(...row);
      }
      if(selectedSlot===slot.pos)nodes.push(...h.clonePrefab(highlight,"accessory-slot-",slot.root,0,{}, {s:[145,134]}));
    }
    if(!selected)return false;
    const items=catalog.items.filter(i=>i.subType===24 && i.equipPos===selectedSlot && (!i.actorId||i.actorId===actor.id));
    const owned=equipmentState.ownedItems||[], canWear=(equipmentState.ownedActors||[]).includes(actor.id);
    const pages=Math.max(1,Math.ceil(items.length/6));
    h.label(nodes,2086,selected.title+" "+(page+1)+"/"+pages);
    h.edit(nodes,2086,{p:[-14,247]});
    if(saveError) {
      const title=h.nodeById(nodes,1708);
      nodes.push(...h.clonePrefab([{...title,parent:0}],"accessory-save-error-",6177,-224,
        {1708:"保存失败，请重试"},{p:[-10,-224]}));
    }
    items.slice(page*6,page*6+6).forEach((item,index)=>{
      const prefix="pick-"+item.id+"-",root=prefix+1242;
      const row=h.clonePrefab(prefab,prefix,6177,0,{1101:item.name},{
        p:[index%2?69:-97,145-Math.floor(index/2)*145],label:item.name,itemId:item.id,hit:[0,0,148,140],action:()=>{
          if(pending)return;saveError=false;tryItem=item.id;show(true);h.render();
        }
      });
      // ExhibitSubjoin normally sits inside a decorated slot. Its standalone list cell has no backdrop.
      const backing=h.nodeById(nodes,2108);
      row.push({...backing,id:prefix+"background",parent:root});
      h.picture(row,prefix+1173,item.icon);
      h.edit(row,prefix+1173,{s:[148,148*79.2/187.2],p:[0,2]});
      const equipped=item.id===chosen, flag=h.nodeById(row,prefix+1022);
      h.edit(row,flag.id,{active:equipped||!owned.includes(item.id),p:[36,48]});
      if(equipped)flag.widget={...flag.widget,text:"已装备",color:[240,210,120,255],shadow:[0,0,0,255]};
      nodes.push(...row);
      if((tryItem??chosen)===item.id)nodes.push(...h.clonePrefab(highlight,"pick-selected-",root,0,{}, {s:[148,140]}));
    });
    pickerArrow(nodes,h,"PreviousAccessoryPage",-1,-105,pages);
    pickerArrow(nodes,h,"NextAccessoryPage",1,80,pages);
    const write=(id)=>{
      if(pending)return;
      pending=true;tryItem=id;show(true);
      h.command("original-menu:"+JSON.stringify({id:786483,fields:{actor:actor.id,pos:selectedSlot,subjoinid:id}}));
    };
    if(canWear && tryItem>0 && tryItem!==chosen && owned.includes(tryItem))
      pickerButton(nodes,h,confirm,"装备","WearAccessory",[66,-302],()=>write(tryItem));
    if(canWear && chosen>0)
      pickerButton(nodes,h,confirm,"卸下","RemoveAccessory",[-98,-302],()=>write(-1));
    return true;
  }
  async function display(nodes,h,state) {
    const actor=actors[actorIndex];
    if(!actor)return;
    const [weaponPrefab,highlight,prefab,confirm,catalog]=await Promise.all([
      h.data("ExhibitWeapon"),h.data("Highlight"),h.data("ExhibitSubjoin"),h.data("ConfirmBox"),h.data("inventory")
    ]);
    equipmentState=state?.profile?.equipment||equipmentState;
    h.edit(nodes,8461,{active:true});h.edit(nodes,7210,{active:false});
    h.edit(nodes,5738,{active:!loaded});h.edit(nodes,3325,{active:false});
    h.label(nodes,6437,actor.name);
    h.edit(nodes,3880,{action:()=>{const back=source;close();if(typeof back==="function")back();else h.go(back);}});
    for(const [id,step] of [[3422,-1],[3460,1]])h.edit(nodes,id,{action:()=>{
      change((actorIndex+actors.length+step)%actors.length,weaponIndex,h);
    }});
    h.edit(nodes,7424,{label:"旋转装备模型",action:()=>{}});
    if(actor.camp===3) {
      h.edit(nodes,6177,{active:false});h.edit(nodes,7959,{active:false});
      return;
    }
    if(accessoryList(nodes,h,prefab,highlight,confirm,catalog,actor)){show(true);return;}
    show(true);
    weapons.forEach((item,index)=>{
      const prefix="exhibit"+index+"-",copy=h.clonePrefab(weaponPrefab,prefix,5205,-162*index,{1174:item.name},{
        label:item.name,itemId:item.id,action:()=>{if(index!==weaponIndex)change(actorIndex,index,h);}
      });
      h.picture(copy,prefix+1102,item.icon);
      h.edit(copy,prefix+1243,{active:false});
      h.edit(copy,prefix+1298,{active:item.star>=8});
      nodes.push(...copy);
      if(index===weaponIndex) {
        // The source list links the shared Highlight prefab on its selected row.
        const selected=copy.find(n=>n.parent===5205);
        nodes.push(...h.clonePrefab(highlight,prefix+"selected-",selected.id,0,{}, {s:selected.hit.slice(2)}));
      }
    });
  }
  window.qmqzExhibition={equipment,display,close,role,shopItem};
})();
