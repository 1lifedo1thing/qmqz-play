// A synchronous call preserves Unity's current combat update ordering. Import and unzip only on entering the supported room.
(() => {
  let phase=0, role=0, invoke, profile, failure='',reported=false;
  const emit=(name,data)=>window.dispatchEvent(new CustomEvent(name,{detail:data}));
  async function start(roleId) {
    const before=performance.now();
    try {
      const root=new URL('StreamingAssets/rules/',document.baseURI);
      const [{loadPyodide},archive]=await Promise.all([import(new URL('pyodide.js',root)),fetch(new URL('game.zip',root))]);
      if(!archive.ok)throw Error('无法读取对战规则');
      const py=await loadPyodide({indexURL:root.href});
      py.unpackArchive(await archive.arrayBuffer(),'zip',{extractDir:'/normal-game'});
      py.runPython("import sys; sys.path.insert(0, '/normal-game'); from normal_judge import command, prepare; prepare()");
      invoke=py.globals.get('command');profile=await qmqzReadCombatTraits(roleId);role=roleId;phase=2;
      emit('qmqz-original-combat-ready',{duration:performance.now()-before,heapBytes:py._module?.HEAP8?.byteLength||0});
    } catch(error) { failure=String(error);phase=-1;reported=false;console.error(error); }
  }
  window.qmqzNormalJudge={ready(roleId){
    if(phase<0){if(!reported){reported=true;return -1;}phase=0;}
    if(phase===0){phase=1;start(roleId);}
    else if(phase===2 && role!==roleId){phase=1;qmqzReadCombatTraits(roleId).then(v=>{profile=v;role=roleId;phase=2;},e=>{failure=String(e);phase=-1;});}
    return phase;
  },call(raw){
    let msg;
    try {
      msg=JSON.parse(raw);
      if(msg.op==='open')msg.traits=profile;
      const before=performance.now(),reply=JSON.parse(invoke(JSON.stringify(msg)));
      if(msg.op==='close')role=0;
      emit('qmqz-original-combat',{...reply,ms:performance.now()-before,ammo:msg.ammo,distance:msg.distance});
      return JSON.stringify(reply);
    } catch(error) {console.error('原规则裁决失败',error);return JSON.stringify({ok:false,error:String(error)});}
  },get error(){return failure;}};
})();
