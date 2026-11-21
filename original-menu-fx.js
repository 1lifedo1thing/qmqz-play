(() => {
  "use strict";
  function start(clock) {
    if(clock.start===undefined){clock.start=performance.now();clock.onStart?.();}
    return performance.now()-clock.start;
  }
  // UITweener.Sample method 0 and method 4 (BounceLogic), sampled as CSS linear easing stops.
  const ease=fn=>"linear("+Array.from({length:65},(_,i)=>fn(i/64).toFixed(6)).join(",")+")";
  const smooth=ease(t=>t-Math.sin(2*Math.PI*t)/(2*Math.PI));
  const bounce=ease(t=>{
    if(t<.363636)return 7.5685*t*t;
    if(t<.727272)return 7.5625*(t-.545454)**2+.75;
    if(t<.90909)return 7.5625*(t-.818181)**2+.9375;
    return 7.5625*(t-.954545)**2+.984375;
  });
  function particle(nodes,library,key,parent,clock,delay=0,options={}) {
    const art=library[key], [x,y]=options.offset||[0,0];
    nodes.push({id:"fx-"+parent+"-"+key,parent,name:key,active:true,p:[x+art.center[0],y+art.center[1]],
      z:options.z??1,s:art.size,widget:{kind:"MenuParticle",pivot:4,color:[255,255,255,255],depth:0,image:art.image},
      particle:{art,key,clock,delay,loop:!!options.loop,hideAfter:options.hideAfter}});
  }
  function paint(el,n) {
    const {art,clock,delay,key,loop,hideAfter}=n.particle;
    const age=start(clock), duration=art.frames*50;
    el.dataset.particle=key;
    el.style.mixBlendMode="screen";
    const rows=Math.ceil(art.frames/art.columns);
    el.style.backgroundSize=art.columns*100+"% "+rows*100+"%";
    const positions=Array.from({length:art.frames},(_,i)=>({offset:i/art.frames,
      backgroundPosition:(art.columns===1?0:100*(i%art.columns)/(art.columns-1))+"% "+(rows===1?0:100*Math.floor(i/art.columns)/(rows-1))+"%",
      easing:"steps(1,end)"}));
    positions.push({...positions.at(-1),offset:1});
    const anim=el.animate(positions,{duration,delay,iterations:loop?Infinity:1,fill:"both"});
    anim.currentTime=age;
    const until=hideAfter===undefined?Infinity:delay+hideAfter;
    if(age<delay || until!==Infinity){
      const end=Number.isFinite(until)?until:delay+1;
      const vis=el.animate([{visibility:"hidden",offset:0,easing:"steps(1,end)"},
        {visibility:"visible",offset:delay/end,easing:"steps(1,end)"},{visibility:Number.isFinite(until)?"hidden":"visible"}],
        {duration:end,fill:"both"});
      vis.currentTime=age;
    }
  }
  window.qmqzMenuFX={start,particle,paint,smooth,bounce};
})();
