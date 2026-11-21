(() => {
  "use strict";
  let selectedId, listTop=0, bodyTop=0, listLimit=0, bodyLimit=0;
  function open(openDialog) {
    selectedId=null;
    listTop=bodyTop=0;
    openDialog("Annoncement");
  }
  async function display(nodes,h) {
    const [template,cell,boards]=await Promise.all([h.data("Annoncement"),h.data("AnnounceCell"),h.data("announcements")]);
    const overlay=template.filter(n=>!h.nodeById(nodes,n.id)).map(n=>({...n,overlay:true}));
    const at=id=>h.nodeById(overlay,id);
    const current=boards.find(b=>b.id===selectedId)||boards[0];
    const grid=at(4598), list=at(8097), body=at(7823);
    at(419).active=true;
    at(6145).action=h.closeDialog;
    at(4112).active=false;
    at(8635).active=true;
    grid.p=[grid.p[0],grid.p[1]+listTop];
    listLimit=Math.max(0,boards.length*grid.cellHeight-list.clip[3]);
    h.label(overlay,7482,current.title);
    h.label(overlay,2450,current.content.replaceAll("\\n","\n"));
    const words=at(2450);
    const textHeight=qmqzFonts.labelHeight(words.widget,words.s[1]);
    const viewHeight=body.clip[3];
    bodyLimit=Math.max(0,textHeight-viewHeight);
    // The original DraggableLabel starts at the upper edge of its 350-unit clip rectangle.
    words.widget={...words.widget,pivot:0};
    words.p=[words.p[0],body.clip[1]+viewHeight/2+bodyTop];
    const bar=at(8395),track=at(1376), fraction=Math.min(1,viewHeight/Math.max(1,textHeight));
    at(51).active=bodyLimit>0;
    bar.s=[bar.s[0],track.s[1]*fraction];
    bar.p=[bar.p[0],-track.s[1]*(1-fraction)*(bodyLimit?bodyTop/bodyLimit:0)];
    const jump=at(1053);
    jump.active=Boolean(current.window||current.dialog);
    jump.action=()=>{
      if(current.window==="RechargeWindow")qmqzStore.recharge(h.go,"MainUI");
      else if(current.window==="ActivityForm")qmqzPosters.destination(current.window,h.go);
      else if(current.dialog)h.openDialog(current.dialog);
    };
    boards.forEach((board,i)=>{
      const prefix="notice"+board.id+"-", selected=board.id===current.id;
      const row=h.clonePrefab(cell,prefix,grid.id,-i*grid.cellHeight,{1141:board.name},{
        label:board.name,action:()=>{selectedId=board.id;bodyTop=0;h.render();}
      });
      for(const [id,key] of [[1209,selected?"BTN_Friend":"BTN_Friend2"],[977,["AW_New","AW_Hot","AW_Now","AW_Buy"][board.state]],
                            [1066,board.type===0?"AW_Annoncement":"AW_Activity"]]) {
        const w=h.nodeById(row,prefix+id).widget;
        h.picture(row,prefix+id,w.variants[key]);
      }
      const title=h.nodeById(row,prefix+1141);
      title.widget={...title.widget,shadow:selected?[0,75,100,255]:[198,96,29,255]};
      overlay.push(...row);
    });
    nodes.push(...overlay);
  }
  function scroll(key,value) {
    if(key==="noticeList")listTop=Math.max(0,Math.min(listLimit,value));
    else bodyTop=Math.max(0,Math.min(bodyLimit,value));
  }
  window.qmqzAnnouncements={open,display,scroll,offset:key=>key==="noticeList"?listTop:bodyTop};
})();
