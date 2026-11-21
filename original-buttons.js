(() => {
  "use strict";
  const standardSound={file:"UI-Button_1.mp3",trigger:0,pitch:1,volume:1};
  function gesturesOnly(n) {
    return n.id===7424 || n.name==="EntryPoster" || n.id==="poster-enter" || n.modalBackground || n.slide;
  }
  function defaults(n) {
    if(!n.action || !n.hit || gesturesOnly(n) || n.label==="大厅海报")return;
    if(!n.motionDuration && !n.buttonColor && !n.buttonSprite &&
       Math.abs(n.s[0]*n.hit[2])<850 && Math.abs(n.s[1]*n.hit[3])<480) {
      n.motionDuration=.2;n.hoverScale=1;n.pressScale=1.05;
    }
  }
  function bind(b,n,h) {
    if(gesturesOnly(n))return;
    const sounds=n.sounds?.length ? n.sounds : [standardSound];
    let delayedPress=false, keyboard=false, start=null, swiped=false;
    const baselines=new Map();
    function sound(trigger) {
      for(const s of sounds)if(s.trigger===trigger) {
        const audio=new Audio(h.resource(s.file));
        audio.volume=Math.min(1,s.volume*window.qmqzVolume.get("effects"));
        audio.preservesPitch=false;audio.playbackRate=s.pitch||1;
        audio.play().catch(()=>{});
      }
    }
    function baseline(el) {
      if(!baselines.has(el))baselines.set(el,{backgroundImage:el.style.backgroundImage,
        borderImageSource:el.style.borderImageSource,filter:el.style.filter,opacity:el.style.opacity});
      return baselines.get(el);
    }
    function phase(state) {
      n.onButtonState?.(state==="pressed",h.art);
      const moving=state!=="normal";
      const scale=state==="pressed"?n.pressScale:state==="hover"?n.hoverScale:1;
      const [x,y]=(state==="pressed"?n.pressOffset:state==="hover"?n.hoverOffset:null)||[0,0];
      const transform="translate("+x+"px,"+(-y)+"px) scale("+(Array.isArray(scale)?scale.join(","):scale??1)+")";
      for(const layer of h.motions.get(n.id)||[])layer.style.transform=transform;
      const color=n.buttonColor, tint=color && h.art.get(color.target);
      if(tint) {
        const initial=baseline(tint),val=color[state];
        tint.style.transition="filter "+color.duration+"s "+h.curve+", opacity "+color.duration+"s "+h.curve;
        tint.style.filter=moving ? h.tint(val) : initial.filter;
        tint.style.opacity=moving ? val[3]/255 : initial.opacity;
      }
      const sprite=n.buttonSprite, art=sprite && h.art.get(sprite.target);
      if(art) {
        const initial=baseline(art), source=sprite[state];
        const key=initial.borderImageSource?"borderImageSource":"backgroundImage";
        art.style[key]=source?'url("'+h.resource(source)+'")':initial[key];
      }
    }
    b.addEventListener("pointerenter",e=>{if(e.pointerType!=="touch"){phase("hover");sound(1);}});
    b.addEventListener("pointerleave",e=>{phase("normal");if(e.pointerType!=="touch")sound(2);});
    b.addEventListener("pointerdown",e=>{
      if(e.button!==0)return;
      start=[e.clientX,e.clientY];swiped=false;
      phase("pressed");
      delayedPress=e.pointerType==="touch" && !!h.scroll(b,e);
      if(!delayedPress)sound(3);
    });
    b.addEventListener("pointerup",e=>{
      swiped=!!start && Math.hypot(e.clientX-start[0],e.clientY-start[1])>=7;start=null;
      phase(e.pointerType==="touch"?"normal":"hover");
      if(h.scrolled() || swiped){delayedPress=false;return;}
      if(delayedPress){sound(3);delayedPress=false;}
      sound(4);
    });
    b.addEventListener("pointercancel",()=>{delayedPress=false;swiped=true;start=null;phase("normal");});
    b.addEventListener("blur",()=>{keyboard=false;phase("normal");});
    b.addEventListener("keydown",e=>{
      if(e.key!=="Enter" && e.key!==" ")return;
      e.preventDefault();
      if(!keyboard){keyboard=true;phase("pressed");sound(3);}
    });
    b.addEventListener("keyup",e=>{
      if(e.key!=="Enter" && e.key!==" ")return;
      e.preventDefault();
      if(keyboard){keyboard=false;phase("normal");sound(4);b.click();}
    });
    b.onclick=e=>{
      if(e.detail && (h.scrolled() || swiped))return;
      sound(0);
      n.action();
    };
  }
  window.qmqzButtonFeedback={defaults,bind};
})();
