(() => {
  "use strict";
  let selected,groups=1,pending;
  window.addEventListener("qmqz-state",({detail})=>{if(detail.storageError)pending=null;});

  async function display(nodes,slots,items,equipment,h) {
    const offers=await h.data("ammo-shop");
    for(const [position,root,name,count,icon] of [[11,5397,3678,4031,6754],[12,6975,5270,3623,7476]]) {
      const slot=slots.find(s=>s.position===position);
      const gun=items.get(slot?.itemId)||items.get(slot?.effectiveItemId);
      const ammo=items.get(gun?.vipAmmo),offer=offers.find(o=>o.id===ammo?.id);
      const stock=equipment.paidAmmo?.find(a=>a.id===ammo?.id)?.count||0;
      h.label(nodes,name,ammo?.name);h.label(nodes,count,ammo?stock:"");
      h.edit(nodes,icon,{active:!!ammo});h.picture(nodes,icon,ammo?.icon);
      if(offer)h.edit(nodes,root,{label:ammo.name+"，库存 "+stock+"，购买",action:()=>{
        selected=ammo.id;groups=1;h.openDialog("BulletPurchase");
      }});
    }
    if(h.dialog!=="BulletPurchase")return;
    const item=items.get(selected),offer=offers.find(o=>o.id===selected);
    if(!offer||!item)return;
    const overlay=(await h.data("BulletPurchase")).filter(n=>!h.nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
    const edit=(id,fields)=>h.edit(overlay,id,fields);
    edit(3514,{active:true});edit(5752,{action:h.closeDialog});
    h.picture(overlay,1000,item.icon);h.label(overlay,1731,item.name);h.label(overlay,3540,item.info);
    const pack=(offer.gold||offer.honor).subCount;
    h.label(overlay,340,groups*pack+"/"+100*pack);
    const step=delta=>{groups=Math.max(1,Math.min(100,groups+delta));h.render();};
    edit(2972,{label:"增加一组",action:()=>step(1)});edit(2148,{label:"减少一组",action:()=>step(-1)});
    edit(4240,{active:!!offer.gold});edit(4582,{active:!offer.gold});
    function button(shop,priceId,buyId) {
      edit(buyId,{active:!!shop});
      if(!shop)return;
      const [currency,unit]=qmqzStore.priceOf(shop), total=unit*groups;
      h.label(overlay,priceId,total);
      const unitName={gem:"钻石",gold:"金币",bloodGem:"荣誉"}[currency];
      edit(buyId,{label:"用 "+total+" "+unitName+" 购买 "+groups*pack+" 发",action:()=>{
        if(pending)return;
        pending=shop.id;
        h.command("original-menu:"+JSON.stringify({id:1048577,fields:{id:shop.id,count:groups}}));
      }});
    }
    button(offer.honor,offer.gold?559:5403,offer.gold?7883:2482);
    button(offer.gold,1837,8299);
    nodes.push(...overlay);
  }
  function protocol(detail,view,dialog,close,notify) {
    if(!pending||detail.id!==1048578||detail.fields.id!==pending)return;
    pending=null;
    if(view!=="EquipWindow"||dialog!=="BulletPurchase")return;
    if(detail.fields.retcode===0)close();
    notify(detail.fields.retcode===0?4:5);
  }
  window.qmqzAmmoShop={display,protocol};
})();
