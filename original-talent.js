// Native TalentWindow, TalentDlg, EquipTalentLayer and TalentResetDlg.
(() => {
  "use strict";
  let tree=1, chosen=null, offset=0, benefitOffset=0, limit=0, scrollPanel="", working=false;
  const sum=map=>Object.values(map).reduce((a,b)=>a+Number(b),0);
  function open(profile,go,notify) {
    if(!profile)return;
    if(profile.level<5){notify(387,["天赋",5]);return;}
    chosen=null;offset=0;benefitOffset=0;scrollPanel="";go("TalentWindow");
  }
  function changeDialog(which,name,h) {
    tree=which;chosen=null;offset=0;scrollPanel="";h.openDialog(name);
  }
  async function send(id,fields,h) {
    if(working)return false;
    working=true;
    try {await qmqzProfileCommand("menu",JSON.stringify({id,fields}));return true;}
    finally {working=false;h.render();}
  }
  async function modal(name,root,nodes,h) {
    const existing=new Set(nodes.map(n=>n.id));
    const add=(await h.data(name)).filter(n=>!existing.has(n.id)).map(n=>({...n,overlay:true}));
    h.edit(add,root,{active:true});nodes.push(...add);
    if(name==="GoRecharge")return;
    const dim=(await h.data("UIDimmer")).filter(n=>!nodes.some(x=>x.id===n.id)).map(n=>({...n,overlay:true}));
    h.edit(dim,8896,{modalBackground:true});nodes.push(...dim);
  }
  function available(profile,save,which) {
    return which===1?Math.max(0,profile.level-1-sum(save.talents)):save.researchPoints;
  }
  async function list(nodes,profile,save,data,fields,text,h) {
    const general=tree===1,name=general?"TalentDialog":"ResearchTalent",root=general?5128:179;
    const cfg=general?fields.TalentDlg[root]:fields.ResearchTalentDlg[root], vals=general?save.talents:save.researchTalents;
    const rows=data[general?"Talent":"ResearchTalent"],cols=general?3:4,rowHeight=general?98:112;
    const levels=sum(vals), points=available(profile,save,tree), selection=rows.find(r=>r.id===chosen);
    await modal(name,root,nodes,h);
    h.edit(nodes,cfg.btnClose,{action:h.closeDialog});
    h.label(nodes,cfg.totalPoints,general?Math.min(points,60-levels):points);
    h.label(nodes,cfg.talentName,selection?.name||"");h.label(nodes,cfg.talentDesc,selection?.info||"");
    const source=await h.data(general?"TalentLayerItem":"EquipTalentLayer");
    const grid=general?7347:3089,panel=general?4178:1839;
    scrollPanel=String(panel);limit=Math.max(0,Math.ceil(rows.length/cols)*rowHeight-h.nodeById(nodes,panel).clip[3]);
    const g=h.nodeById(nodes,grid);g.p=[g.p[0],g.p[1]+Math.min(offset,limit)];
    const slotIds=general?[1104,1417,1445]:[1345,1486,1529,1554];
    const icons=general?[1346,1176,1384]:[1383,1467,1518,1548],labels=general?[1468,1519,1025]:[1416,1444,1503,1539];
    h.edit(nodes,cfg.highLight,{active:false});
    for(let i=0;i<rows.length;i+=cols) {
      const prefix="talent-layer-"+i+"-", row=rows.slice(i,i+cols), locked=levels<row[0].unlockPoints;
      const copy=h.clonePrefab(source,prefix,grid,0,{}, {p:general?[0,-i/cols*rowHeight]:[265,-70.5-i/cols*rowHeight],overlay:true});
      h.edit(copy,prefix+(general?1504:1244),{active:locked});
      h.label(copy,prefix+(general?1300:1024),locked?text[357].replace("{0}",row[0].unlockPoints):"");
      row.forEach((r,col)=>{
        const id=prefix+slotIds[col];
        h.edit(copy,prefix+labels[col],{active:!locked});h.picture(copy,prefix+icons[col],r.image);h.label(copy,prefix+labels[col],(vals[r.id]||0)+"/"+r.maxLevel);
        if(!locked)h.edit(copy,id,{action:()=>{chosen=r.id;h.render();},label:r.name+" "+r.id});
        if(chosen===r.id) {
          const mark=h.nodeById(nodes,cfg.highLight);
          nodes.push({...mark,id:"talent-selected",parent:id,active:true,p:[0,0],overlay:true});
        }
      });
      nodes.push(...copy);
    }
    h.edit(nodes,cfg.btnAddPoint,{action:async()=>{
      if(working)return;
      if(points<1){h.notify(353);return;}
      if(!selection){h.notify(354);return;}
      if((vals[chosen]||0)>=selection.maxLevel){h.notify(355,selection.name);return;}
      await send(general?2686980:2686982,{talentid:chosen},h);
    }});
  }
  function benefits(nodes,save,data,fields,text,h) {
    const keys=["addHp","addTime","addDmg","lifeDrain","pistolrange","meleerange"];
    const concepts=[20,21,22,23,97,98,123],messages=[396,397,398,399,607,608,24];
    for(const card of nodes.filter(n=>n.parent===757))card.p=[card.p[0],card.p[1]+benefitOffset];
    function shade(root,enabled) {
      if(enabled)return;
      for(const n of nodes.filter(n=>n.parent===+root&&n.widget)) {
        const c=n.widget.color||[255,255,255,255];n.widget={...n.widget,color:[128,128,128,c[3]]};
      }
    }
    for(const [root,v] of Object.entries(fields.CardAddition)) {
      const now=Date.now()/1000;
      const active=data.Card.filter(c=>c.id>=v.cardid_from&&c.id<=v.cardid_end&&save.cardUntil[c.id]>now).at(-1);
      h.label(nodes,v.gold,"+"+(active?.addGold||0)+"%");h.label(nodes,v.exp,"+"+(active?.addExp||0)+"%");
      shade(root,active);
    }
    for(const [root,v] of Object.entries(fields.ChipAddition)) {
      const amount=v.type===6 ? Number(save.gifts.includes(11)) :
        save.gifts.reduce((n,id)=>n+Number(data.Gift.find(r=>r.id===id)?.[keys[v.type]]||0),0);
      h.label(nodes,v.chipName,data.Concept[concepts[v.type]]);
      const message=v.type===6?data.Concept[24]:text[messages[v.type]];
      h.label(nodes,v.chipInfo,message.replace("{0}",v.type===1?amount*20:amount));
      shade(root,amount>0);
    }
    const vertices=Array.from({length:6},(_,i)=>{
      const rows=data.Talent.filter(r=>r.type===i+1);
      const max=rows.reduce((n,r)=>n+r.maxLevel*r.perLevel,0);
      const value=rows.reduce((n,r)=>n+(save.talents[r.id]||0)*r.perLevel,0);
      const radius=.3+.7*(max?value/max:0),angle=(120+60*i)*Math.PI/180;
      return [Math.cos(angle)*radius,Math.sin(angle)*radius];
    });
    h.edit(nodes,3207,{p:[.5,0],z:-1,s:[188,188],widget:{kind:"TalentGraph",pivot:4,color:[255,255,255,255],depth:1,vertices}});
  }
  async function display(nodes,profile,h) {
    const [save,data,fields,text]=await Promise.all([qmqzReadPosterRole(profile.roleid),h.data("talent-data"),h.data("talent-fields"),h.data("strings")]);
    if(!save)return;
    benefits(nodes,save,data,fields,text,h);
    h.edit(nodes,2684,{action:()=>h.go("MainUI")});
    for(const [i,items,map,ids,key] of [[1,data.Talent,save.talents,[8379,1141,1094],"TalentIncome"],[2,data.ResearchTalent,save.researchTalents,[1497,4297,1902],"ResearchIncome"]]) {
      const [amount,add,reset]=ids;
      h.label(nodes,amount,text[359].replace("{0}",available(profile,save,i)));
      h.edit(nodes,add,{action:()=>changeDialog(i,i===1?"TalentDialog":"ResearchTalent",h)});
      h.edit(nodes,reset,{action:()=>changeDialog(i,"ResetTalent",h)});
      for(const [node,component] of Object.entries(fields[key])) {
        const same=items.filter(r=>r.type===component.type);
        if(!same.length)continue;
        const value=same.reduce((a,r)=>a+(map[r.id]||0)*(i===1?1:r.perLevel),0);
        const target=nodes.find(n=>n.parent===+node&&n.name==="Value");
        if(target)h.label(nodes,target.id,same[0].name+"+"+value);
        const slider=nodes.find(n=>n.parent===+node&&n.UISlider);
        if(slider){
          const fg=h.nodeById(nodes,slider.UISlider.foreground);
          const total=same.reduce((a,r)=>a+r.maxLevel*r.perLevel,0);
          const income=same.reduce((a,r)=>a+(map[r.id]||0)*r.perLevel,0);
          if(fg)h.edit(nodes,fg.id,{active:income>0,s:[fg.s[0]*income/total,fg.s[1]]});
        }
      }
    }
    h.edit(nodes,4837,{action:()=>qmqzUpgrade.open(h.go,"TalentWindow")});
    scrollPanel=h.dialog?"":"757";
    if(h.dialog==="TalentDialog"||h.dialog==="ResearchTalent")return list(nodes,profile,save,data,fields,text,h);
    if(h.dialog==="ResetTalent") {
      await modal("ResetTalent",2191,nodes,h);
      const price=data.Price.find(r=>r.id===9+tree);
      h.label(nodes,7964,text[409].replace("{0}",price.note).replace("{1}",price.gem));
      h.edit(nodes,3280,{action:h.closeDialog});
      h.edit(nodes,936,{action:async()=>{
        if(working)return;
        if(profile.gold<price.gem){h.openDialog("GoRecharge");return;}
        if(await send(2686984,{talenttype:tree},h))h.closeDialog();
      }});
    } else if(h.dialog==="GoRecharge") {
      await modal("GoRecharge",8813,nodes,h);h.label(nodes,2446,text[212]);
      h.edit(nodes,8079,{action:h.closeDialog});h.edit(nodes,3278,{action:()=>qmqzStore.recharge(h.go,"TalentWindow")});
    }
  }
  window.qmqzTalent={open,display,panel:id=>scrollPanel===id,offset:()=>scrollPanel==="757"?benefitOffset:offset,scroll:n=>{
    if(scrollPanel==="757")benefitOffset=Math.max(0,Math.min(60,n));
    else offset=Math.max(0,Math.min(limit,n));
  }};
})();
