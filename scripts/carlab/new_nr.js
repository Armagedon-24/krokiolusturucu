nr=({x:r,y:o,width:a,height:u,rad:x,type:i,fill:f,zOffset:g,zHeight:c,rollOver:l})=>{
const d=u>a,t=d?u:a,h=d?a:u,p=d?x-Math.PI/2:x,j=(i||"").toLowerCase();
let m=f||"#3a4046";
j.includes("itfaiye")||j.includes("fire")?m="#cc0000":j.includes("taksi")||j.includes("taxi")?m="#f5c518":(j.includes("polis")||j.includes("police"))&&(m="#0033aa");
const w=j.includes("motor")||j.includes("moto")||j.includes("bisiklet"),
b=j.includes("truck")||j.includes("kamyon")||j.includes("v-truck")||j.includes("itfaiye")||j.includes("kepçe")||j.includes("çekici")||j.includes("traktör"),
n=j.includes("bus")||j.includes("otobüs")||j.includes("v-bus")||j.includes("minibüs"),
k=j.includes("suv")||j.includes("jeep")||j.includes("ambulance")||j.includes("ambulans")||j.includes("police")||j.includes("polis"),
G=j.includes("police")||j.includes("police-car")||j.includes("ambulance")||j.includes("v-police")||j.includes("v-ambulance")||j.includes("ambulans")||j.includes("polis")||j.includes("itfaiye");
const ps=b?300:n?320:w?100:k?165:150,ms=c||ps,H=ms/ps,uu=e*H;
const Mm=20*e*H,$w=20*e*H,Yw=8*e*H;
if(w){const I=Mm+45*e*H+$w;return(0,s.jsxs)("group",{position:[r,g||0,o],rotation:[0,p,0],children:(0,s.jsxs)("group",{position:[0,l?I:0,0],rotation:[l?Math.PI:0,0,0],children:[(0,s.jsxs)("mesh",{position:[-t/3,$w,0],rotation:[Math.PI/2,0,0],castShadow:!0,children:[(0,s.jsx)("cylinderGeometry",{args:[$w,$w,Yw,16]}),(0,s.jsx)("meshStandardMaterial",{color:"#111111",roughness:.9})]}),(0,s.jsxs)("mesh",{position:[t/3,$w,0],rotation:[Math.PI/2,0,0],castShadow:!0,children:[(0,s.jsx)("cylinderGeometry",{args:[$w,$w,Yw,16]}),(0,s.jsx)("meshStandardMaterial",{color:"#111111",roughness:.9})]}),(0,s.jsxs)("mesh",{position:[0,Mm+10*e*H,0],castShadow:!0,children:[(0,s.jsx)("boxGeometry",{args:[t*.7,15*e*H,12*e]}),(0,s.jsx)("meshStandardMaterial",{color:m,metalness:.8,roughness:.2})]}),(0,s.jsxs)("mesh",{position:[-t/10,Mm+18*e*H,0],castShadow:!0,children:[(0,s.jsx)("boxGeometry",{args:[t*.4,4*e*H,10*e]}),(0,s.jsx)("meshStandardMaterial",{color:"#222"})]}),(0,s.jsxs)("mesh",{position:[t/4,Mm+25*e*H,0],rotation:[0,0,-Math.PI/6],castShadow:!0,children:[(0,s.jsx)("cylinderGeometry",{args:[1.5*e,1.5*e,20*e*H]}),(0,s.jsx)("meshStandardMaterial",{color:"#7f8c8d",metalness:.9})]}),(0,s.jsxs)("mesh",{position:[t/4,Mm+35*e*H,0],rotation:[Math.PI/2,0,0],children:[(0,s.jsx)("cylinderGeometry",{args:[1*e,1*e,30*e]}),(0,s.jsx)("meshStandardMaterial",{color:"#222"})]})]})})}
const PM=b?{M:30,R:36,W:22,TH:255}:n?{M:25,R:42,W:22,TH:302}:k?{M:19,R:30,W:17.5,TH:170}:{M:15,R:28,W:17,TH:151};
const shd=(hx,fc)=>{const nn=parseInt(hx.slice(1),16),r2=Math.min(255,Math.round((nn>>16&255)*fc)),g2=Math.min(255,Math.round((nn>>8&255)*fc)),b2=Math.min(255,Math.round((nn&255)*fc));return"#"+((r2<<16)|(g2<<8)|b2).toString(16).padStart(6,"0")};
const mBody=()=>(0,s.jsx)("meshPhysicalMaterial",{color:m,metalness:.15,roughness:.32,clearcoat:.65,clearcoatRoughness:.18});
const mBump=()=>(0,s.jsx)("meshPhysicalMaterial",{color:shd(m,.8),metalness:.15,roughness:.4,clearcoat:.4,clearcoatRoughness:.2});
const mGlass=(0,s.jsx)("meshPhysicalMaterial",{color:"#0e151d",metalness:.05,roughness:.06,clearcoat:1,clearcoatRoughness:.08});
const mTrim=(0,s.jsx)("meshStandardMaterial",{color:"#191c20",roughness:.55,metalness:.25});
const mTire=(0,s.jsx)("meshStandardMaterial",{color:"#151517",roughness:.95});
const mRim=(0,s.jsx)("meshStandardMaterial",{color:"#c9cdd3",metalness:.85,roughness:.28});
const mChrome=(0,s.jsx)("meshStandardMaterial",{color:"#d6dade",metalness:.9,roughness:.18});
const mHead=(0,s.jsx)("meshPhysicalMaterial",{color:"#f3efdc",emissive:"#fff2ac",emissiveIntensity:.75,roughness:.15});
const mTail=(0,s.jsx)("meshPhysicalMaterial",{color:"#a11418",emissive:"#ff2020",emissiveIntensity:.35});
const mPlate=(0,s.jsx)("meshStandardMaterial",{color:"#e8eaee",roughness:.5});
const bx=(sz,pos,mat,cast)=>(0,s.jsxs)("mesh",{position:pos,castShadow:cast!==!1,receiveShadow:!0,children:[(0,s.jsxs)("boxGeometry",{args:sz}),mat]});
const mkSh=st=>{const S=new Vs;for(const q of st){q[0]==="m"?S.moveTo(q[1],q[2]):q[0]==="l"?S.lineTo(q[1],q[2]):S.quadraticCurveTo(q[1],q[2],q[3],q[4])}return S.closePath(),S};
const pf=st=>st.map(q=>q[0]==="q"?["q",q[1]*t,q[2]*uu,q[3]*t,q[4]*uu]:[q[0],q[1]*t,q[2]*uu]);
const ex=(shp,opt,mat,zc)=>(0,s.jsxs)("mesh",{position:[0,0,zc],castShadow:!0,receiveShadow:!0,children:[(0,s.jsxs)("extrudeGeometry",{args:[shp,opt]}),mat]});
const wh=(R2,W2,px,pz)=>{const sp=[];for(let ii=0;ii<5;ii++){const aa=ii/5*Math.PI*2;sp.push((0,s.jsxs)("mesh",{position:[Math.cos(aa)*R2*uu*.3,Math.sin(aa)*R2*uu*.3,0],rotation:[0,0,aa],children:[(0,s.jsx)("boxGeometry",{args:[R2*uu*.48,R2*uu*.085,W2*uu*.34]}),mRim]},ii))}return(0,s.jsxs)("group",{position:[px,R2*uu,pz],rotation:[Math.PI/2,0,0],children:[(0,s.jsxs)("mesh",{castShadow:!0,children:[(0,s.jsx)("cylinderGeometry",{args:[R2*uu,R2*uu,W2*uu,28]}),mTire]}),(0,s.jsxs)("mesh",{children:[(0,s.jsx)("cylinderGeometry",{args:[R2*uu*.58,R2*uu*.58,W2*uu*1.04,24]}),mRim]}),(0,s.jsxs)("mesh",{children:[(0,s.jsx)("cylinderGeometry",{args:[R2*uu*.13,R2*uu*.13,W2*uu*1.12,12]}),mTrim]}),...sp]})};
const wzs=(R2,W2)=>h/2-W2*uu*.3;
const lightbar=(lx,ly)=>(0,s.jsxs)("group",{position:[lx,ly*uu,0],children:[bx([t*.08,4*uu,h*.45],[0,0,0],mTrim),bx([t*.06,3*uu,h*.14],[0,3.5*uu,h*.12],(0,s.jsxs)("meshBasicMaterial",{color:"#0055ff"})),bx([t*.06,3*uu,h*.14],[0,3.5*uu,-h*.12],(0,s.jsx)("meshBasicMaterial",{color:"#ff0000"}))]});
const sedan=()=>(0,s.jsxs)(s.Fragment,{children:[
ex(mkSh(pf([["m",-0.5,16],["l",-0.5,42],["q",-0.5,58,-0.472,66],["q",-0.43,82,-0.36,95],["q",-0.33,100.5,-0.28,101.5],["l",0.16,101],["q",0.225,100,0.27,97],["l",0.445,93],["q",0.49,91.5,0.5,82],["l",0.5,42],["l",0.49,16]])),{depth:h-2,bevelEnabled:!0,bevelSegments:4,steps:1,bevelSize:1.2*uu,bevelThickness:1.2*uu},mBody(),-(h-2)/2),
ex(mkSh(pf([["m",-0.265,99],["l",-0.255,103],["l",-0.185,141],["q",-0.17,144.8,-0.14,145],["l",0.105,145],["q",0.128,144.6,0.138,140.5],["l",0.195,98],["l",0.185,98]])),{depth:h-16*uu,bevelEnabled:!0,bevelSegments:3,steps:1,bevelSize:.8*uu,bevelThickness:.8*uu},mGlass,-(h-16*uu)/2),
ex(mkSh(pf([["m",-0.175,143.5],["l",-0.158,148.8],["l",0.118,148.8],["l",0.132,143.5]])),{depth:h-8*uu,bevelEnabled:!0,bevelSegments:2,steps:1,bevelSize:1.1*uu,bevelThickness:1.1*uu},mBody(),-(h-8*uu)/2),
bx([t*.045,13*uu,h-9*uu],[t*.4935,24*uu,0],mBump()),
bx([t*.04,13*uu,h-9*uu],[-t*.4905,24*uu,0],mBump()),
bx([t*.62,5*uu,(h-2)+1.2*uu],[0,18.5*uu,0],mTrim),
bx([2*uu,11*uu,h*.42],[t*.5+.4*uu,52*uu,0],mTrim),
bx([2.2*uu,8.5*uu,h*.19],[t*.5+.3*uu,66*uu,h*.3],mHead),
bx([2.2*uu,8.5*uu,h*.19],[t*.5+.3*uu,66*uu,-h*.3],mHead),
bx([2.2*uu,9*uu,h*.2],[-t*.487-.3*uu,50*uu,h*.3],mTail),
bx([2.2*uu,9*uu,h*.2],[-t*.487-.3*uu,50*uu,-h*.3],mTail),
bx([1.2*uu,11*uu,h*.24],[-t*.5-.9*uu,38*uu,0],mPlate),
[1,-1].map(ss=>(0,s.jsxs)("group",{position:[t*.175,103*uu,ss*((h-2)/2+5*uu)],children:[bx([4*uu,2.5*uu,6*uu],[0,0,0],mBody()),bx([5*uu,10*uu,13*uu],[0,5*uu,ss*7*uu],mBody())]},ss)),
[1,-1].map(ss=>(0,s.jsxs)(s.Fragment,{children:[bx([.5*uu,27*uu,.5*uu],[t*.055,74*uu,ss*((h-2)/2+.35*uu)],mTrim),bx([7*uu,2.4*uu,1.3*uu],[t*.135,88*uu,ss*((h-2)/2+.8*uu)],mChrome),bx([7*uu,2.4*uu,1.3*uu],[-t*.075,88*uu,ss*((h-2)/2+.8*uu)],mChrome)]},ss)),
wh(28,17,t*.31,wzs(28,17)),wh(28,17,t*.31,-wzs(28,17)),wh(28,17,-t*.31,wzs(28,17)),wh(28,17,-t*.31,-wzs(28,17)),
G&&!n&&lightbar(0,k?172:151)
]});
const suv=()=>(0,s.jsxs)(s.Fragment,{children:[
ex(mkSh(pf([["m",-0.5,19],["l",-0.5,42],["q",-0.5,66,-0.47,78],["l",-0.41,92],["q",-0.38,100,-0.33,103],["l",0.15,103.5],["q",0.21,103,0.26,100.5],["l",0.45,97],["q",0.492,95.5,0.5,88],["l",0.5,42],["l",0.49,19]])),{depth:h-2,bevelEnabled:!0,bevelSegments:4,steps:1,bevelSize:1.2*uu,bevelThickness:1.2*uu},mBody(),-(h-2)/2),
ex(mkSh(pf([["m",-0.335,101],["l",-0.325,105],["l",-0.31,160],["q",-0.305,165.5,-0.275,166],["l",0.01,166],["q",0.045,165.5,0.06,160],["l",0.155,100.5],["l",0.145,101]])),{depth:h-16*uu,bevelEnabled:!0,bevelSegments:3,steps:1,bevelSize:.8*uu,bevelThickness:.8*uu},mGlass,-(h-16*uu)/2),
ex(mkSh(pf([["m",-0.31,163.5],["l",-0.298,169],["l",0.022,169],["l",0.045,163.5]])),{depth:h-8*uu,bevelEnabled:!0,bevelSegments:2,steps:1,bevelSize:1.1*uu,bevelThickness:1.1*uu},mBody(),-(h-8*uu)/2),
bx([t*.04,13*uu,h-9*uu],[t*.4925,27*uu,0],mBump()),
bx([t*.04,13*uu,h-9*uu],[-t*.4925,27*uu,0],mBump()),
bx([t*.6,5.5*uu,(h-2)+1.2*uu],[0,21.5*uu,0],mTrim),
bx([2*uu,11*uu,h*.4],[t*.5+.4*uu,58*uu,0],mTrim),
bx([2.2*uu,9*uu,h*.18],[t*.5+.3*uu,72*uu,h*.29],mHead),
bx([2.2*uu,9*uu,h*.18],[t*.5+.3*uu,72*uu,-h*.29],mHead),
bx([2.2*uu,10*uu,h*.18],[-t*.487-.3*uu,62*uu,h*.29],mTail),
bx([2.2*uu,10*uu,h*.18],[-t*.487-.3*uu,62*uu,-h*.29],mTail),
bx([1.2*uu,11*uu,h*.24],[-t*.5-.9*uu,42*uu,0],mPlate),
[1,-1].map(ss=>(0,s.jsxs)("group",{position:[t*.145,106*uu,ss*((h-2)/2+5*uu)],children:[bx([4*uu,2.5*uu,6*uu],[0,0,0],mBody()),bx([5*uu,10*uu,13*uu],[0,5*uu,ss*7*uu],mBody())]},ss)),
[1,-1].map(ss=>(0,s.jsxs)(s.Fragment,{children:[bx([.5*uu,30*uu,.5*uu],[t*.05,78*uu,ss*((h-2)/2+.35*uu)],mTrim),bx([7*uu,2.4*uu,1.3*uu],[t*.125,95*uu,ss*((h-2)/2+.8*uu)],mChrome),bx([7*uu,2.4*uu,1.3*uu],[-t*.1,95*uu,ss*((h-2)/2+.8*uu)],mChrome)]},ss)),
wh(30,17.5,t*.31,wzs(30,17.5)),wh(30,17.5,t*.31,-wzs(30,17.5)),wh(30,17.5,-t*.31,wzs(30,17.5)),wh(30,17.5,-t*.31,-wzs(30,17.5)),
G&&!n&&lightbar(0,172)
]});
const bus=()=>(0,s.jsxs)(s.Fragment,{children:[
ex(mkSh(pf([["m",-0.5,25],["l",-0.5,272],["q",-0.495,286,-0.47,292],["l",-0.42,300],["l",0.3,300],["q",0.39,299,0.43,288],["q",0.47,262,0.478,230],["q",0.49,205,0.495,180],["l",0.5,25]])),{depth:h-2,bevelEnabled:!0,bevelSegments:4,steps:1,bevelSize:1.4*uu,bevelThickness:1.4*uu},mBody(),-(h-2)/2),
ex(mkSh(pf([["m",-0.43,138],["l",-0.415,232],["l",0.31,232],["q",0.355,230,0.375,205],["l",0.385,140]])),{depth:h+1.4*uu,bevelEnabled:!1},mGlass,-(h+1.4*uu)/2),
(0,s.jsxs)("mesh",{position:[t*.474+.6*uu,202*uu,0],rotation:[0,0,-.08],castShadow:!0,children:[(0,s.jsxs)("boxGeometry",{args:[3*uu,62*uu,h-10*uu]}),mGlass]}),
bx([2.2*uu,9*uu,h*.18],[t*.5+.3*uu,96*uu,h*.3],mHead),
bx([2.2*uu,9*uu,h*.18],[t*.5+.3*uu,96*uu,-h*.3],mHead),
bx([2.2*uu,12*uu,h*.16],[-t*.5-.3*uu,92*uu,h*.3],mTail),
bx([2.2*uu,12*uu,h*.16],[-t*.5-.3*uu,92*uu,-h*.3],mTail),
bx([1.2*uu,11*uu,h*.24],[-t*.5-.9*uu,70*uu,0],mPlate),
wh(42,22,t*.31,wzs(42,22)),wh(42,22,t*.31,-wzs(42,22)),wh(42,22,-t*.31,wzs(42,22)),wh(42,22,-t*.31,-wzs(42,22))
]});
const truck=()=>(0,s.jsxs)(s.Fragment,{children:[
ex(mkSh([["m",-0.5*t,55*uu],["l",0.26*t,55*uu],["l",0.26*t,252*uu],["l",-0.5*t,252*uu]]),{depth:h-8*uu,bevelEnabled:!0,bevelSegments:3,steps:1,bevelSize:1.5*uu,bevelThickness:1.5*uu},mBody(),-(h-8*uu)/2),
bx([t*.92,12*uu,h*.42],[0,44*uu,0],mTrim),
ex(mkSh([["m",0.27*t,46*uu],["l",0.27*t,148*uu],["l",0.3*t,152*uu],["l",0.33*t,206*uu],["q",0.345*t,211*uu,0.38*t,211.5*uu],["l",0.43*t,211*uu],["q",0.47*t,208*uu,0.483*t,192*uu],["l",0.495*t,150*uu],["l",0.5*t,146*uu],["l",0.5*t,46*uu]]),{depth:h-4*uu,bevelEnabled:!0,bevelSegments:3,steps:1,bevelSize:1.2*uu,bevelThickness:1.2*uu},mBody(),-(h-4*uu)/2),
ex(mkSh([["m",0.315*t,150*uu],["l",0.335*t,204*uu],["q",0.35*t,208*uu,0.375*t,208.5*uu],["l",0.42*t,208*uu],["q",0.452*t,205.5*uu,0.462*t,192*uu],["l",0.472*t,150*uu]]),{depth:h-12*uu,bevelEnabled:!1},mGlass,-(h-12*uu)/2),
ex(mkSh([["m",0.335*t,206*uu],["l",0.35*t,210.5*uu],["l",0.425*t,210.5*uu],["l",0.44*t,206*uu]]),{depth:h-6*uu,bevelEnabled:!0,bevelSegments:2,steps:1,bevelSize:1*uu,bevelThickness:1*uu},mBody(),-(h-6*uu)/2),
bx([t*.03,16*uu,h-6*uu],[t*.4965,34*uu,0],mTrim),
bx([t*.03,16*uu,h-6*uu],[-t*.4965,40*uu,0],mTrim),
bx([2*uu,10*uu,h*.16],[t*.5+.3*uu,100*uu,h*.3],mHead),
bx([2*uu,10*uu,h*.16],[t*.5+.3*uu,100*uu,-h*.3],mHead),
bx([2.2*uu,12*uu,h*.16],[-t*.5-.3*uu,120*uu,h*.3],mTail),
bx([2.2*uu,12*uu,h*.16],[-t*.5-.3*uu,120*uu,-h*.3],mTail),
bx([1.2*uu,11*uu,h*.24],[-t*.5-.9*uu,95*uu,0],mPlate),
[1,-1].map(ss=>(0,s.jsxs)("group",{position:[t*.44,178*uu,ss*(h/2+4*uu)],children:[bx([4*uu,3*uu,6*uu],[0,0,0],mTrim),bx([4.5*uu,22*uu,12*uu],[0,11*uu,ss*8*uu],mBody())]},ss)),
wh(36,22,t*.34,wzs(36,22)),wh(36,22,t*.34,-wzs(36,22)),wh(36,22,-t*.26,wzs(36,22)),wh(36,22,-t*.26,-wzs(36,22)),wh(36,22,-t*.44,wzs(36,22)),wh(36,22,-t*.44,-wzs(36,22)),
G&&lightbar(t*.36,216)
]});
const zs=Math.max(100,ms*.7*e),bs=t<zs?zs/t:1,Ms=PM.TH*uu*bs;
return(0,s.jsx)("group",{position:[r,g||0,o],rotation:[0,p,0],children:(0,s.jsx)("group",{position:[0,l?Ms:0,0],rotation:[l?Math.PI:0,0,0],scale:[bs,bs,bs],children:b?truck():n?bus():k?suv():sedan()})})}
