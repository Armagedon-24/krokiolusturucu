# -*- coding: utf-8 -*-
"""
Kroki uygulaması ana chunk (index-BzregFHY.js) yama betiği.
İstekler:
1) Kapı görselleri (Kapı Sağ/Sol, Çift Kapı) varsayılan 60x60 px
2) Kapı çevirince (90° döndür / tutamaç) tam düz durma + yerinde dönme
3) Duvara mıknatıslanma (snap): kapı/pencere/kepenk duvar çizgisine tam düz yapışır
4) PDF dışa aktarmada kayma düzeltmesi (aynalı nesnelerin pivot hatası)
"""
import io, os, shutil, sys

SRC = "/home/z/my-project/scripts/site/assets/index-BzregFHY.js"
BAK = "/home/z/my-project/scripts/site/assets/index-BzregFHY.orig.js"

with io.open(SRC, encoding="utf-8") as f:
    data = f.read()

orig_len = len(data)

# ---------- yedek ----------
if not os.path.exists(BAK):
    shutil.copyfile(SRC, BAK)
    print("yedek alindi:", BAK)

patches = []

def P(name, old, new):
    patches.append((name, old, new))

# ============ P1: sembol tanimlarina width/height 60 ============
P("P1a-d1r-def",
  'type:"symbol",description:"Sağ yöne açılan standart oda kapısı.',
  'type:"symbol",width:60,height:60,description:"Sağ yöne açılan standart oda kapısı.')
P("P1b-d1l-def",
  'type:"symbol",description:"Sol yöne açılan standart oda kapısı.',
  'type:"symbol",width:60,height:60,description:"Sol yöne açılan standart oda kapısı.')
P("P1c-d2-def",
  'type:"symbol",description:"Geniş girişler için çift kanatlı kapı şeması."',
  'type:"symbol",width:60,height:60,description:"Geniş girişler için çift kanatlı kapı şeması."')

# ============ P2: snmK yardimci fonksiyonu (mıknatıs matematiği) ============
snmK = (
 ',snmK=(sym,xp,yp,wv,hv,rv,objs,skipId,anchorMode)=>{'
 'if(!sym||!objs||!ws.includes(sym))return null;'
 'const DD=["arch-d1r","arch-d1l","arch-d2","arch-garden-gate"].includes(sym),'
 'ay=DD?0.925:0.5,axp=wv/2,ayp=hv*ay,rr=(rv||0)*Math.PI/180,'
 'fx=anchorMode?xp:xp+axp*Math.cos(rr)-ayp*Math.sin(rr),'
 'fy=anchorMode?yp:yp+axp*Math.sin(rr)+ayp*Math.cos(rr);'
 'let best=null,bd=1e9;'
 'for(const S of objs){'
 'if(!S||S.id===skipId||S.hidden||S.isTemplate)continue;'
 'if(!ba.includes(S.symbolId||"")||S.symbolId==="arch-w-square")continue;'
 'const sw=Number(S.width)||0,sh=Number(S.height)||0;'
 'if(!sw||!sh)continue;'
 'const sr=(Number(S.rotation)||0)*Math.PI/180,vert=sh>sw,phi=sr+(vert?Math.PI/2:0),len=Math.max(sw,sh),'
 'cx=S.x+sw/2*Math.cos(sr)-sh/2*Math.sin(sr),cy=S.y+sw/2*Math.sin(sr)+sh/2*Math.cos(sr),'
 'dx=fx-cx,dy=fy-cy,ux=Math.cos(phi),uy=Math.sin(phi),nx=-uy,ny=ux,'
 't=dx*ux+dy*uy,p=dx*nx+dy*ny,over=Math.max(0,Math.abs(t)-len/2);'
 'if(Math.abs(p)>=30||over>=40)continue;'
 'const dist=Math.hypot(over,p);'
 'if(dist<bd){bd=dist,best={phi:phi,t:t,len:len,cx:cx,cy:cy,ux:ux,uy:uy}}}'
 'if(!best)return null;'
 'const tc=Math.max(-best.len/2,Math.min(best.len/2,best.t)),'
 'pX=best.cx+best.ux*tc,pY=best.cy+best.uy*tc;'
 'let nd=((best.phi*180/Math.PI)%360+360)%360;'
 'const cur=((rv||0)%360+360)%360;'
 'let d1=Math.abs(nd-cur)%360,d2=Math.abs((nd+180)%360-cur)%360;'
 'd1=Math.min(d1,360-d1),d2=Math.min(d2,360-d2);'
 'if(d2<d1)nd=(nd+180)%360;'
 'const nr=nd*Math.PI/180;'
 'return{rotation:nd,x:pX-(axp*Math.cos(nr)-ayp*Math.sin(nr)),y:pY-(axp*Math.sin(nr)+ayp*Math.cos(nr))}}'
)
P("P2-snmK-insert",
  ',ba=["arch-w1","arch-w1v","arch-w1i","arch-w1vi","arch-w-square","arch-garden-wall","arch-parapet"],fr=',
  ',ba=["arch-w1","arch-w1v","arch-w1i","arch-w1vi","arch-w-square","arch-garden-wall","arch-parapet"]' + snmK + ',fr=')

# ============ P3: _s onDragMove -> tam mıknatıs (konum + açı) ============
P("P3-drag-snap",
  'if(h)for(const S of l){if(S.id===e.id||!ba.includes(S.symbolId||""))continue;const D=I-S.x,B=F-S.y;if(Math.sqrt(D*D+B*B)<100){const $=S.symbolId?.includes("v"),se=((S.rotation||0)+($?90:0))%360,G=((m.target.rotation()%360+360)%360-se+360)%360;let ie=se;G>90&&G<270&&(ie=(se+180)%360),m.target.rotation(ie);break}}',
  'if(h){const snN=snmK(e.symbolId||"",I,F,Number(e.width)||60,Number(e.height)||60,m.target.rotation()||0,l,e.id,0);if(snN){m.target.rotation(snN.rotation),m.target.x(snN.x),m.target.y(snN.y)}}')

# ============ P4: Transformer açı tutamaçı 45° adımlarına otursun ============
P("P4-rot-snaps",
  '(0,t.jsx)("Transformer",{ref:f,rotateEnabled:e.type!=="rect"&&e.type!=="line"&&!["arch-1","arch-1v"].includes(e.symbolId||""),enabledAnchors:',
  '(0,t.jsx)("Transformer",{ref:f,rotationSnaps:ws.includes(e.symbolId||"")?[0,45,90,135,180,225,270,315]:[],rotationSnapTolerance:14,rotateEnabled:e.type!=="rect"&&e.type!=="line"&&!["arch-1","arch-1v"].includes(e.symbolId||""),enabledAnchors:')

# ============ P5: 90 Derece Döndür düğmesi: yerinde pivot ============
P("P5-rotate90-pivot",
  'onClick:()=>o(i,{rotation:((y.rotation||0)+90)%360})',
  'onClick:()=>{const qW=y.width||60,qH=y.height||60,qS=y.symbolId||"",qD=["arch-d1r","arch-d1l","arch-d2","arch-garden-gate"].includes(qS),qA=qD?qH*.925:qH/2,q0=((y.rotation||0)%360+360)%360,q1=(q0+90)%360,a0=q0*Math.PI/180,a1=q1*Math.PI/180,qC=qW/2,qDX=(qC*Math.cos(a0)-qA*Math.sin(a0))-(qC*Math.cos(a1)-qA*Math.sin(a1)),qDY=(qC*Math.sin(a0)+qA*Math.cos(a0))-(qC*Math.sin(a1)+qA*Math.cos(a1));o(i,{rotation:q1,x:(y.x||0)+qDX,y:(y.y||0)+qDY})}')

# ============ P6: palet tık yolunda kapı boyu 60 + yerleştirme snap ============
P("P6a-click-size",
  'let V=E.id==="arch-d2"?120:L?60:E.width||100,ne=L?60:E.height||100;',
  'let V=L?60:E.width||100,ne=L?60:E.height||100;')
P("P6b-click-snap",
  'const W=_e();d({...E,symbolId:E.id,id:W,x:he,y:De,width:V,height:ne,rotation:0,scaleX:1,scaleY:1,distanceColor:"#000000",zIndex:e.length}),E.id==="ev-shooting-trajectory"&&va(W)}',
  '{const snP=snmK(E.id||"",he+V/2,De+ne/2,V,ne,0,e,void 0,1),snR=snP?snP.rotation:0;if(snP)he=snP.x,De=snP.y;const W=_e();d({...E,symbolId:E.id,id:W,x:he,y:De,width:V,height:ne,rotation:snR,__skipGrid:snP?1:void 0,scaleX:1,scaleY:1,distanceColor:"#000000",zIndex:e.length}),E.id==="ev-shooting-trajectory"&&va(W)}}')

# ============ P7: surukle-birak yolunda yerlestirme snap ============
P("P7-drop-snap",
  'V=Math.max(x.y,Math.min(V,x.y+x.height-R))),d({...E,symbolId:E.id,categoryId:E.categoryId||"architecture",id:_e(),fill:"#000000",x:me,y:V,width:L,height:R,rotation:0,scaleX:1,scaleY:1})',
  'V=Math.max(x.y,Math.min(V,x.y+x.height-R)));const snP2=snmK(E.id||"",me+L/2,V+R/2,L,R,0,e,void 0,1),snR2=snP2?snP2.rotation:0;if(snP2)me=snP2.x,V=snP2.y;d({...E,symbolId:E.id,categoryId:E.categoryId||"architecture",id:_e(),fill:"#000000",x:me,y:V,width:L,height:R,rotation:snR2,__skipGrid:snP2?1:void 0,scaleX:1,scaleY:1})')

# ============ P8: PDF pivot duzeltmesi (aynali nesne kaymasi) ============
P("P8-pdf-pivot",
  'Tt!==0||St!==0||jt!==0?(tt.translate(Ue+St,Qe+jt),tt.rotate(Tt),tt.scale(We.scaleX??1,We.scaleY??1),tt.translate(-St,-jt)):(tt.translate(Ue,Qe),tt.scale(We.scaleX??1,We.scaleY??1))',
  'Tt!==0||St!==0||jt!==0?(tt.translate(Ue,Qe),tt.rotate(Tt),tt.scale(We.scaleX??1,We.scaleY??1),tt.translate(-St,-jt)):(tt.translate(Ue,Qe),tt.scale(We.scaleX??1,We.scaleY??1))')

# ============ P9: PDF kapı beyaz kasası (dikey aynada konum) ============
P("P9-pdf-door-frame",
  'if(l==="arch-d1r"||l==="arch-d1l"||l==="arch-d2"){e.fillStyle="#ffffff",e.fillRect(0,i*.85,n,i*.15),a.src&&s&&e.drawImage(s,0,0,n,i);return}',
  'if(l==="arch-d1r"||l==="arch-d1l"||l==="arch-d2"){e.fillStyle="#ffffff",e.fillRect(0,a.scaleY===-1?0:i*.85,n,i*.15),a.src&&s&&e.drawImage(s,0,0,n,i);return}')

# ============ P14: prosedürel semboller (kepenk/bahçe kapısı vb.) aynalama ============
P("P14-pr-flip",
  'Ra.includes(e.symbolId||"")?(0,t.jsx)(pr,{symbolId:e.symbolId||"",width:e.width,height:e.height})',
  'Ra.includes(e.symbolId||"")?(0,t.jsx)(re,{scaleX:e.scaleX||1,scaleY:e.scaleY||1,offsetX:e.scaleX===-1?e.width:0,offsetY:e.scaleY===-1?e.height:0,children:(0,t.jsx)(pr,{symbolId:e.symbolId||"",width:e.width,height:e.height})})')

# ============ P15: test kancalari (store + stage, Canvas icinde) ============
P("P15b-stage-hook",
  'qe.setState({exportPDFRef:y}),window.addEventListener("export-pdf",y);',
  'qe.setState({exportPDFRef:y}),window.addEventListener("export-pdf",y),window.__krokiStage=Re.current,window.__krokiStore=qe;')

# ============ P17: addObject 20px ızgarası — snap'li nesnede atlanır ============
P("P17-addobject-grid",
  'const k=20;l.x=Math.round((l.x-o.x)/k)*k+o.x,l.y=Math.round((l.y-o.y)/k)*k+o.y;',
  'const k=20,snG=!!l.__skipGrid;delete l.__skipGrid;if(!snG){l.x=Math.round((l.x-o.x)/k)*k+o.x,l.y=Math.round((l.y-o.y)/k)*k+o.y}')

# ============ P16: palet tik yerlestirmesi: cift kapi 60x60 + snap ============
P("P16-palette-click",
  'let At=ce.id==="arch-d2"?120:we?60:ce.width||100,Ct=we?60:ce.height||100;xt?(At=50,Ct=10):Ft&&(ce.id==="arch-w1"?(At=200,Ct=10):ce.id==="arch-w1v"?(At=10,Ct=200):ce.id==="arch-w1i"?(At=250,Ct=10):ce.id==="arch-w1vi"&&(At=10,Ct=250)),l({...ce,symbolId:ce.id,categoryId:U.id,id:_e(),x:250,y:250,width:At,height:Ct,distanceColor:"#000000"})',
  'let At=we?60:ce.width||100,Ct=we?60:ce.height||100;xt?(At=50,Ct=10):Ft&&(ce.id==="arch-w1"?(At=200,Ct=10):ce.id==="arch-w1v"?(At=10,Ct=200):ce.id==="arch-w1i"?(At=250,Ct=10):ce.id==="arch-w1vi"&&(At=10,Ct=250));const snP3=snmK(ce.id||"",250+At/2,250+Ct/2,At,Ct,0,qe.getState().objects,void 0,1),snX3=snP3?snP3.x:250,snY3=snP3?snP3.y:250,snR3=snP3?snP3.rotation:0;l({...ce,symbolId:ce.id,categoryId:U.id,id:_e(),x:snX3,y:snY3,width:At,height:Ct,rotation:snR3,__skipGrid:snP3?1:void 0,distanceColor:"#000000"})')

# ---------- uygula ----------
applied = 0
for name, old, new in patches:
    n = data.count(old)
    if n != 1:
        print("HATA: %s -> %d eslesme (1 olmali). Betik durduruldu." % (name, n))
        sys.exit(1)
    data = data.replace(old, new)
    applied += 1
    print("uygulandi: %s (+%d karakter)" % (name, len(new) - len(old)))

with io.open(SRC, "w", encoding="utf-8") as f:
    f.write(data)

print("TOPLAM: %d yama uygulandi, boyut %d -> %d" % (applied, orig_len, len(data)))
