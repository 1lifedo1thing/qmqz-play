(() => {
  "use strict";
  let item=null,clock={},source="StoreWindow",parentDialog="";
  const branches={
    gun:[3434,5455,5966,0],knife:[589,6153,3774,2947],armor:[7617,4298,5036,631],
    grenade:[3270,1220,1624,6899],ammo:[7227,3272,4923,8633],
    accessory:[4314,6748,5257,3611],thing:[3973,941,3550,2683]
  };
  function type(v) {
    if(v.group===2)return "armor";
    if(v.group===3)return "grenade";
    if(v.group===4)return [21,22].includes(v.equipPos)?"ammo":v.subType===24?"accessory":"thing";
    return v.equipPos===50?"knife":"gun";
  }
  function origin(screen,back=""){source=screen;parentDialog=back;}
  function open(selected,openDialog,screen="StoreWindow",back=""){
    origin(screen,back);item=selected;clock={};openDialog("StoreItemDetails");
  }
  function previous(){return parentDialog;}
  function returnRoute(h){
    const page=source,dialog=parentDialog;
    return ()=>{h.go(page);if(dialog)h.openDialog(dialog);};
  }
  function stars(nodes,h,root,stamp,value,n) {
    h.edit(nodes,root,{active:n>0});
    if(!n)return;
    const mark=h.nodeById(nodes,stamp);
    const color=n<4?"Brozen":n<7?"Silver":n<10?"Golden":"Legend";
    h.picture(nodes,stamp,mark.widget.image.replace("Brozen",color));
    h.label(nodes,value,n>=10?n-9:n);
  }
  async function display(nodes,state,h) {
    if(!item)return;
    const kind=type(item),[branch,title,art,info]=branches[kind],{edit,label,picture,nodeById}=h;
    edit(nodes,2274,{active:true});edit(nodes,1334,{active:true});edit(nodes,8049,{active:false});
    for(const [id] of Object.values(branches))edit(nodes,id,{active:id===branch});
    label(nodes,title,item.name);
    const desc=item.info||item.detail||"";
    if(info){label(nodes,info,desc);nodeById(nodes,info).widget.printClock=clock;}
    // GunDetail.info is null on this particular prefab. Use its free space between the thumbnail and the two buttons.
    if(!info && desc) {
      const sample=nodeById(nodes,2947);
      const expanded=!!clock.description;
      nodes.push({...sample,id:"store-description",parent:branch,p:[175,expanded?12:-119],s:[17,17],z:-3,
        widget:{...sample.widget,pivot:4,maxWidth:370,maxLines:0,text:expanded?desc:"查看说明"},
        name:"Description",label:expanded?"收起说明":"查看说明",hit:[0,0,20,expanded?10:1.7],
        action:()=>{clock.description=!expanded;h.redraw();}});
      if(expanded)edit(nodes,art,{active:false});
    }
    picture(nodes,art,item.icon);
    edit(nodes,2268,{active:false});
    // Each Render coroutine except KnifeDetail grows its UITexture from localScale 0.1 to DepotWindow.textureScale.
    if(kind!=="knife")edit(nodes,art,{sequence:{name:"store-item-image",clock,delay:0,duration:500,
      frames:[{transform:"scale("+(0.1/312)+","+(0.1/132)+")"},{transform:"scale(1)"}]}});
    const params=(v,entries)=>{if(v)for(const [id,field] of entries)label(nodes,id,v[field]);};
    // GunDetail and ArmorDetail use Util.GetLeveldStr(base, addend, false, true), which displays the sum.
    const total=(base,addend)=>base+(addend||0);
    const graded=(v,entries)=>{if(v)for(const [id,key] of entries)label(nodes,id,total(v[key],v[key+"Addend"]));};
    function bio(id,value) {
      for(const mark of nodes.filter(n=>n.parent===id && /^Icon\d+$/.test(n.name)))
        edit(nodes,mark.id,{active:Number(mark.name.slice(4))<=value});
      const note=nodes.find(n=>n.parent===id && n.name==="Note");
      if(note){edit(nodes,note.id,{active:!value});label(nodes,note.id,h.catalog.noBioDamage);}
    }
    switch(kind) {
      case "gun": {
        const v=item.stats;
        if(!v)break;
        graded(v,[[836,"damageBar"],[5252,"shootSpeedBar"],[8638,"DistributionBar"],[5983,"cameraJumpBar"],[3150,"runBar"],[2327,"rangeBar"],[7735,"penetrationBar"]]);
        label(nodes,3935,v.clip+"/"+(v.ammo-v.clip));bio(8443,v.bioBar);
        const save=await qmqzReadPosterRole(state.profile.roleid);
        label(nodes,5772,total(v.heroBasicDamageBar,v.heroDamageAddendBar*(save.progress[item.id]||0)));
        edit(nodes,2214,{active:!!v.spSkill});label(nodes,3852,v.spSkill);break;
      }
      case "knife":params(item.meleeStats,[[3269,"damageBar"],[4021,"atkSpeedBar"],[8143,"rangeBar"],[6457,"heroDamageBar"]]);bio(6994,item.meleeStats?.bioBar);break;
      case "armor":graded(item.armorStats,[[8881,"bulletProtectionBar"],[8162,"blastProtectionBar"],[4258,"ArmorBar"],[3091,"speedBar"]]);break;
      case "grenade":params(item.grenadeStats,[[1502,"bar"],[5446,"impactRangeBar"]]);bio(873,item.grenadeStats?.bioBar);break;
      case "ammo":params(item.ammoStats,[[2882,"damagePlusBar"],[4732,"penetrationPlusBar"],[7995,"rangePlusBar"]]);break;
      case "accessory":
        [[7338,7336],[8534,4882],[3484,5691],[2815,8918]].forEach(([key,value],i)=>{
          const pair=item.accessoryProps?.[i]||[];label(nodes,key,pair[0]);label(nodes,value,pair[1]);
        });break;
    }
    stars(nodes,h,4548,7184,5049,item.star);
    if(kind==="accessory")stars(nodes,h,2344,2899,3568,item.star);
    edit(nodes,2879,{action:h.closeDialog});
    edit(nodes,6838,{label:"预览物品",action:()=>{
      if(!["gun","knife","accessory"].includes(kind)){h.notify(667);return;}
      qmqzExhibition.shopItem(item,h.catalog,state.profile.equipment,h,returnRoute(h));
    }});
    edit(nodes,6322,{label:"查看强化",action:async()=>{
      const part=(await h.data("upgrade-data")).parts.find(p=>p.id===item.id);
      if(!part){h.notify(479);return;}
      qmqzUpgrade.item(part,h.go,returnRoute(h));
    }});
  }
  window.qmqzStoreItems={open,display,origin,previous};
})();
