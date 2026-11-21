(() => {
  "use strict";
  let entry, tab, purchase;
  function reset() { entry=tab=purchase=undefined; }
  function select(parent) { tab={parent}; }
  function double() { purchase={}; }

  function attach(nodes, sprites, result) {
    entry ||= {};
    const add=(key,parent,clock,options={})=>qmqzMenuFX.particle(nodes,sprites,key,parent,clock,0,options);
    const anchor=nodes.find(n=>n.id===1880);
    add("duizhanjiesu",8861,entry,{hideAfter:sprites.duizhanjiesu.frames*50});
    if(!result.doubled)add("jiabei",1880,entry,{offset:[-58,0],loop:true});
    if(tab)add("EFF_TAB_LONG",tab.parent,tab,{hideAfter:2000});
    if(purchase)add("namesure",anchor.parent,purchase,{offset:anchor.p,hideAfter:5000});
    for(const [id,delay] of [[662,0],[4114,500],[5289,1000]])nodes.find(n=>n.id===id).rewardDelay=delay;
    nodes.find(n=>n.id===6468).rewardScore=true;
  }

  function scoreAt(target,time) {
    let value=0;
    for(let i=0;i<=Math.floor(time/100)&&i<20;i++){
      const next=Math.trunc((value*10+target*90)/100);
      if(next===target||next===value)return target;
      value=next;
    }
    return time>=2000?target:value;
  }
  function paint(el,n,g) {
    const clock=entry;
    if(!clock)return;
    const age=qmqzMenuFX.start(clock);
    if(n.rewardDelay!==undefined) {
      const delay=n.rewardDelay,duration=delay+500,base=el.style.transform;
      const steps=delay?[{offset:0,transform:base+" scale(0)",easing:"steps(1,end)"}]:[];
      steps.push({offset:delay/duration,transform:base+" scale(4)"},{offset:1,transform:base+" scale(1)"});
      el.style.transformOrigin="0% 50%";
      const animation=el.animate(steps,{duration,fill:"both"});
      animation.currentTime=age;
    }
    if(n.rewardScore){
      const target=Number(n.widget.text);
      function update(){
        const time=qmqzMenuFX.start(clock),value=scoreAt(target,time);
        el.textContent=String(value);
        qmqzFonts.label(el,{...n.widget,text:String(value)},Math.abs(g.sy),n.widget.color);
        if(value!==target)setTimeout(()=>{if(el.isConnected&&entry===clock)update();},Math.max(1,100-time%100));
      }
      update();
    }
  }
  window.qmqzRewardMotion={reset,select,double,attach,paint};
})();
