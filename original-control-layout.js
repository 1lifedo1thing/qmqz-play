/* The original Layout modal and the fight HUD share a 768-unit portrait-independent board. */
window.qmqzTouchLayout=(()=>{
  "use strict";
  const storage="QMQZ.touch-layout.v1", fireMode="QMQZ.fire-fixed";
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  let saved={}, defaults, gesture, frame, redraw;
  try{saved=JSON.parse(localStorage.getItem(storage))||{};}catch{}
  if(typeof saved!=="object" || Array.isArray(saved))saved={};
  const throwNames=["Grenade","Flash"];
  const insetProbe=document.createElement("span");
  insetProbe.style.cssText="position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)";
  document.body.append(insetProbe);
  let insets;
  function updateInsets(){
    const css=getComputedStyle(insetProbe);
    insets=[css.paddingLeft,css.paddingRight,css.paddingBottom,css.paddingTop].map(v=>parseFloat(v)||0);
  }
  updateInsets();
  window.addEventListener("resize",updateInsets);
  const ids={5206:"Rocker",3247:"Trigger",4893:"Pose",3972:"Jump",7538:"Weapon",205:"Reload",
    1870:"Bullet",5713:"Intro",2697:"Sight",7928:"Telescope",8575:"Grenade",3307:"Flash",4379:"Switch"};
  const pointers=new Map();
  function position(key,def,width,height){
    // Unedited buttons keep their source anchors on every screen ratio.
    const p=saved[key], units=height/768;
    if(p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.scale))
      return {x:p.x*width,y:p.y*height,scale:clamp(p.scale,.5,2)*units};
    return {x:def.X*units+((def.Anchor&8)?-width/2:(def.Anchor&2)?width/2:0),
      y:def.Y*units+((def.Anchor&4)?-height/2:(def.Anchor&1)?height/2:0),scale:def.Scale*units};
  }
  function throwables(table,width,height,cssScale){
    const buttons={}, bounds={};
    for(const key of throwNames){
      const p=position(key,table[key],width,height);
      // Both native sprites are 106 units across. GetRightRect only covered their central 90.
      p.hit=Math.max(106*p.scale,44/cssScale);
      const radius=p.hit/2, pad=8/cssScale;
      const [left,right,bottom,top]=insets.map(v=>v/cssScale);
      const b=bounds[key]=[-width/2+left+pad+radius,width/2-right-pad-radius,
                             -height/2+bottom+pad+radius,height/2-top-pad-radius];
      p.x=clamp(p.x,b[0],b[1]);p.y=clamp(p.y,b[2],b[3]);buttons[key]=p;
    }
    // A saved position could land on the other button after a drag or a change of aspect ratio.
    const moving=saved.Grenade&&!saved.Flash ? "Grenade" : "Flash";
    const a=buttons[moving], b=buttons[moving==="Grenade"?"Flash":"Grenade"];
    const space=(a.hit+b.hit)/2+2/cssScale;
    if(!gesture && Math.abs(a.x-b.x)<space && Math.abs(a.y-b.y)<space){
      const [lo,hi,bottom,top]=bounds[moving], dy=moving==="Flash"?space:-space;
      const open=[[a.x,b.y+dy],[a.x,b.y-dy],[b.x-space,a.y],[b.x+space,a.y]]
        .find(([x,y])=>x>=lo&&x<=hi&&y>=bottom&&y<=top);
      if(open)[a.x,a.y]=open;
    }
    let repaired=false;
    if(!gesture)for(const key of throwNames){
      if(!saved[key])continue;
      const p=buttons[key],old=saved[key];
      if(!Number.isFinite(old.x)||!Number.isFinite(old.y)||!Number.isFinite(old.scale)){
        delete saved[key];repaired=true;
      } else if(Math.abs(old.x*width-p.x)>.01 || Math.abs(old.y*height-p.y)>.01 || old.scale<.5 || old.scale>2){
        saved[key]={x:p.x/width,y:p.y/height,scale:p.scale*768/height};repaired=true;
      }
    }
    if(repaired)localStorage.setItem(storage,JSON.stringify(saved));
    return buttons;
  }
  const shortcut=key=>localStorage.getItem("QMQZ.Shortcut"+key)!=="0";
  function shortcutOptions(nodes,edit,picture,render,state,notify){
    for(const [key,id,bg,title] of [["Grenade",4058,2810,"手雷快捷按钮"],["Flash",315,4400,"闪光弹快捷按钮"]]){
      const enabled=shortcut(key);
      picture(nodes,bg,(enabled?"ON":"OFF")+"-964777403.png");
      edit(nodes,id,{label:title,pressed:enabled,action:()=>{
        localStorage.setItem("QMQZ.Shortcut"+key,enabled?"0":"1");render();
        const e=state.profile?.equipment,slot=key==="Grenade"?41:42;
        if(!enabled && e && !e.loadouts[e.activeindex]?.slots.some(s=>s.position===slot&&s.itemId>0))
          notify("当前背包未装备"+(slot===41?"手雷":"闪光弹")+"，可在大厅背包中选择第 "+slot+" 槽。");
      }});
    }
  }
  function reset(){saved={};localStorage.removeItem(storage);}
  function changed(){if(!frame)frame=requestAnimationFrame(()=>{frame=0;redraw();});}
  function boardPoints(){
    const [a,b]=pointers.values();
    return b ? {x:(a.x+b.x)/2,y:(a.y+b.y)/2,d:Math.hypot(a.x-b.x,a.y-b.y)} : {...a,d:0};
  }
  function rebase(){
    const g=gesture;
    g.start=boardPoints();
    g.base={...g.value};
  }
  function listen(menu,render){
    redraw=render;
    menu.addEventListener("pointerdown",e=>{
      const button=e.target.closest("[data-layout-key]");
      if(!button && !gesture)return;
      if(e.button!==0 || pointers.size>=2)return;
      if(!gesture){
        const key=button.dataset.layoutKey, rect=button.getBoundingClientRect();
        const geometry=JSON.parse(button.dataset.layoutBoard);
        gesture={key,geometry,w:rect.width,h:rect.height,
          value:{x:geometry[2],y:geometry[3],scale:geometry[4]}};
      }
      e.preventDefault();e.stopImmediatePropagation();
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      menu.setPointerCapture(e.pointerId);rebase();
    },true);
    menu.addEventListener("pointermove",e=>{
      if(!pointers.has(e.pointerId))return;
      e.preventDefault();e.stopImmediatePropagation();
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      const g=gesture,p=boardPoints(),[w,h]=g.geometry;
      const scale=clamp(g.base.scale*(g.start.d>1?p.d/g.start.d:1),.5,2);
      const mx=Math.min(.49,g.w*scale/g.geometry[4]/w/2), my=Math.min(.49,g.h*scale/g.geometry[4]/h/2);
      g.value={x:clamp(g.base.x+(p.x-g.start.x)/w,-.5+mx,.5-mx),
        y:clamp(g.base.y-(p.y-g.start.y)/h,-.5+my,.5-my),scale};
      saved[g.key]=g.value;changed();
    },true);
    function finish(e){
      if(!pointers.delete(e.pointerId))return;
      e.preventDefault();e.stopImmediatePropagation();
      if(pointers.size){rebase();return;}
      gesture=null;localStorage.setItem(storage,JSON.stringify(saved));changed();
    }
    for(const name of ["pointerup","pointercancel","lostpointercapture"])menu.addEventListener(name,finish,true);
  }
  async function modal(nodes,close,render){
    if(!defaults)defaults=(await fetch("hud/layout.json").then(r=>r.json())).defaults;
    for(const n of nodes){
      n.overlay=true;
      if(n.id===1318)n.active=true;
      if(n.id===892)n.action=close;
      if(n.id===5266)n.action=()=>{reset();render();};
      if([5608,8217].includes(n.id))n.active=false;
      if(ids[n.id]){n.layoutKey=ids[n.id];n.action=()=>{};}
    }
  }
  function arrange(nodes,w,h,screenScale){
    const throwButtons=throwables(defaults,w,h,screenScale);
    for(const n of nodes)if(n.layoutKey){
      const p=throwButtons[n.layoutKey]||position(n.layoutKey,defaults[n.layoutKey],w,h);
      n.p=[p.x,p.y];n.s=[p.scale,p.scale];
      n.layoutBoard=[w*screenScale,h*screenScale,p.x/w,p.y/h,p.scale*768/h];
    }
  }
  return {modal,listen,arrange,position,throwables,shortcut,shortcutOptions,reset,
    resetShortcuts(){for(const key of throwNames)localStorage.removeItem("QMQZ.Shortcut"+key);},
    get fixed(){return localStorage.getItem(fireMode)==="1";},
    toggleFire(){localStorage.setItem(fireMode,this.fixed?"0":"1");},
    resetFire(){localStorage.removeItem(fireMode);}};
})();
