(() => {
  "use strict";
  let tab = null, position = 0, group = 1, selected = 0;
  let actorOffset = 0, depotOffset = 0, tabCount = 0, actorCount = 0, itemCount = 0;
  let filterOpen = false, filterValue = 0;
  let revealSelection = false;
  let accessory=null, pendingEquip=null, printedItem=null;
  const depotEntries = new Map();

  function begin() {
    tab = null; actorOffset = 0; accessory=null;pendingEquip=null;printedItem=null;
  }
  function openAccessory(actor,pos,state,go) {
    const gear=state.profile?.equipment;
    if(!gear?.ownedActors?.includes(actor)||![101,102,103,104].includes(pos))return;
    pendingEquip=null;printedItem=null;accessory={actor,pos,role:state.profile.roleid,go};
    selected=gear.subjoins?.find(s=>s.actor===actor && s.pos===pos)?.itemId||0;
    position=pos;group=4;depotOffset=0;filterOpen=false;filterValue=0;
    revealSelection=!!selected;depotEntries.clear();
    go("DepotWindow");
  }
  function closeAccessory() {
    const previous=accessory;
    if(!previous)return;
    accessory=null;position=0;group=1;
    previous.go("RolePurchase");
  }
  window.addEventListener("qmqz-protocol",event=>{
    const {id,fields}=event.detail;
    if(pendingEquip && (id===786437 || id===786438) && fields.tab===pendingEquip.tab &&
       fields.position===pendingEquip.position) {
      const p=pendingEquip;
      pendingEquip=null;
      if(!document.querySelector('#original-menu[data-screen="DepotWindow"]') ||
         window.qmqzLastState?.profile?.roleid!==p.role)return;
      const actual=id===786438 ? -1 : fields.weaponid;
      if(actual===p.id) {
        p.go("EquipWindow");
        p.notify(p.name+(actual===-1?"已卸下":"已装备")+" · 背包 "+(p.tab+1));
      } else p.notify("背包 "+(p.tab+1)+" 保留原装备");
    }
    if(id===786484 && accessory && accessory.actor===fields.actor && accessory.pos===fields.pos &&
        accessory.pending===fields.subjoinid && document.querySelector('#original-menu[data-screen="DepotWindow"]'))
      closeAccessory();
  });
  window.addEventListener("qmqz-state",({detail})=>{
    if(pendingEquip && detail.storageError) {
      const {notify}=pendingEquip;pendingEquip=null;
      notify("保存背包失败，请重试");
    }
  });
  function scroll(panel) {
    return ({"8455":"actors","1985":"depot","1549":"loadouts"})[panel];
  }
  function offset(key) {
    if (key==="actors") return actorOffset;
    if (key==="depot") return depotOffset;
    return (tab ?? 0)*960;
  }
  function setOffset(key,value) {
    const clamp=(n,max)=>Math.min(Math.max(0,n),Math.max(0,max));
    if (key==="actors") actorOffset=clamp(value,actorCount*207.1-916.88);
    if (key==="depot") depotOffset=clamp(value,Math.ceil(itemCount/2)*145-440);
    if (key==="loadouts") tab=clamp(Math.round(value/960),tabCount-1);
  }
  const highlightMasks=new Map();
  function texturePixels(image) {
    const canvas=document.createElement("canvas");
    canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const ctx=canvas.getContext("2d");
    ctx.drawImage(image,0,0);
    return ctx.getImageData(0,0,canvas.width,canvas.height);
  }
  function highlight(el,image,w) {
    // ColorTexture uses vertex alpha as its shine threshold. Source alpha controls normal visibility.
    const material=w.depotHighlight;
    Object.assign(el.style,{opacity:1,padding:0,backgroundSize:"100% 100%"});
    if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    if(!highlightMasks.has(material.mask))
      highlightMasks.set(material.mask,qmqzUiDensity.load("original-ui/"+material.mask).then(texturePixels));
    highlightMasks.get(material.mask).then(mask=>{
      if(!el.isConnected)return;
      const source=texturePixels(image), canvas=document.createElement("canvas");
      canvas.width=source.width;canvas.height=source.height;
      canvas.setAttribute("aria-hidden","true");
      Object.assign(canvas.style,{width:"100%",height:"100%",display:"block",pointerEvents:"none"});
      const ctx=canvas.getContext("2d"), result=ctx.createImageData(source.width,source.height);
      const threshold=w.color[3]/255;
      let last=-100, wasActive=false;
      function draw(now) {
        if(!el.isConnected)return;
        requestAnimationFrame(draw);
        if(now-last<32)return;
        last=now;
        // HighLightMaterialHelper.Update supplies frac(0.21 * Time.time) to the original shader.
        const edge=source.width*((now*.00021)%1)*material.travel;
        const width=source.width*material.width;
        const start=Math.max(0,Math.floor(edge)), end=Math.min(source.width,Math.ceil(edge+width));
        if(start>=end && !wasActive)return;
        wasActive=start<end;
        canvas.hidden=!wasActive;
        canvas.style.display=wasActive?"block":"none";
        el.style.backgroundImage=wasActive?"none":'url("'+image.src+'")';
        if(!wasActive)return;
        result.data.set(source.data);
        for(let y=0;y<source.height;y++) {
          const row=Math.min(mask.height-1,Math.floor((y+.5)*mask.height/source.height))*mask.width;
          for(let x=start;x<end;x++) {
            const i=(y*source.width+x)*4, alpha=source.data[i+3]/255;
            if(alpha<=threshold)continue;
            const col=Math.max(0,Math.min(mask.width-1,Math.floor((x+.5-edge)*mask.width/width)));
            const strength=mask.data[(row+col)*4+3]/255;
            const shine=strength*(alpha-threshold)/(1.01-threshold)*255;
            // The APK highlight mask is white, with the specular profile encoded in alpha.
            for(let c=0;c<3;c++)result.data[i+c]=source.data[i+c]+shine;
            result.data[i+3]=source.data[i+3]+shine*strength;
          }
        }
        ctx.putImageData(result,0,0);
      }
      canvas.style.display="none";el.append(canvas);requestAnimationFrame(draw);
    }).catch(()=>{}); // Keep the full-alpha original image if the optional mask cannot load.
  }
  async function display(screen,nodes,state,api) {
    const {data,edit,label,picture,nodeById,clonePrefab,go,command,render}=api;
    const [catalog,text]=await Promise.all([data("inventory"),data("strings")]);
    const equipment=state.profile?.equipment || {};
    const ownedIds=new Set(equipment.ownedItems || []);
    const sets=equipment.loadouts||[], owned=catalog.items.filter(item=>ownedIds.has(item.id));
    tabCount=sets.length;
    tab=Math.max(0,Math.min(tab ?? equipment.activeindex ?? 0,sets.length-1));
    const slots=sets[tab]?.slots||[];
    const equipped=pos=>slots.find(s=>s.position===pos)?.itemId;
    const byId=new Map(catalog.items.map(item=>[item.id,item]));
    function showStars(root,stars) {
      const binding=root?.EquipLevel;
      if(!binding)return;
      edit(nodes,root.id,{active:stars>0});
      if(!stars)return;
      const frame=nodeById(nodes,binding.levelSprite)?.widget?.starImages;
      if(frame)picture(nodes,binding.levelSprite,frame[stars<4?0:stars<7?1:stars<10?2:3]);
      label(nodes,binding.levelLabel,stars>=10?stars-9:stars);
    }
    function showTag(list,id,item) {
      const image=nodeById(list,id)?.widget?.tagImages?.[item?.levelTag];
      edit(list,id,{active:!!image});
      if(image)picture(list,id,image);
    }
    function openDepot(pos,category) {
      accessory=null;pendingEquip=null;printedItem=null;
      position=pos;group=category;selected=pos ? equipped(pos) : 0;depotOffset=0;filterOpen=false;filterValue=0;
      revealSelection=!!selected;depotEntries.clear();go("DepotWindow");
    }
    if (screen==="EquipWindow") {
      edit(nodes,7413,{active:false});
      edit(nodes,5785,{action:()=>openDepot(0,1)});
      edit(nodes,5305,{action:()=>go("BarrackWindow")});
      for (const n of nodes.filter(n=>n.parent===5917 && n.EquipPicker)) {
        const ref=n.EquipPicker, slot=slots.find(s=>s.position===ref.position);
        const item=byId.get(slot?.itemId);
        label(nodes,ref.itemName,item?.name);
        edit(nodes,ref.weapon,{active:!!item?.icon});picture(nodes,ref.weapon,item?.icon);
        for (const id of [ref.leftTimeObj,ref.broken]) edit(nodes,id,{active:false});
        showStars(nodeById(nodes,ref.starSprite),item?.star);
        showTag(nodes,ref.levelTag,item);
        if (ref.durable) edit(nodes,ref.durable,{active:!!item});
        if (owned.some(it=>it.equipPos===ref.position)) edit(nodes,n.id,{slot:ref.position,
          label:item?.name||n.name,action:()=>openDepot(ref.position,ref.group)});
      }
      const active=nodeById(nodes,7713)?.widget?.image;
      const idle=nodeById(nodes,7713)?.widget?.idleImage;
      const locked=nodeById(nodes,6113)?.widget?.image;
      for(const n of nodes.filter(n=>n.parent===8165)) {
        const index=Number(n.name.replace("Arsenal",""))-1;
        picture(nodes,n.id,index===tab?active:index<tabCount?idle:locked);
        if(index<tabCount)edit(nodes,n.id,{hit:[0,0,1,1],label:"套装 "+(index+1),action:()=>{tab=index;render();}});
      }
      await qmqzAmmoShop.display(nodes,slots,byId,equipment,api);
      await qmqzExhibition.equipment(nodes,state,tab,catalog,api);
    } else if (screen==="BarrackWindow") {
      const prefab=await data("RoleListItem");
      const actors=catalog.actors, ownedActors=new Set(equipment.ownedActors||[]);
      actorCount=actors.length;
      const grid=nodeById(nodes,4024);grid.p=[grid.p[0]-actorOffset,grid.p[1]];
      const ref=prefab.find(n=>n.RoleListItem).RoleListItem;
      const first=Math.max(0,Math.floor(actorOffset/207.1)-1);
      actors.slice(first,Math.ceil((actorOffset+916.88)/207.1)+1).forEach((actor,offset)=>{
        const index=first+offset;
        const prefix="actor"+actor.id+"-", bio=actor.camp===3, has=ownedActors.has(actor.id);
        const isDefault=actor.id===(actor.camp===1?equipment.policeactorid:equipment.terristactorid);
        const rows=clonePrefab(prefab,prefix,4024,0,{[ref.roleName]:actor.name},{
          p:[index*207.1,0],label:actor.name,action:()=>qmqzRoleMedia.open(actor.id,"BarrackWindow",go)
        });
        picture(rows,prefix+ref.role,actor.image);
        const name=nodeById(rows,prefix+ref.roleName);
        name.widget.shadow=[null,[0,180,255,255],[255,0,0,255],[0,255,0,255]][actor.camp];
        const rare=actor.gem<0;
        edit(rows,prefix+ref.money,{active:!has&&!rare});
        label(rows,prefix+ref.price,actor.gem);
        edit(rows,prefix+ref.choose,{active:has&&!bio&&!isDefault,actorId:actor.id,action:()=>command("original-actor:"+actor.id)});
        edit(rows,prefix+ref.status,{active:has?(bio||isDefault):rare});
        if(has&&bio)label(rows,prefix+ref.status,text[167]);
        else if(!has&&rare)label(rows,prefix+ref.status,actor.unownedStatus);
        edit(rows,prefix+ref.subjoin,{active:has&&!bio});
        edit(rows,prefix+ref.info,{active:actor.time>0||rare||bio});
        const ability=rare&&!bio?647:[0,402,404,604][actor.camp];
        label(rows,prefix+ref.ability,actor.skillName||text[ability].replace("{0}",actor.addHp));
        let duration="";
        if(actor.time>0) {
          // Full-unlock ownership uses desttime=0. Refresh then shows Role.time, the original offer term.
          const days=text[408].replace("{0}",Math.ceil(actor.time/86400));
          duration=text[[0,403,405,605][actor.camp]].replace("{0}",days);
        } else if(rare) duration=text[bio?618:actor.camp===1?615:616];
        label(rows,prefix+ref.time,duration);
        nodes.push(...rows);
      });
    } else if (screen==="DepotWindow") {
      const [prefabs,highlight]=await Promise.all([data("DepotListItem"),data("ShopHighlight")]);
      if(accessory && (state.profile?.roleid!==accessory.role || !equipment.ownedActors?.includes(accessory.actor) ||
          catalog.actors.find(a=>a.id===accessory.actor)?.camp===3)) {
        closeAccessory();return;
      }
      const filter=owned.filter(it=>{
        if(accessory)return it.subType===24 && it.equipPos===accessory.pos && (!it.actorId || it.actorId===accessory.actor);
        if(position) return it.equipPos===position;
        return it.group===group && (!filterValue || (group===2 || group===3 ? it.equipPos : it.subType)===filterValue);
      });
      itemCount=filter.length;
      const item=filter.find(it=>it.id===selected)||filter[0];
      selected=item?.id||0;
      if(revealSelection) {
        const line=Math.floor(filter.indexOf(item)/2);
        if(line>=3)setOffset("depot",(line-1)*145);
        revealSelection=false;
      }
      const grid=nodeById(nodes,5957);grid.p=[grid.p[0],grid.p[1]+depotOffset];
      const ref=prefabs.find(n=>n.DepotListItem).DepotListItem;
      const first=2*Math.max(0,Math.floor(depotOffset/145)-1);
      const end=2*(Math.ceil((depotOffset+440)/145)+1);
      const clock={};
      let entering=0;
      filter.slice(first,end).forEach((it,offset)=>{
        const index=first+offset;
        const prefix="depot"+it.id+"-";
        const rowIndex=Math.floor(index/2);
        if(!depotEntries.has(it.id) && rowIndex>=Math.floor(depotOffset/145) &&
            rowIndex<Math.ceil((depotOffset+440)/145)) {
          // DepotListMgr.animType=2: UIGrid.Reposition opens each cell across X over 0.2 seconds.
          depotEntries.set(it.id,{name:"depot-item",clock,delay:200*entering++,duration:200,
            frames:[{transform:"scaleX(0)",easing:"linear"},{transform:"scaleX(1)"}]});
        }
        const rows=clonePrefab(prefabs,prefix,5957,0,{[ref.weaponName]:it.name},
          {p:[(index%2)*281.2,-rowIndex*145],sequence:depotEntries.get(it.id),itemId:it.id,label:it.name,action:()=>{selected=it.id;render();}});
        if(!it.missingDepotDetail)picture(rows,prefix+ref.weapon,it.icon);
        for(const id of [ref.leftTimeObj,ref.brokenObj,997])edit(rows,prefix+id,{active:false});
        showTag(rows,prefix+ref.levelTag,it);
        nodes.push(...rows);
        if(it.id===selected) {
          const row=rows.find(n=>n.parent===5957);
          nodes.push(...clonePrefab(highlight,"depot-selected-",row.id,0,{},{s:row.hit.slice(2),z:0}));
        }
      });
      const resetList=()=>{selected=0;printedItem=null;depotOffset=0;depotEntries.clear();};
      function held(id) {
        const ref=nodeById(nodes,id)?.held;
        if(ref){const art=nodeById(nodes,ref.target);art.widget={...art.widget,...ref.widget};}
      }
      const panels=[null,2526,316,4746,5169];
      for(const [id,category] of [[4602,1],[6965,2],[49,3],[3206,4],[4993,5]]) {
        if(category===group) held(id);
        edit(nodes,id,{action:position?null:()=>{resetList();group=category;filterValue=0;filterOpen=false;render();}});
      }
      edit(nodes,6601,{active:!position && !!panels[group],action:()=>{filterOpen=!filterOpen;render();}});
      edit(nodes,3429,{active:filterOpen});edit(nodes,8008,{active:filterOpen,p:nodeById(nodes,7747).p});
      for(const panel of panels.filter(Boolean))edit(nodes,panel,{active:panel===panels[group]});
      const values={All:0,Pistol:11,ShotGun:12,SubMachineGun:13,Rifle:14,MachineGun:15,Sniper:16,Melee:10,
        Hemlet:31,Armor:32,Boot:33,Grenade:41,Flash:42,Ammo:23,Subjoin:24,Clip:26,Piece:27,Extra:99};
      for(const n of nodes.filter(n=>n.parent===panels[group] && n.hit && Object.hasOwn(values,n.name))){
        if(values[n.name]===filterValue)held(n.id);
        edit(nodes,n.id,{action:()=>{resetList();filterValue=values[n.name];filterOpen=false;render();}});
      }
      // DepotWindow.Show equips from the chosen picker; the free depot uses each item's native position.
      label(nodes,4590,item?.name);
      edit(nodes,3818,{active:false});
      const target=position||item?.equipPos;
      const replaceable=item && [11,12,31,32,33,34,41,42,50].includes(target) && target===item.equipPos;
      const worn=replaceable && equipped(target)===item.id;
      const remove=worn && !!position && [31,32,33,34,41,42].includes(target);
      if(replaceable)label(nodes,5859,remove?catalog.accessoryActions[1]:worn?"已装备":catalog.accessoryActions[0]);
      edit(nodes,3296,{active:!!replaceable,itemId:item?.id,action:()=>{
        if(!replaceable || !ownedIds.has(item.id) || pendingEquip)return;
        if(worn && !remove) {
          go("EquipWindow");api.notify(item.name+"已装备 · 背包 "+(tab+1));return;
        }
        const id=remove?-1:item.id;
        pendingEquip={id,tab,position:target,name:item.name,role:state.profile.roleid,go,notify:api.notify};
        command("original-equip:"+JSON.stringify({tab,position:target,weaponid:id}));
      }});
      if(accessory) {
        edit(nodes,2684,{action:closeAccessory});
        for(const id of [766,6601,3429])edit(nodes,id,{active:false});
        const worn=equipment.subjoins?.find(s=>s.actor===accessory.actor && s.pos===accessory.pos);
        const removing=!!item && worn?.itemId===item.id;
        label(nodes,5859,catalog.accessoryActions[removing?1:0]);
        edit(nodes,3296,{active:!!item,itemId:item?.id,action:()=>{
          accessory.pending=removing ? -1 : item.id;
          command("original-menu:"+JSON.stringify({id:786483,fields:{actor:accessory.actor,pos:accessory.pos,subjoinid:accessory.pending}}));
        }});
      }
      const detail=!item?0:item.fusion?1233:item.subType===24?12:item.group===2?1298:item.group===3?6500:
        ({11:3038,12:3038,50:257,21:4273,22:4273}[item.equipPos]||6301);
      if(detail) {
        if(printedItem?.id!==item.id)printedItem={id:item.id,clock:{}};
        edit(nodes,detail,{active:true});
        const map=new Map(nodes.map(n=>[n.id,n]));
        function under(n,pred) {
          if(!n)return false;
          return pred(n) || under(map.get(n.parent),pred);
        }
        const subtree=nodes.filter(n=>n.id!==detail && under(n,x=>x.id===detail));
        const display=subtree.find(n=>n.parent===detail && n.name==="Display");
        const binding=map.get(detail).detailArt;
        const art=binding ? map.get(binding.image) : map.get(({12:5103,257:6436,1233:2901,4273:2777,6301:4287})[detail]) ||
          display && subtree.find(n=>n.widget?.kind==="UITexture" && under(n,x=>x.id===display.id));
        const info=({12:1515,257:8975,1233:7194,1298:743,3038:3413,4273:2557,6301:1489,6500:7105})[detail];
        label(nodes,info,detail===4273?item.name:item.info);
        map.get(info).widget.printClock=printedItem.clock;
        if(item.missingDepotDetail) {
          // DepotArmorDetail.Render stops before loading an icon when GameData.GetArmor returns null.
          for(const n of subtree.filter(n=>n.parent===detail))edit(nodes,n.id,{active:n.id===binding.info});
          return;
        }
        if(art) {
          edit(nodes,art.id,{active:!!item.icon});picture(nodes,art.id,item.icon);
          if(item.icon && [12,1233,6301].includes(detail))
            edit(nodes,art.id,{s:[312,132],sequence:{name:"depot-detail",clock:printedItem.clock,delay:0,duration:500,
              frames:[{transform:"scale("+(.1/312)+","+(.1/132)+")"},{transform:"scale(1)"}]}});
        }
        showStars(binding ? map.get(binding.stars) : subtree.find(n=>n.EquipLevel && n.parent===display?.id),item.star);
        if(item.subType===24) {
          for(const [index,pair] of [[3546,864],[1945,4536],[5304,4908],[7794,8644]].entries()) {
            const prop=item.accessoryProps?.[index];
            label(nodes,pair[0],prop?.[0]);label(nodes,pair[1],prop?.[1]);
          }
        }
        const withBonus=(value,bonus)=>String(value)+(bonus>=0?"+":"")+bonus;
        function bioMarks(parent,count) {
          for(const mark of subtree.filter(n=>n.parent===parent && /^Icon\d+$/.test(n.name)))
            edit(nodes,mark.id,{active:Number(mark.name.slice(4))<=count});
          if(parent!==3205 && !count) {
            // These two panels have the same eight sockets, but lack the gun's serialized zero caption.
            const note=map.get(6952);
            nodes.push({...note,id:"bio-none-"+parent,parent,active:true,widget:{...note.widget,text:catalog.noBioDamage}});
          }
        }
        if(detail===257 && item.meleeStats) {
          const v=item.meleeStats;
          for(const [id,key] of [[4856,"damageBar"],[2094,"atkSpeedBar"],[1244,"rangeBar"],[4636,"heroDamageBar"]])label(nodes,id,v[key]);
          bioMarks(396,v.bioBar);
        } else if(detail===1298 && item.armorStats) {
          const v=item.armorStats;
          // equipment.get_package returns item_durability(iid), the APK's full current durability.
          for(const [id,key] of [[6269,"bulletProtectionBar"],[8484,"blastProtectionBar"],[6031,"ArmorBar"],[3104,"speedBar"]])
            label(nodes,id,withBonus(v[key],v[key+"Addend"]));
        } else if(detail===6500 && item.grenadeStats) {
          const v=item.grenadeStats;
          label(nodes,5329,v.bar);label(nodes,7829,v.impactRangeBar);bioMarks(3208,v.bioBar);
          edit(nodes,3628,{active:false}); // The APK Grenade table has no PvE damage bar.
        } else if(detail===4273 && item.ammoStats) {
          const v=item.ammoStats;
          label(nodes,704,v.damagePlusBar);label(nodes,7834,v.penetrationPlusBar);label(nodes,8390,v.rangePlusBar);
        } else if(detail===1233) {
          // PieceDetail.OnCheck resolves Fusion.itemId before Judger.ShowPromote opens this exact Part.
          edit(nodes,5339,{action:async()=>{
            const upgrade=await data("upgrade-data");
            const part=upgrade.parts.find(row=>row.id===item.fusion[0][0]);
            if(part)qmqzUpgrade.item(part,go,"DepotWindow");else api.notify(479);
          }});
          const unowned=item.fusion.find(([id])=>{
            const target=byId.get(id);
            return target && !owned.some(it=>it.finalVariantId && it.modelType===target.modelType);
          });
          const save=unowned && await qmqzReadPosterRole(state.profile.roleid);
          const count=Number(save?.counts[item.id]??1),need=unowned?.[1];
          label(nodes,893,unowned?text[657].replace(/\{(\d)\}/g,(_,i)=>[need,count,need-count][i]):text[658]);
          map.get(893).widget.printClock=printedItem.clock;
        }
        const stats=item.stats;
        if(stats) {
          for (const [id,key] of [[2789,"damageBar"],[2714,"shootSpeedBar"],[1304,"DistributionBar"],[4146,"cameraJumpBar"],[8324,"rangeBar"],[4302,"runBar"],[8038,"penetrationBar"]])
            label(nodes,id,withBonus(stats[key],stats[key+"Addend"]));
          const save=await qmqzReadPosterRole(state.profile.roleid);
          label(nodes,5865,withBonus(stats.heroBasicDamageBar,stats.heroDamageAddendBar*(save.progress[item.id]||0)));
          label(nodes,1715,stats.clip+"/"+(stats.ammo-stats.clip));
          edit(nodes,5553,{active:!!stats.spSkill});label(nodes,1316,stats.spSkill);
          bioMarks(3205,stats.bioBar);
          edit(nodes,6952,{active:stats.bioBar<1});
          label(nodes,6952,catalog.noBioDamage);
        }
        for(const n of subtree.filter(n=>n.parent===detail && n.name==="Repair")) edit(nodes,n.id,{active:false});
      }
    }
  }
  window.qmqzInventory={begin,display,scroll,offset,setOffset,highlight,openAccessory};
})();
