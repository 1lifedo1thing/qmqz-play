// PVE_Panel contains two native six-cell carousel pages. Reuse its original colliders, labels and textures.
window.qmqzChallengePreparation=(()=>{
  let page=0, currentRoom=null;
  window.addEventListener("qmqz-state",({detail})=>{
    if(detail.window!=="RoomWindow" || detail.mode==="match"){currentRoom=null;page=0;}
  });
  async function display(nodes,state,{data,edit,label,picture,command,render,notify}){
    const room=state.room,role=state.profile;
    if(currentRoom!==room.roomId){currentRoom=room.roomId;page=0;}
    const [props,text,owner]=await Promise.all([data("challenge-preparation"),data("strings"),qmqzReadChallengeRoom(role.roleid)]);
    const at=id=>nodes.find(n=>n.id===id);
    const selected=props.filter(r=>(room.challengeBuffs||[]).includes(r.Id));
    function toggle(row){
      if(!selected.includes(row)){
        for(const [cost,balance,warning] of [["gem","gold",30],["gold","money",31],["bloodGem","diamond",29]]){
          if(selected.reduce((sum,r)=>sum+r[cost],row[cost])>role[balance]){notify(warning);return;}
        }
        if(row.isTeam && selected.some(r=>r.isTeam)){notify(676);return;}
        const count=selected.filter(r=>!r.isTeam).length;
        if(!row.isTeam && count>=4){notify(705);return;}
        if(!owner.vip && count===3){notify(706);return;}
      }
      command("original-challenge-buff:"+row.Id);
    }
    edit(nodes,8248,{active:true});
    for(const [index,root] of [2828,8771].entries()){
      edit(nodes,root,{active:index===page});
      at(root).pve.cells.forEach((id,i)=>{
        const cell=at(id).pve, row=props[index*6+i], owned=selected.includes(row);
        label(nodes,cell.Name,row.name);
        picture(nodes,cell.Icon,row.icon+".png");
        if(cell.BG)picture(nodes,cell.BG,"BG_RoomItem"+(owned?"2":"")+"--2078032047.png");
        edit(nodes,cell.Owned,{active:owned});
        picture(nodes,cell.currency,row.gem?"Icon_Bluegem--2078032047.png":"Icon_gold--2078032047.png");
        label(nodes,cell.price,row.gem||row.gold||row.bloodGem);
        edit(nodes,id,{action:()=>toggle(row),label:row.name,pressed:owned});
      });
    }
    for(const arrow of [531,3938])edit(nodes,arrow,{action:()=>{page=1-page;render();}});
    const buff=at(752).pve;
    for(const [i,id] of buff.teambuff.entries()){
      const dot=at(id);
      dot.widget={...dot.widget,color:i===0 && selected.some(r=>r.isTeam)?[100,240,200,255]:[0,0,0,255]};
    }
    const personal=selected.filter(r=>!r.isTeam);
    const slots=[selected.find(r=>r.isTeam),...personal];
    [buff.teamTexture,...buff.selfTexture].forEach((id,i)=>{
      edit(nodes,id,{active:!!slots[i]});
      if(slots[i])picture(nodes,id,slots[i].icon+".png");
    });
    edit(nodes,3241,{active:!owner.vip});
    for(const [i,id] of at(7860).BattleSide.members.entries())edit(nodes,id,{active:i<room.capacity});
    label(nodes,4503,room.title); label(nodes,720,room.mapName); label(nodes,5306,room.modeName);
    if(room.mapId)picture(nodes,3009,"map-"+room.mapId+".png");
    label(nodes,6765,owner.remaining+"/3"); label(nodes,6922,"****");
    picture(nodes,7904,(room.autoAim?"ON":"OFF")+"-964777403.png");
    edit(nodes,4410,{action:room.isOwner?()=>command("original-challenge-aim"):null});
    edit(nodes,6730,{action:()=>command("original-ready")});
    label(nodes,2731,text[room.isOwner?125:124]);
    for(const [id,dir] of [[7228,"prev"],[6617,"next"]])edit(nodes,id,{active:room.isOwner,action:()=>command("original-map-"+dir)});
  }
  return {display};
})();
