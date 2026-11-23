// fightPreload FrontSight.HitHint, KillNoticeMgr and the challenge's PVEKillNotice.
window.createCombatFeedback = function (redraw) {
  const sight = "windows/FrontSight/Center/HitHint";
  const injure = "windows/FrontSight/Center/Injure";
  const feed = "States/MsgBoard/KillNotice/MsgList/KillNoticeMsg";
  const ko = "States/MsgBoard/Right/ChallengeKillNotice/Panel";
  // Original TextPool entries 311–313 format the killer and victim separately.
  const nameColors = ["ff8020", "2f7eff", "ff0045"].map(hex =>
    [0,2,4].map(offset=>parseInt(hex.slice(offset,offset+2),16)/255).concat(1));
  const rows = [], rowIndexes = new Map(), sketches = new Map();
  let art, sheet, sequence=0, hitUntil=0, lastHitGrade=0, shownGrade=0, koCount=0, koStart=0;
  let now=0, nextWake=0, wakeTimer=0, active=false;
  let injureUntil=0, injureDirection=0;
  let coverUntil=0, coverText="";
  let blindAlpha=0;
  const blind="BattlePanel/Panel/GameBlind";
  const targetPanel="windows/TargetPanel/PlayerInfo";
  const privatePanel="States/MsgBoard/PrivateNoticeBoard/NoticePanel";
  const badges=["KillNum","FirstBlood","Blow","Godlike","Matrix","Headshot","Infection","Shield","DaggerKill","HeroKill","HeroDead","Headshot","KillBoss"];
  const comboBadges=["doublekill","Triplekill","quadrakill","Pentakill","Hexakill","Heptakill"];
  const green=[0,190/255,80/255,1], red=[237/255,35/255,34/255,1];
  const privateNotices=[];
  let privateStart=0, badgeTime=0, currentTarget;
  window.addEventListener("qmqz-streak-reset",({detail:owner})=>{
    if(owner>0)return;
    privateNotices.length=0;privateStart=badgeTime=0;
    if(active)redraw();
  });
  window.addEventListener("qmqz-range-blind", ({detail}) => {
    if (active) { blindAlpha=detail; redraw(); }
  });

  let heroWord, heroLoading;
  function prepareHeroWord() {
    if (heroLoading) return;
    heroLoading=fetch("hud/hero-kill.json").then(r=>{
      if (!r.ok) throw Error("hero-kill.json "+r.status);
      return r.json();
    }).then(async layout=>{
      const sheets=await Promise.all(Array.from({length:layout.sheets},async (_,index)=>{
        const img=new Image();
        img.src="hud/hero-kill-"+index+".webp";
        await img.decode();
        return img;
      }));
      heroWord={...layout,sheets};
      redraw();
    }).catch(()=>{heroLoading=null;});
  }
  function drawHeroWord(ctx,x,y,parent) {
    if (privateNotices[0]?.kind!==10) return false;
    if (!heroWord || !parent || badgeTime<0) return true;
    const frame=heroWord.frames[Math.min(heroWord.frames.length-1,Math.floor(badgeTime*heroWord.rate/1000))];
    if (frame) {
      const [sheet,sx,sy,w,h,left,top]=frame;
      ctx.save();
      ctx.translate(x+parent.x,y-parent.y);
      ctx.rotate(-parent.angle);
      ctx.scale(parent.sx/heroWord.density,parent.sy/heroWord.density);
      ctx.drawImage(heroWord.sheets[sheet],sx,sy,w,h,left,top,w,h);
      ctx.restore();
    }
    return true;
  }
  function receive(event) {
    const hit=event.detail;
    if (!active || !hit || hit.sequence<=sequence) return;
    sequence=hit.sequence;
    const time=performance.now();
    if(hit.killed && hit.target===0)privateNotices.length=0;
    if (hit.source===0 && hit.killType>=0 && (hit.killed || hit.killType===6 || hit.killType===7)) {
      if (hit.killType===10) prepareHeroWord();
      if (!privateNotices.length) privateStart=time;
      privateNotices.push({kind:hit.killType,combo:hit.combo});
    }
    if (hit.source===0 && hit.hpDamage>0) {
      if (time>=hitUntil) {
        lastHitGrade=Math.min(10,Math.max(1,Math.floor(hit.hpDamage/10)));
        shownGrade=0;
      }
      hitUntil=time+(art?.hitSeconds ?? .5)*1000;
    }
    if(hit.source===0 && hit.throughCover && (hit.hpDamage>0 || hit.armorDamage>0)) {
      coverText=hit.hpDamage>0 ? "穿墙 −"+hit.hpDamage : "穿墙 护甲 −"+hit.armorDamage;
      coverUntil=time+(art?.hitSeconds ?? .5)*1000;
    }
    if (hit.target===0 && hit.hpDamage>0 && Number.isFinite(hit.injureDirection)) {
      injureDirection=hit.injureDirection;
      injureUntil=time+(art?.injureSeconds ?? 1)*1000;
    }
    if (hit.killed || hit.infected) {
      if (hit.challenge) {
        if (hit.source===0) { koCount=hit.challengeKills; koStart=time; }
        if (hit.target===0) koCount=0;
      } else {
        rows.push({...hit,time});
        if (rows.length>4) rows.shift();
      }
    }
    redraw();
  }
  window.addEventListener("qmqz-combat-notice",receive);

  function setActive(value) {
    active=value;
    if (value) return;
    sequence=0;
    rows.length=0; hitUntil=injureUntil=coverUntil=0; koCount=0; koStart=0; blindAlpha=0;
    privateNotices.length=0; currentTarget=null;
    clearTimeout(wakeTimer); nextWake=0;
  }
  function beginFrame(identity) {
    now=performance.now();
    currentTarget=identity?.target?.maxHp>0 ? identity.target : null;
    while (privateNotices.length && now-privateStart>=1950) { privateNotices.shift(); privateStart+=1950; }
    badgeTime=now-privateStart-150;
    if (privateNotices.length) redraw();
    while (rows.length && rows[0].time+5000<=now) rows.shift();
    if (now<hitUntil && shownGrade<lastHitGrade) shownGrade++;
    const animating=(now<hitUntil && shownGrade<lastHitGrade) ||
      rows.some(row=>row.headshot && now-row.time<300) || (koCount>0 && now-koStart<200);
    if (animating) redraw();
    const wake=Math.min(hitUntil>now ? hitUntil : Infinity,injureUntil>now ? injureUntil : Infinity,coverUntil>now ? coverUntil : Infinity,
      rows.length ? rows[0].time+5000 : Infinity);
    if (nextWake!==wake) {
      clearTimeout(wakeTimer);
      nextWake=wake;
      if (Number.isFinite(wake)) wakeTimer=setTimeout(()=>{ nextWake=0; redraw(); },Math.max(1,wake-now));
    }
  }
  function setup(layout, image) {
    art=layout.feedback; sheet=image;
    for (const [path,node] of Object.entries(layout.nodes)) {
      if (Number.isInteger(node.noticeRow)) rowIndexes.set(path,node.noticeRow);
    }
  }
  function drawCover(ctx,width,height,widget) {
    if(!widget || now>=coverUntil)return;
    ctx.save();
    ctx.translate(width/2,height/2+38);
    window.qmqzFonts.draw(ctx,widget,coverText,16,[1,.82,.52,1]);
    ctx.restore();
  }
  function rowAt(path) {
    const root=path.split("/").slice(0,5).join("/");
    return rows[rowIndexes.get(root)];
  }
  function visible(path) {
    if (path===targetPanel) return !!currentTarget;
    if (path.startsWith(targetPanel+"/")) {
      if (path===targetPanel+"/Diamond") return false;
      if (path===targetPanel+"/Icon" || path===targetPanel+"/Score") return currentTarget?.star>0;
    }
    if (path===privatePanel) return privateNotices.length>0 && badgeTime>=0;
    if (path.startsWith(privatePanel+"/")) {
      const entry=privateNotices[0];
      if (!entry) return false;
      const {kind,combo}=entry;
      const leaf=path.slice(privatePanel.length+1);
      if (leaf==="Plate" || leaf==="Plate2") {
        if (kind===7 || kind===10) return false;
        const large=[0,3,4,5,9].includes(kind) && combo>3;
        return leaf===(large?"Plate2":"Plate");
      }
      if (leaf.startsWith("KillTypes/")) {
        if (kind===0 && (combo<2 || combo>7)) return false;
        return leaf==="KillTypes/"+badges[kind];
      }
      if (leaf.startsWith("Kills/kill")) {
        if ([1,6,7,10,11,12].includes(kind)) return false;
        const n=Number(leaf.slice(10));
        return n<=Math.min(8,combo) && (n<combo || badgeTime>=300);
      }
    }
    if (path===blind) return blindAlpha>0;
    if (path===sight) return now<hitUntil;
    if (path===injure) return now<injureUntil;
    if (path===ko) return koCount>0;
    if (path.startsWith(feed)) {
      const row=rowAt(path);
      return !!row && (!path.endsWith("/Headshot") || row.headshot);
    }
  }
  function value(path,val) {
    if (currentTarget && path.startsWith(targetPanel+"/")) {
      const t=currentTarget;
      if (path.endsWith("/Name")) {val.text=t.name;val.color=t.friendly?green:red;}
      if (path.endsWith("/Score")) val.text=String(t.star);
      if (path.endsWith("/Slider/Foreground")) {val.fill=Math.max(0,Math.min(1,t.hp/t.maxHp));val.color=t.friendly?green:red;}
      if (path.endsWith("/AC/Foreground")) val.fill=t.maxArmor ? Math.max(0,Math.min(1,t.armor/t.maxArmor)) : 0;
    }
    if (path===privatePanel+"/KillTypes/KillNum" && privateNotices.length)
      val.key="GameAtlas-Icon_"+comboBadges[privateNotices[0].combo-2];
    if (path===blind) val.color=[1,1,1,blindAlpha];
    if (path.startsWith(sight+"/") && path.endsWith("/Foreground")) {
      val.fill=shownGrade/10;
      val.verticalFromTop=true;
    } else if (path===ko+"/Label") {
      val.text=String(koCount);
    } else if (path.startsWith(feed)) {
      const row=rowAt(path);
      if (!row) return;
      const [weapon,type]=art.weapons[row.weapon] || ["default",""];
      if (path.endsWith("/Weapon")) val.sketch=art.bioSketches[row.sourceRole] || weapon;
      if (path.endsWith("/Type")) val.text=row.infected ? "感染" : art.bioSketches[row.sourceRole] ? "" : type;
      if (path.endsWith("/Killer") || path.endsWith("/Deader")) {
        const killer=path.endsWith("/Killer");
        val.text=(killer ? row.sourceName : row.targetName) || "";
        val.color=nameColors[killer ? row.sourceSide : row.targetSide] || nameColors[0];
      }
    }
  }
  function scale(path,normal) {
    if (path===ko) {
      const factor=Math.min(1,(now-koStart)/200);
      return [factor,factor];
    }
    if (!path.startsWith(feed) || !path.endsWith("/Headshot")) return normal;
    const row=rowAt(path);
    if (!row) return normal;
    const t=Math.min(1,(now-row.time)/300);
    const factor=1+2*(1-Math.sin(t*Math.PI/2));
    return [83*factor,33*factor];
  }
  function sketch(name) {
    if (sketches.has(name)) return sketches.get(name);
    const rect=art?.sketches[name];
    if (!rect || !sheet) return null;
    const [x,y,w,h]=rect, canvas=document.createElement("canvas");
    canvas.width=w; canvas.height=h;
    canvas.getContext("2d").drawImage(sheet,x,y,w,h,0,0,w,h);
    sketches.set(name,canvas);
    return canvas;
  }
  function rotation(path,original) { return path===injure ? -injureDirection*Math.PI/180 : original; }
  function privateScale(path,s) {
    if (path!==privatePanel+"/KillTypes" || badgeTime>=300) return s;
    const t=Math.max(0,badgeTime)/300;
    const bounce=t<1/2.75 ? 7.5685*t*t : t<2/2.75 ? 7.5625*(t-1.5/2.75)**2+.75 :
      t<2.5/2.75 ? 7.5625*(t-2.25/2.75)**2+.9375 : 7.5625*(t-2.625/2.75)**2+.984375;
    return s.map(v=>v*bounce);
  }
  function arrowOffset(path,angle) {
    const notice=privateNotices[0];
    if (!notice || badgeTime<300 || badgeTime>=420 || path!==privatePanel+"/Kills/kill"+notice.combo) return [0,0];
    const distance=160*(1-(badgeTime-300)/120);
    return [-Math.sin(angle)*distance,Math.cos(angle)*distance];
  }
  function allyNames(ctx,positions,offset,count,fighters,widget,w,h) {
    if (!widget) return;
    const placed=[];
    for (let i=0;i<count;i++) {
      const at=offset+i*3,name=fighters?.[positions[at]]?.nickname;
      if (!name) continue;
      const x=positions[at+1]*w, y=(1-positions[at+2])*h;
      if (x<30 || x>w-30 || y<9 || y>h-9 || placed.some(pos=>Math.abs(x-pos.x)<84 && Math.abs(y-pos.y)<18)) continue;
      ctx.save();ctx.translate(x,y);
      window.qmqzFonts.draw(ctx,widget,name,16,green);
      ctx.restore();placed.push({x,y});
    }
  }
  return {setup,prepareHeroWord,drawHeroWord,drawCover,setActive,beginFrame,visible,value,scale,rotation,sketch,privateScale,arrowOffset,allyNames};
};
