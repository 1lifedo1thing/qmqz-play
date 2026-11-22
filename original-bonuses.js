(() => {
  "use strict";
  const request=(fields)=>window.qmqzProfileCommand("menu",JSON.stringify(fields));
  const claim=(id,fields={},expectedReward)=>request({id,fields,expectedReward});
  let tab="tasks", offset=0, maximum=0, timer=0, online=null, collected=[], progress={}, receipt=null, daily=null;
  let busy=false, calendarOffset=0, calendarMaximum=0, taskRows=[];
  const scopes=["gemReward","honorReward","goldReward","expReward","pointReward"];
  const roleFields=["gem","honor","gold","exp","point"];
  function open(go) {
    tab="tasks"; offset=0; receipt=null;
    go("PrizeWindow");request({view:"bonuses"});
  }
  function protocol({id,fields},view,render,openDialog) {
    if(id===1114137)online={id:fields.rewardid,until:Date.now()+fields.remaintime*1000};
    else if(id===1114133)daily=fields;
    else if(id===2686986)progress=fields.tasks;
    else if(id===2686987)progress={...progress,[fields.taskid]:fields.taskvalue};
    else if(id===2686989) {
      const row=taskRows.find(r=>r.id===fields.taskid), previous=progress[fields.taskid];
      progress={...progress,[fields.taskid]:-1};
      if(row && previous>=row.times && view==="PrizeWindow") {
        receipt=Object.fromEntries(scopes.map((key,i)=>[roleFields[i],row[key]]));
        openDialog("GetPrize");return;
      }
    }
    else if(id===1114136 && fields.result===1 && view==="PrizeWindow") {
      receipt={gold:fields.gold,honor:fields.bloodgem,exp:fields.exp};
      openDialog("GetPrize");return;
    } else return;
    if(view==="PrizeWindow")render();
  }
  window.addEventListener("qmqz-online-collected",e=>{collected=e.detail;});
  function switchTab(name,render) {
    tab=name;offset=0;render();request({view:"bonuses"});
  }
  function order(a,b) {
    const x=progress[a.id]||0,y=progress[b.id]||0;
    const rank=(v,t)=>v<0?2:v>=t?0:1;
    return rank(x,a.times)-rank(y,b.times) || (rank(x,a.times)===1?y*a.times-x*b.times:0);
  }
  function countdown(seconds) {
    if(!seconds)return "--:--";
    const two=n=>String(n).padStart(2,"0");
    const hours=Math.floor(seconds/3600);
    return (hours?two(hours)+":":"")+two(Math.floor(seconds/60)%60)+":"+two(seconds%60);
  }
  async function display(nodes,profile,h) {
    const {data,edit,label,picture,nodeById,render,clonePrefab,go,openDialog,closeDialog,dialog}=h;
    clearTimeout(timer);
    const cfg=await data("bonus-rewards"), showOnline=tab==="online";
    edit(nodes,887,{active:!showOnline});edit(nodes,5170,{active:showOnline});edit(nodes,8629,{active:false});
    edit(nodes,1531,{action:()=>switchTab("online",render)});edit(nodes,6376,{action:()=>switchTab("tasks",render)});
    for(const [id,selected] of [[1531,showOnline],[6376,!showOnline]]) {
      const n=nodeById(nodes,id);if(selected && n.held) picture(nodes,n.held.target,n.held.widget.image);
    }
    const template=await data("TasklistItem"), icons=nodeById(template,1572).widget.rewardImages;
    if(!showOnline) {
      taskRows=cfg.tasks;const tasks=[...cfg.tasks].sort(order);
      maximum=Math.max(0,tasks.length*100-450);
      tasks.forEach((row,i)=>{
        const p=progress[row.id]||0,earned=p>=row.times, pre="daily"+row.id+"-";
        const result=p<0?"":(earned?"[ffc040]":"[00ff00]")+"("+Math.min(p,row.times)+"/"+row.times+")[-]";
        const rowNodes=clonePrefab(template,pre,7562,offset-100*i,{1573:row.name,1246:row.description,1418:result});
        picture(rowNodes,pre+1568,row.image);
        edit(rowNodes,pre+1446,{active:p<0});
        edit(rowNodes,pre+1026,{active:p>=0&&!earned,label:row.name+"，进行",action:row.window?()=>go(row.window):row.form==="SlotForm"?()=>qmqzUpgrade.maker(h):null});
        edit(rowNodes,pre+1505,{active:earned,label:row.name+"，领奖",action:()=>claim(2686988,{taskid:row.id})});
        const rewards=scopes.filter(k=>row[k]>0);
        [[1566,1572,1570],[1562,1555,1559],[1549,1347,1301]].forEach(([holder,icon,count],j)=>{
          const key=rewards[j];edit(rowNodes,pre+holder,{active:!!key});
          if(key){picture(rowNodes,pre+icon,icons[key]);label(rowNodes,pre+count,"x"+row[key]);}
        });
        nodes.push(...rowNodes);
      });
    } else {
      const row=cfg.online.find(v=>v.id===online?.id);
      const done=collected.includes(online?.id), sec=Math.max(0,Math.ceil(((online?.until||0)-Date.now())/1000));
      label(nodes,4512,done?0:row?.exp);label(nodes,8289,done?0:row?.gold);label(nodes,1586,done?0:row?.bloodGem);
      label(nodes,2582,countdown(sec));
      const button=nodeById(nodes,6270);
      const eligible=!!row&&!done&&!sec&&!busy;
      if(!eligible)button.widget={...button.widget,color:[128,128,128,255]};
      edit(nodes,6315,{action:eligible?async()=>{
        if(busy)return;busy=true;render();
        try { await claim(1114135,{},row.id); } finally {busy=false;render();}
      }:null});
      if(sec && !dialog)timer=setTimeout(()=>{if(document.querySelector("#original-menu")?.dataset.screen==="PrizeWindow")render();},1000);
      if(daily) {
        // The local APK service keeps accumulating days. After day 30 it cycles the stable day-sorted table.
        const rewards=[...cfg.login].sort((a,b)=>a.day-b.day);
        const next=rewards.find(v=>v.day===daily.accday+1) || rewards[daily.accday%rewards.length];
        const strings=await data("strings");
        label(nodes,1264,strings[daily.rewarded?433:434]);label(nodes,25,strings[daily.rewarded?372:371]);
        edit(nodes,4737,{action:()=>{
          calendarOffset=Math.max(0,Math.min(27,daily.accday+(daily.rewarded?0:1)-2))*150;
          openDialog("DailyPrizes");
        }});
        if(next) {
          edit(nodes,1949,{active:!!next.rewardItem});edit(nodes,5191,{active:!next.rewardItem});
          if(next.rewardItem){
            label(nodes,7087,next.name);picture(nodes,2916,next.image);
            // OnlinePrizePanel.itemTexture is its own draw call. In the flat menu it must follow the card's Pattern.
            const icon=nodeById(nodes,2916),pattern=nodeById(nodes,603);
            icon.widget={...icon.widget,depth:pattern.widget.depth+1};
          }
          else {
            const currency=next.blueGem?"gemReward":next.bloodGem?"honorReward":"goldReward";
            picture(nodes,920,icons[currency]);label(nodes,5524,next.blueGem||next.bloodGem||next.gold);
          }
        }
      }
    }
    if(["SlotForm","10TimesResearch","OddsTable"].includes(dialog))await qmqzUpgrade.displaySlot(nodes,profile,h);
    if(dialog==="DailyPrizes" && daily) {
      const [scene,rows,cell,strings]=await Promise.all([data("DailyPrizes"),data("DailyPrizesListItem"),data("DailyPrizeItem"),data("strings")]);
      const overlay=scene.filter(n=>!nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
      edit(overlay,8860,{active:true});edit(overlay,1672,{action:closeDialog});nodes.push(...overlay);
      // GameData.dailyType defaults to 0. Its first 30-day table is the one in use.
      const rewards=cfg.login.slice(0,30), today=daily.accday+(daily.rewarded?0:1);
      const clip=nodeById(overlay,1529).clip;
      calendarMaximum=Math.max(0,rewards.length*150-clip[3]);
      rewards.forEach((row,i)=>{
        const pos=[40.83+(i%5)*81.64,-34.208-Math.floor(i/5)*69.4], tile="calendar"+row.day+"-";
        const date=clonePrefab(cell,tile,1123,0,{1476:row.day,989:row.day,1221:row.day},{p:pos,action:()=>{
          calendarOffset=Math.max(0,Math.min(27,row.day-2))*150;render();
        }});
        edit(date,tile+1402,{active:!!row.rewardItem});edit(date,tile+1151,{active:!!row.blueGem});
        edit(date,tile+1456,{active:!row.rewardItem&&!row.blueGem});
        for(const id of [1278,1494,1367])edit(date,tile+id,{active:row.day<=daily.accday});
        nodes.push(...date);
        const prefix="signin"+row.day+"-", isToday=row.day===today && !daily.rewarded, item=!!row.rewardItem;
        const cloned=clonePrefab(rows,prefix,7547,calendarOffset-i*150,{
          1561:strings[407].replace("{0}",row.day),1459:strings[408].replace("{0}",row.day),
          1332:row.time>0?strings[435].replace("{0}",row.name).replace("{1}",Math.floor(row.time/86400)+"天"):row.name,1082:row.blueGem||row.bloodGem||row.gold
        });
        edit(cloned,prefix+1536,{active:isToday,action:()=>claim(1114131)});
        edit(cloned,prefix+1496,{active:row.day>today});edit(cloned,prefix+1544,{active:row.day<=daily.accday});
        edit(cloned,prefix+1436,{active:item});edit(cloned,prefix+1283,{active:!item});
        picture(cloned,prefix+1405,row.image);picture(cloned,prefix+1157,icons[row.blueGem?"gemReward":row.bloodGem?"honorReward":"goldReward"]);
        nodes.push(...cloned);
      });
    }
    if(dialog==="GetPrize" && receipt) {
      const overlay=(await data("GetPrize")).filter(n=>!nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
      const row=await data("OnlinePrizeItem");
      edit(overlay,8597,{active:true});edit(overlay,2698,{action:closeDialog});nodes.push(...overlay);
      const nonzero=roleFields.filter(k=>receipt[k]>0);
      edit(overlay,6117,{p:[(1-nonzero.length)*50,0]});
      nonzero.forEach((k,i)=>{
        const prefix="won"+k+"-", col=clonePrefab(row,prefix,2755,0,{}, {p:[i*100,0]});
        const icon=col.find(n=>n.name==="Icon"), val=col.find(n=>n.widget?.kind==="UILabel");
        if(icon)picture(col,icon.id,icons[scopes[roleFields.indexOf(k)]]);
        if(val)label(col,val.id,receipt[k]);nodes.push(...col);
      });
    }
  }
  window.qmqzBonuses={open,display,protocol,offset:calendar=>calendar?calendarOffset:offset,setOffset:(v,calendar)=>{if(calendar)calendarOffset=Math.max(0,Math.min(calendarMaximum,v));else offset=Math.max(0,Math.min(maximum,v));}};
})();
