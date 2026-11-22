(() => {
  "use strict";
  const modals={SocialCheer:2959,SocialCard:8609,SocialAdd:6090,SocialRequests:522,SocialBlacklist:7630,SocialChat:2860,
    SocialShortcut:3118,SocialFilter:8017,SocialEmotion:3503,SocialSpeaker:324};
  const windowNames=["SocialWindow","FriendWindow"];
  let role=0,model=null,loading=null,pending=false,selection={},channel="world",peer=0,chatBack="MainUI",redraw;
  let inspected=null,cardBack="FriendWindow",shortcutPeer=0,whisperPeers=[];
  let previousTime=-Infinity,previousText="",nextWorld=-Infinity;
  const errorText=[114,143,141,142,140,144,145];
  const offsets={},limits={};
  const scrollPanels={FriendWindow:[6119],SocialRequests:[6131],SocialBlacklist:[8176],SocialCheer:[2951],SocialChat:[1030,5009,6540],SocialFilter:[3228]};
  function scrollKey(screen,id){return scrollPanels[screen]?.includes(Number(id))?"social:"+id:"";}
  const offset=key=>Math.min(offsets[key]||0,limits[key]||0);
  function scroll(key,value){offsets[key]=Math.max(0,Math.min(value,limits[key]||0));}
  function region(nodes,screen,id,size,height){
    const key=scrollKey(screen,id);limits[key]=Math.max(0,size-height);return offset(key);
  }
  function observe(result) {
    const received=id=>result.receipts.findLast(m=>m.id===id)?.fields||{};
    model={...result,...received(917509),...received(917510),...received(917519),people:new Map(result.directory.map(r=>[r.roleid,r]))};
  }
  function load(id) {
    if(id!==role){role=id;model=null;loading=null;selection={};peer=0;whisperPeers=[];shortcutPeer=0;previousTime=-Infinity;previousText="";nextWorld=-Infinity;}
    if(!model && !loading) {
      const owner=id;
      loading=qmqzLocalSocial(id).then(result=>{if(owner===role)observe(result);}).finally(()=>{if(owner===role)loading=null;});
    }
    return loading;
  }
  window.addEventListener("qmqz-social-changed",()=>{
    const screen=document.querySelector("#original-menu")?.dataset.screen;
    model=null;
    if(modals[screen]||windowNames.includes(screen)||document.querySelector('[data-object="ChatOpen"]'))redraw?.();
  });
  async function badge(nodes,state,h){
    redraw=h.render;await load(state.profile.roleid);
    h.edit(nodes,1987,{active:!!model?.history.some(m=>m.unread)});
  }
  async function openChat(from,friend,h) {
    const id=window.qmqzLastState?.profile?.roleid;
    if(!id)return;
    model=null;await load(id);
    const unread=model?.history.findLast(m=>m.unread);
    chatBack=from;channel=friend?"friend":unread?.channel||"world";peer=friend||unread?.peer||0;h.go("SocialChat");
  }
  function parent(screen){return screen==="SocialChat"?chatBack:screen==="SocialCard"?cardBack:
    ["SocialShortcut","SocialFilter","SocialEmotion","SocialSpeaker"].includes(screen)?"SocialChat":"FriendWindow";}
  function open(screen,h){model=null;h.go(screen);}
  function field(name) {return document.querySelector('input[name="'+name+'"]');}
  async function display(screen,nodes,state,h) {
    const {edit,label,data,clonePrefab,nodeById,picture,go,render,notify,values}=h;
    redraw=render;
    await load(state.profile.roleid);
    if(!model || role!==state.profile.roleid)return;
    const me=role;
    async function send(id,fields,after) {
      if(pending || me!==role)return;
      pending=true;
      try {
        const result=await qmqzLocalSocial(me,{id,fields});
        if(me!==role)return;
        observe(result);
        const response=result.receipts.find(m=>m.id===917526);
        if(after)after(result);
        render();
        if(response)notify(errorText[response.fields.errcode]??143);
        const praise=result.receipts.find(m=>m.id===917521);
        if(praise?.fields.retcode===0)notify(112);
        if(praise?.fields.retcode===1)notify(113);
      } catch(e){notify("本地社交记录保存失败，请重试");}
      finally{pending=false;}
    }
    function inspect(id){
      if(id)send(1114158,{roleid:id},result=>{
        const reply=result.receipts.find(m=>m.id===1114159);
        if(reply){inspected=reply.fields;cardBack=screen==="SocialShortcut"?"SocialChat":screen;go("SocialCard");}
      });
    }
    const button=(id,action)=>edit(nodes,id,{action});
    const close=()=>go(parent(screen));
    async function preference(op,after){
      if(pending)return;
      pending=true;
      try{const result=await qmqzLocalSocial(me,op);if(me===role){observe(result);if(after)after();render();}}
      catch(e){notify("本地聊天设置保存失败，请重试");}
      finally{pending=false;}
    }
    function backdrop(id) {
      const bg=nodeById(nodes,id),root=nodeById(nodes,bg.parent);
      const cx=root.p[0]+bg.p[0],cy=root.p[1]+bg.p[1],w=bg.s[0],h=bg.s[1],outer=5000;
      const rects=[[cx-(outer+w)/2,cy,outer,h],[cx+(outer+w)/2,cy,outer,h],
        [cx,cy+(outer+h)/2,outer*2,outer],[cx,cy-(outer+h)/2,outer*2,outer]];
      rects.forEach(([x,y,width,height],i)=>nodes.unshift({id:"social-modal-back-"+i,parent:root.parent,name:"ChatBackdrop",
        p:[x,y],s:[1,1],z:10,active:true,overlay:true,hit:[0,0,width,height],label:"关闭",action:close}));
    }
    if(screen==="SocialSpeaker"){
      const name="socialSpeaker";
      const submit=()=>send(851970,{channel:1,content:field(name)?.value||""},result=>{
        if(result.speaker?.spent){values[name]="";close();}
        else if(result.speaker?.notice)notify(result.speaker.notice,50);
      });
      edit(nodes,2469,{active:false});
      edit(nodes,7046,{active:true,action:submit});
      edit(nodes,2312,{field:name,submit,input:{...nodeById(nodes,2312).input,color:[255,255,255,255]}});
      label(nodes,7335,"请输入广播内容");
      button(7727,()=>{if(!pending){values[name]="";close();}});
      return;
    }
    if(screen==="SocialShortcut"){
      backdrop(1202);
      const rid=shortcutPeer, friend=!!model.friendlist[rid];
      if(!friend && channel!=="friend")button(1607,()=>send(917505,{targetid:rid},close));
      if(!friend && channel!=="private")button(735,()=>{whisperPeers=[rid,...whisperPeers.filter(id=>id!==rid)];channel="private";peer=rid;close();});
      button(4653,()=>inspect(rid));button(880,()=>preference({blockTalker:rid},()=>{whisperPeers=whisperPeers.filter(id=>id!==rid);close();}));
      for(const id of [1420,2114])button(id,()=>{close();notify("对方没有可加入的本机房间");});
      return;
    }
    if(screen==="SocialFilter"){
      button(1008,close);
      const opts=model.chatOptions||{};
      for(const [id,key,title] of [[4720,"world","屏蔽世界频道"],[6552,"private","屏蔽私聊频道"],[8954,"clan","屏蔽战队频道"]]){
        const bg=nodes.find(n=>n.parent===id && n.name==="Background");
        if(bg)picture(nodes,bg.id,(opts[key]?"ON":"OFF")+"-964777403.png");
        edit(nodes,id,{label:title});
        button(id,()=>preference({chatFilter:{[key]:opts[key]?0:1}}));
      }
      for(const [key,minus,plus,value,max] of [["worldVip",5855,1962,4166,25],["worldRank",7786,5846,8155,120],
        ["privateVip",2195,5068,6551,25],["privateRank",1929,5690,6836,120]]){
        const current=opts[key]||0;label(nodes,value,current);
        for(const [id,delta] of [[minus,-1],[plus,1]]){
          edit(nodes,id,{label:(key.startsWith("world")?"世界":"私聊")+(key.endsWith("Vip")?"VIP":"等级")+(delta===1?"加一":"减一")});
          button(id,()=>preference({chatFilter:{[key]:Math.max(0,Math.min(max,current+delta))}}));
        }
      }
      const content=nodeById(nodes,5680),dy=region(nodes,screen,3228,520,nodeById(nodes,3228).clip[3]);
      content.p=[content.p[0],content.p[1]+dy];
      return;
    }
    if(screen==="SocialEmotion"){
      backdrop(533);
      const emotions=await data("social-emotions"),template=await data("SocialEmotionItem");
      const name=channel==="world"?"socialWorld":"socialPrivate";
      emotions.forEach((emotion,index)=>{
        const prefix="emotion-"+emotion.id+"-",row=clonePrefab(template,prefix,339,-Math.floor(index/8)*50,{},{}),
          root=nodeById(row,prefix+1095),icon=nodeById(row,prefix+1016);
        root.p=[index%8*50,root.p[1]];root.hit=[0,0,46,46];root.label="表情"+emotion.id;
        root.action=()=>{const draft=values[name]||"";close();
          if((draft.match(/【表情\d+】/g)||[]).length>=2){notify(662);return;}
          values[name]=draft+"【表情"+emotion.id+"】";render();};
        icon.s=emotion.size;icon.widget={kind:"UISprite",image:emotion.image,color:[255,255,255,255],pivot:4,depth:11};
        nodes.push(...row);
      });
      return;
    }
    async function list(key,src,grid,rowName,rank,icon,nameLabel,background,step) {
      const entries=Object.entries(model[key]||{}),prefab=await data(src);
      const current=entries.some(([i])=>+i===selection[key])?selection[key]:Number(entries[0]?.[0]||0);
      selection[key]=current;
      const panel=nodeById(nodes,grid).parent,clip=nodeById(nodes,panel).clip;
      const dy=region(nodes,screen,panel,entries.length*step,clip?.[3]||360);
      entries.forEach(([id,r],index)=>{
        const rid=Number(id),prefix="social-"+key+"-"+rid+"-";
        const name=r.name||model.people.get(rid)?.name;
        const copy=clonePrefab(prefab,prefix,grid,dy-index*step,{[nameLabel]:name},{label:name,action:()=>{selection[key]=rid;render();}});
        picture(copy,prefix+rank,"rank-"+r.rank+".png");
        if(icon && h.availableHead(r.iconid))picture(copy,prefix+icon,"head-"+r.iconid+".png");
        if(key==="friendlist"){
          label(copy,prefix+1168,model.onlinefriends.includes(rid)?"在线":"离线");
          edit(copy,prefix+1528,{active:!!r.vipstatus});
          if(r.vipstatus)picture(copy,prefix+1413,"Icon_Vip_"+r.vipstatus+"--2078032047.png");
        }
        if(rid===current){const bg=nodeById(copy,prefix+background);bg.widget={...bg.widget,color:[255,226,150,255]};}
        nodes.push(...copy);
      });
      return current;
    }
    if(screen==="SocialWindow"){
      button(3660,()=>open("FriendWindow",h));
      button(4587,()=>qmqzPosters.destination("MyCardWindow",go,"SocialWindow"));
      return;
    }
    if(screen==="FriendWindow"){
      const id=await list("friendlist","FriendListItem",2284,"friend",1017,1237,1096,1538,90);
      label(nodes,8018,(model.onlinefriends||[]).length+"/"+Object.keys(model.friendlist||{}).length);
      button(744,()=>{values.socialId="";values.socialName="";go("SocialAdd");});
      button(441,()=>open("SocialRequests",h));button(891,()=>open("SocialBlacklist",h));
      button(731,()=>{if(id){if(model.onlinefriends.includes(id))openChat("FriendWindow",id,h);else notify(538);}});
      button(7158,()=>{if(id)send(917517,{targetid:id});});
      button(8728,()=>open("SocialCheer",h));button(8333,()=>inspect(id));
      button(4091,()=>{if(id)send(917512,{roleid:id});});
      return;
    }
    if(screen==="SocialAdd"){
      const submit=()=>{
        const id=field("socialId")?.value.trim(),name=field("socialName")?.value.trim();
        if(!id&&!name)return;
        if(id && /^\d+$/.test(id))send(917505,{targetid:Number(id)},close);
        else send(917516,{name:name||id},close);
      };
      edit(nodes,1197,{field:"socialId",submit});edit(nodes,7641,{field:"socialName",submit});
      button(7963,submit);button(6451,close);
    }
    if(screen==="SocialRequests"){
      const id=await list("requests","FriendRequestItem",8295,"request",1169,0,1097,1238,90);
      button(8659,()=>{if(id)send(917520,{targetid:id});});
      button(5023,()=>{if(id)send(917508,{targetid:id});});
      button(2715,()=>inspect(id));button(5215,close);
    }
    if(screen==="SocialBlacklist"){
      const id=await list("blacklist","BlacklistItem",1950,"black",1165,0,1092,1234,90);
      button(746,()=>{if(id)send(917514,{roleid:id});});button(399,close);
    }
    if(screen==="SocialCheer"){
      const template=await data("SocialCheerItem"),rows=[...(model.priases||[])].reverse();
      const dy=region(nodes,screen,2951,rows.length*90,nodeById(nodes,2951).clip[3]);
      rows.forEach((r,i)=>{
        const when=new Date(r.time*1000),pad=n=>String(n).padStart(2,"0");
        const formatted=pad(when.getFullYear()%100)+"/"+pad(when.getMonth()+1)+"/"+pad(when.getDate())+" "+pad(when.getHours()%12||12)+":"+pad(when.getMinutes());
        const prefix="cheer-"+i+"-",row=clonePrefab(template,prefix,4299,dy-i*90,{1094:r.basicinfo.name,1167:formatted},{label:r.basicinfo.name,action:()=>inspect(r.fromid)});
        picture(row,prefix+1236,"rank-"+r.basicinfo.rank+".png");nodes.push(...row);
      });
      button(7473,close);return;
    }
    if(screen==="SocialCard" && inspected){
      const r=inspected;edit(nodes,8883,{active:true});button(8293,close);
      button(5945,()=>send(917505,{targetid:r.roleid}));
      for(const [id,value] of [[641,r.roleid],[7618,r.name],[6361,r.rank],[5918,r.rank],[5472,r.teamname],
        [5659,r.headshots],[7569,r.killnum],[487,r.killrate],[4538,r.ranknum],[6460,r.rankwin],[8636,r.rankpoint]])
        label(nodes,id,value);
      for(const id of [7605,4492,5059])label(nodes,id,0);
      if(h.availableHead(r.iconid))picture(nodes,7463,"head-"+r.iconid+".png");
      picture(nodes,3713,"rank-"+r.rank+".png");edit(nodes,4753,{active:!!r.vipstatus});
      if(r.vipstatus)label(nodes,4369,r.vipstatus);
      const items=(await data("inventory")).items;
      const slots={Main:11,Vice:12,Dagger:50,Head:31,Body:32,Shoe:33,Grenade:41,Flash:42};
      const equipped=(r.equip||[]).map(id=>items.find(it=>it.id===id)).filter(Boolean);
      edit(nodes,7923,{active:false});
      for(const group of nodes.filter(n=>n.parent===6851 && n.name in slots)){
        const item=equipped.find(it=>it.equipPos===slots[group.name]);
        const art=nodes.find(n=>n.parent===group.id && n.name==="weapon");
        const star=nodes.find(n=>n.parent===group.id && n.name==="Star");
        if(star)edit(nodes,star.id,{active:!!item?.star});
        if(art && item?.icon)picture(nodes,art.id,item.icon);
        if(art && !item?.icon)edit(nodes,art.id,{active:false});
        if(star && item?.star)for(const n of nodes.filter(n=>n.parent===star.id && n.name==="Number"))label(nodes,n.id,item.star);
      }
      return;
    }
    if(screen!=="SocialChat")return;
    const personal=channel!=="world";
    for(const id of [3078,6047,6858])edit(nodes,id,{active:false});
    if(["TableWindow","QualifyingWindow"].includes(chatBack))edit(nodes,4967,{active:true,action:()=>notify(349)});
    edit(nodes,229,{active:!personal});edit(nodes,538,{active:personal});
    for(const [id,value] of [[5161,"world"],[3722,"friend"],[957,"private"]])
      button(id,()=>{channel=value;peer=0;render();});
    button(7224,close);
    button(4143,()=>{values.socialSpeaker="";go("SocialSpeaker");});
    button(2250,()=>go("SocialFilter"));button(personal?8951:2865,()=>go("SocialEmotion"));
    const authors=model.history.filter(m=>m.channel==="friend" && model.friendlist[m.peer]).map(m=>m.peer);
    const contacts=channel==="friend"?[...new Set([...authors,...(model.onlinefriends||[])])]:
      [...new Set([...whisperPeers,...model.history.filter(m=>m.channel==="private").reverse().map(m=>m.peer)])]
        .filter(id=>!model.friendlist[id]&&!model.chatOptions?.blocked?.includes(id));
    edit(nodes,6047,{active:channel!=="friend" && model.history.some(m=>m.channel==="friend"&&m.unread)});
    edit(nodes,6858,{active:channel!=="private" && model.history.some(m=>m.channel==="private"&&m.unread)});
    if(personal)label(nodes,4351,channel==="friend"?"在线好友":"我的私聊");
    if(personal){
      if(!contacts.includes(peer))peer=contacts[0]||0;
      const template=await data("SocialGoalItem"),dy=region(nodes,screen,1030,contacts.length*64,476);
      contacts.forEach((rid,i)=>{
        const info=model.people.get(rid),name=info?.name||String(rid),prefix="chat-peer-"+rid+"-";
        const row=clonePrefab(template,prefix,8931,dy-i*64,{992:name},{label:name,action:()=>{peer=rid;render();}});
        if(h.availableHead(info?.iconid))picture(row,prefix+1281,"head-"+info.iconid+".png");
        if(rid===peer){const bg=nodeById(row,prefix+1154);bg.widget={...bg.widget,color:[255,226,150,255]};}
        nodes.push(...row);
      });
    }
    const name=personal?"socialPrivate":"socialWorld";
    const emotions=await data("social-emotions"),byId=new Map(emotions.map(e=>[e.id,e])),bySource=new Map(emotions.map(e=>[e.src,e]));
    const submit=()=>{
      const input=field(name),text=input?.value.trim().replace(/【表情(\d+)】/g,(token,id)=>
        byId.has(Number(id))?"<img src='"+byId.get(Number(id)).src+"'></img>":token);
      if(!text)return;
      const now=performance.now(),vip=model.people.get(me)?.vip||0;
      if(now-previousTime<3000 || (!personal && vip<3 && now<nextWorld) ||
        (text===previousText && now-previousTime<30000)){notify(469);return;}
      if(text.replace(/<img src=[\s\S]*?<\/img>/g,"*").length>50){notify(480,50);return;}
      if([...text.matchAll(/<img src='([^']+)'><\/img>/g)].filter(m=>bySource.has(m[1])).length>2){notify(662);return;}
      if(!personal && state.profile.level<20 && vip<3){notify(621,20);return;}
      if(personal && !peer){notify(158);return;}
      send(personal?851969:851970,personal?{roleid:peer,content:text}:{channel:0,content:text},result=>{
        if(personal || result.receipts.some(m=>m.id===851975 && m.fields.result===0)){values[name]="";if(input)input.value="";
          previousTime=performance.now();previousText=text;
          if(!personal && text.length>16)nextWorld=previousTime+20000;
        }
      });
    };
    edit(nodes,personal?1487:8086,{field:name,submit});button(personal?5663:1473,submit);
    const template=await data(personal?"SocialGoalMessage":"SocialFreeMessage");
    const source=nodeById(nodes,personal?7980:3634);
    const visible=model.history.filter(m=>m.channel===channel&&(!personal||m.peer===peer));
    if(personal && peer && visible.some(m=>m.unread)){
      const seen=peer;
      const saved=await qmqzLocalSocial(me,channel==="friend"?{readFriend:seen}:{readPrivate:seen});
      if(me===role)observe(saved);
    }
    const panel=personal?6540:5009,key=scrollKey(screen,panel),width=personal?527:690;
    const metrics=document.createElement("canvas").getContext("2d");metrics.font='20px sans-serif';
    function richText(text){
      const parts=[];let cursor=0,x=0,line=0;
      function appendText(value){
        let run="",start=x;
        function flush(){if(run)parts.push({text:run,x:start,line});run="";}
        for(const ch of value){
          const size=metrics.measureText(ch).width;
          if(x+size>width){flush();x=0;line++;start=0;}
          run+=ch;x+=size;
        }
        flush();
      }
      for(const match of text.matchAll(/<img src='([^']+)'><\/img>/g)){
        const image=bySource.get(match[1]);if(!image)continue;
        appendText(text.slice(cursor,match.index));
        if(x+image.size[0]>width){x=0;line++;}
        parts.push({image,x,line});x+=image.size[0];cursor=match.index+match[0].length;
      }
      if(!cursor)return null;
      appendText(text.slice(cursor));return parts;
    }
    const runs=visible.map(m=>richText(m.text));
    const heights=visible.map((m,i)=>Math.max(58,32+(runs[i]?(1+runs[i].at(-1).line)*30:Math.ceil(metrics.measureText(m.text).width/width)*24)));
    const dy=region(nodes,screen,panel,heights.reduce((sum,h)=>sum+h,0),440);
    let y=-30+limits[key]-dy;
    visible.forEach((msg,index)=>{
      const r=model.people.get(msg.sender),prefix="chat-"+index+"-";
      const textId=personal?1223:1279,headId=personal?1078:1495,rankId=personal?1478:1403;
      const vipId=personal?1280:1152,iconId=personal?1369:1077,nameId=personal?991:1434,levelId=personal?1404:1477;
      const copy=clonePrefab(template,prefix,personal?7276:669,y,{[nameId]:r?.name||String(msg.sender),[levelId]:r?.level||1},
        msg.sender===me?{}:{label:r?.name||String(msg.sender),action:()=>{shortcutPeer=msg.sender;go("SocialShortcut");}});
      if(h.availableHead(r?.iconid))picture(copy,prefix+headId,"head-"+r.iconid+".png");
      else edit(copy,prefix+headId,{active:false});
      if(r)picture(copy,prefix+rankId,"rank-"+r.level+".png");
      edit(copy,prefix+vipId,{active:!!r?.vip});
      if(r?.vip){
        picture(copy,prefix+iconId,"Icon_Vip_"+r.vip+"--2078032047.png");
        const icon=nodeById(copy,prefix+iconId),name=nodeById(copy,prefix+nameId);
        icon.s=[47,22];name.p=[name.p[0]+47,name.p[1]];
      }
      const body={...source,id:prefix+"body",parent:prefix+textId,p:[0,-2],s:[20,20],widget:{...source.widget,
        pivot:0,encoding:false,color:msg.monthcard?[240,60,0,255]:[250,230,210,255],maxWidth:width,maxLines:4,text:msg.text}};
      if(!runs[index])copy.push(body);
      else runs[index].forEach((part,i)=>{
        const run={...body,id:body.id+"-"+i,p:[part.x,-2-part.line*30],widget:{...body.widget,text:part.text}};
        if(part.image){run.s=part.image.size;run.widget={kind:"UISprite",pivot:0,image:part.image.image,color:[255,255,255,255],depth:source.widget.depth};}
        copy.push(run);
      });
      nodes.push(...copy);y-=heights[index];
    });
  }
  window.qmqzSocial={modals,windowNames,parent,display,open,openChat,scrollKey,scroll,offset,badge};
})();
