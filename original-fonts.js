(() => {
  "use strict";
  const root = "original-ui/", baseId = 1586281874;
  const pages = new Map(), tinted = new Map(), advances = new Map();
  const measure = document.createElement("canvas").getContext("2d");
  let fonts, pending;
  function load() {
    if (!pending) pending = (async () => {
      const response = await fetch(root + "fonts.json");
      if (!response.ok) throw Error(response.url);
      fonts = await response.json();
      const families = new Set(), files = new Set();
      for (const font of Object.values(fonts)) {
        if (font.family) families.add(cssFont(font, font.size));
        else files.add(font.page);
      }
      await Promise.all([...Array.from(families, family => document.fonts.load(family)),
        ...Array.from(files, async file => {
          const img = new Image();
          img.src = root + file;
          await img.decode();
          pages.set(file, img);
        })]);
    })().catch(error => { pending = null; throw error; });
    return pending;
  }
  function cssFont(font, size) {
    const style = ["", "bold ", "italic ", "italic bold "][font.style] || "";
    return style + size + "px Original" + font.family + ", OriginalMYH, sans-serif";
  }
  const original = widget => fonts[widget.font] || fonts[baseId];
  const rgb = c => "rgb(" + c.slice(0,3).join(",") + ")";
  function page(font, color) {
    const source = pages.get(font.page);
    if (color[0] === 255 && color[1] === 255 && color[2] === 255) return source;
    const key = font.page + ":" + color.slice(0,3).join(",");
    if (!tinted.has(key)) {
      const surface = document.createElement("canvas");
      surface.width = source.width; surface.height = source.height;
      const c = surface.getContext("2d",{willReadFrequently:true});
      c.drawImage(source,0,0);
      const pixels=c.getImageData(0,0,surface.width,surface.height);
      for (let i=0;i<pixels.data.length;i+=4)
        for (let channel=0;channel<3;channel++) pixels.data[i+channel]*=color[channel]/255;
      c.putImageData(pixels,0,0);
      tinted.set(key,surface);
      if (tinted.size > 48) tinted.delete(tinted.keys().next().value);
    }
    return tinted.get(key);
  }
  function tokens(text, encoding, base) {
    const result = [], stack = [base];
    let tagged = false;
    for (const part of (encoding === false ? [text] : text.split(/(\[(?:[\da-f]{6}|-)\])/ig))) {
      if (encoding !== false && part === "[-]") { if (stack.length > 1) stack.pop(); tagged=true; continue; }
      if (encoding !== false && /^\[[\da-f]{6}\]$/i.test(part)) {
        stack.push([1,3,5].map(i => parseInt(part.slice(i,i+2),16)).concat(base[3]));
        tagged=true;
        continue;
      }
      for (const char of part) result.push({char, color:stack.at(-1),tagged});
    }
    return result;
  }
  function metrics(font, char) {
    const type = cssFont(font,font.size), key = type + char;
    if (!advances.has(key)) {
      measure.font = type;
      const m=measure.measureText(char);
      advances.set(key,{advance:Math.trunc(m.width+.0001),up:m.actualBoundingBoxAscent,down:m.actualBoundingBoxDescent});
    }
    return advances.get(key);
  }
  function kern(glyph, previous) {
    const values = glyph?.[7];
    if (values) for (let i=0;i<values.length;i+=2) if (values[i] === previous) return values[i+1];
    return 0;
  }
  function compose(widget, text, size, color) {
    const font = original(widget), scale = size / font.size;
    const lines = [{width:0, chars:[]}], step = font.size + font.spacing[1];
    const limit = widget.maxWidth > 0 ? widget.maxWidth / scale : Infinity;
    let row = lines[0], previous = 0;
    function newline() {
      if (widget.maxLines > 0 && lines.length >= widget.maxLines) return false;
      row = {width:0,chars:[]}; lines.push(row); previous = 0; return true;
    }
    for (const token of tokens(String(text),widget.encoding,color)) {
      if (token.char === "\n") { if (!newline()) break; continue; }
      const cp = token.char.codePointAt(0);
      if (cp < 32) continue;
      const glyph = font.glyphs?.[cp];
      if (font.page && !glyph) continue;
      const metric = glyph ? null : metrics(font,token.char);
      const spacing = font.spacing[0] + (glyph ? glyph[6] : metric.advance);
      let pair = kern(glyph,previous);
      if (row.chars.length && row.width + pair + spacing > limit) {
        if (!newline()) break;
        pair = 0;
      }
      row.width += pair;
      row.chars.push({...token, glyph, metric, x:row.width});
      row.width += spacing; previous = cp;
    }
    const logical = Math.max(0,...lines.map(l=>l.width)) * scale;
    return {font, scale, lines, step, width:widget.clipLine ? Math.min(logical,widget.maxWidth) : logical,
      height:lines.length*step*scale};
  }
  function paint(ctx, block, widget, shadow, foot, visible=Infinity) {
    const {font,scale,lines,step,width,height} = block, px = (widget.pivot%3)*.5, py = Math.floor(widget.pivot/3)*.5;
    // UILabel.Awake replaces Color.clear with the label's own color.
    if (foot && foot.every(component=>component===0)) foot=null;
    ctx.save();
    ctx.translate(-width*px,-height*py);
    if (widget.clipLine) { ctx.beginPath();ctx.rect(0,-font.size*scale,width,height+font.size*2*scale);ctx.clip(); }
    ctx.scale(scale,scale);
    const offsets = [[0,0,null]];
    if (widget.effect && shadow) {
      const [x,y] = widget.distance || [1,1];
      if (widget.effect === 2) offsets.unshift([x,y,shadow],[-x,y,shadow],[x,-y,shadow],[-x,-y,shadow]);
      else offsets.unshift([x,y,shadow]);
    }
    if (!font.page) { ctx.font=cssFont(font,font.size);ctx.textAlign="left";ctx.textBaseline="alphabetic"; }
    const alpha = ctx.globalAlpha;
    for (const [dx,dy,override] of offsets) {
      let index=0;
      lines.forEach((line,i) => {
        const left=(width/scale-line.width)*px+dx, top=i*step+dy;
        for (const item of line.chars) {
          if(index++>=visible)break;
          const color=override || item.color, g=item.glyph;
          ctx.globalAlpha=alpha*color[3]/255;
          if (g) {
            if (!g[2] || !g[3]) continue;
            const [u,v,uw,vh]=font.uv, source=page(font,color);
            const sx=source.width*uw/font.atlas[0], sy=source.height*vh/font.atlas[1];
            ctx.drawImage(source,source.width*u+g[0]*sx,source.height*(1-v-vh)+g[1]*sy,g[2]*sx,g[3]*sy,
              left+item.x+g[4],top+g[5],g[2],g[3]);
          } else {
            const baseline=top+font.ascent+font.offset;
            if (foot && !override && !item.tagged && item.metric.up+item.metric.down>0) {
              const ramp=ctx.createLinearGradient(0,baseline-item.metric.up,0,baseline+item.metric.down);
              ramp.addColorStop(0,"rgba("+color.slice(0,3).join(",")+","+color[3]/255+")");
              ramp.addColorStop(1,"rgba("+foot.slice(0,3).join(",")+","+foot[3]/255+")");
              ctx.fillStyle=ramp;
              ctx.globalAlpha=alpha;
            } else ctx.fillStyle=rgb(color);
            ctx.fillText(item.char,left+item.x,baseline);
          }
        }
      });
    }
    ctx.restore();
  }
  function decorateInput(element,widget,size) {
    const font = original(widget);
    element.style.font = cssFont(font,size);
    element.style.lineHeight = size*(font.size+font.spacing[1])/font.size+"px";
    element.style.letterSpacing = size*font.spacing[0]/font.size+"px";
    element.dataset.font = font.name;
  }
  function label(element,widget,size,color) {
    const block=compose(widget,widget.text,size,color), px=(widget.pivot%3)*.5, py=Math.floor(widget.pivot/3)*.5;
    element.dataset.font=block.font.name;
    element.style.width=block.width+"px"; element.style.height=block.height+"px";
    const text=document.createElement("span");
    text.className="ngui-glyph-text";
    text.append(...element.childNodes);
    element.append(text);
    const surface=document.createElement("canvas");
    surface.setAttribute("aria-hidden","true");
    const pad=Math.ceil(size*.5)+2, w=Math.ceil(block.width)+2*pad, h=Math.ceil(block.height)+2*pad;
    const density=Math.min(3,Math.max(1,window.devicePixelRatio||1));
    surface.width=Math.ceil(w*density); surface.height=Math.ceil(h*density);
    Object.assign(surface.style,{position:"absolute",left:-pad+"px",top:-pad+"px",width:w+"px",height:h+"px"});
    const ctx=surface.getContext("2d");
    ctx.scale(surface.width/w,surface.height/h);ctx.translate(pad+block.width*px,pad+block.height*py);
    element.append(surface);
    const count=block.lines.reduce((sum,line)=>sum+line.chars.length,0);
    if(!widget.printClock || !count || matchMedia("(prefers-reduced-motion: reduce)").matches) {
      paint(ctx,block,widget,widget.shadow,widget.foot);
      return;
    }
    // PrintText.Reset waits 0.3 seconds, then reveals one processed character per interval.
    const drawNext=()=>{
      const age=qmqzMenuFX.start(widget.printClock);
      const visible=Math.max(0,Math.min(count,1+Math.floor((age-300)/30)));
      ctx.clearRect(-pad-block.width*px,-pad-block.height*py,w,h);
      paint(ctx,block,widget,widget.shadow,widget.foot,visible);
      if(visible<count)setTimeout(()=>{if(element.isConnected)drawNext();},Math.max(1,300+visible*30-age));
    };
    drawNext();
  }
  function draw(ctx,widget,text,size,color) {
    const bytes = value => value.map(n=>Math.round(n*255));
    // UILabel.set_color sets both endpoints for a runtime color change.
    const foot=widget.foot && color.every((v,i)=>v===widget.color[i]) ? bytes(widget.foot) : null;
    paint(ctx,compose(widget,text,size,bytes(color)),widget,widget.effectColor && bytes(widget.effectColor),foot);
  }
  window.qmqzFonts={load,label,draw,decorateInput,
    labelHeight:(widget,size)=>compose(widget,widget.text,size,widget.color).height};
})();
