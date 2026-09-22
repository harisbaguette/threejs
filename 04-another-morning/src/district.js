import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

function builder(group) {
  const obstacles=[],cameraWalls=[];
  const mat=(color,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness});
  function box(w,h,d,x,y,z,material,rounded=false,solid=false) {
    const o=new THREE.Mesh(rounded?new RoundedBoxGeometry(w,h,d,2,Math.min(.08,h/3)):new THREE.BoxGeometry(w,h,d),material);
    o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;group.add(o);
    if(solid){obstacles.push({x,z,w,d});cameraWalls.push(o);}return o;
  }
  function cyl(r1,r2,h,x,y,z,material) {
    const o=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,16),material);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;group.add(o);return o;
  }
  function sign(text,x,y,z,w,h,bg='#f0e8dc',fg='#292b27',rotation=0) {
    const c=document.createElement('canvas');c.width=1024;c.height=256;
    const ctx=c.getContext('2d');ctx.fillStyle=bg;ctx.fillRect(0,0,c.width,c.height);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='500 88px "Malgun Gothic", sans-serif';ctx.fillText(text,512,130,950);
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;
    const o=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshStandardMaterial({map:t,roughness:.8}));o.position.set(x,y,z);o.rotation.y=rotation;group.add(o);return o;
  }
  function tree(x,z) {
    cyl(.09,.15,2.3,x,1.15,z,mat('#685443'));
    const leaf=mat('#668268');
    for(let i=0;i<5;i++) {
      const o=new THREE.Mesh(new THREE.IcosahedronGeometry(.68+i%2*.2,2),leaf);o.position.set(x+Math.sin(i*2)*.4,2.2+i%3*.32,z+Math.cos(i*2)*.3);o.castShadow=true;group.add(o);
    }
    box(1.1,.12,1.1,x,.06,z,mat('#a4a093'));obstacles.push({x,z,w:.6,d:.6});
  }
  return {box,cyl,sign,tree,mat,obstacles,cameraWalls};
}

export function createDistrict(group) {
  const {box,cyl,sign,tree,mat,obstacles,cameraWalls}=builder(group);
  const pavement=mat('#b9b6aa'),asphalt=mat('#535a5a'),wood=mat('#795e47'),glass=mat('#86a1a2',.19,.2),cream=mat('#eee6d8'),dark=mat('#303b36'),brick=mat('#9d725d');
  box(29,.18,65,0,-.13,0,pavement);box(7,.025,65,0,-.024,0,asphalt);
  for(let z=-31;z<32;z+=.85)for(const x of [-7,7])box(6.5,.005,.014,x,.007,z,mat('#a8a79d'));
  for(const x of [-3.65,3.65])box(.24,.12,65,x,.005,0,cream);
  for(let z=-29;z<30;z+=4)box(.085,.006,1.7,0,.006,z,mat('#e1c174'));
  for(const crossing of [-13,10])for(let x=-2.8;x<3;x+=.72)box(.44,.01,2.5,x,.018,crossing,cream);
  for(const side of [-1,1])for(let i=0;i<7;i++) {
    const z=-26+i*8, x=side*13.4, height=7+(i%3)*2.4;
    box(7,height,7.5,x,height/2,z,i%2?cream:brick,false,true);
    // Recessed storefronts with visible glazing, mullions, canopies, and upper balconies.
    box(.1,2.7,6.6,side*9.84,1.5,z,glass);
    for(const dz of [-3.2,-1.05,1.05,3.2])box(.18,2.9,.07,side*9.74,1.45,z+dz,dark);
    box(1.4,.15,7,side*9.3,3.15,z,wood);
    for(let level=4.4;level<height-.5;level+=2.2)for(const dz of [-2.3,0,2.3]) {
      box(.06,1.3,1.6,side*9.84,level,z+dz,glass);
      box(.4,.12,1.9,side*9.58,level-.74,z+dz,cream);
    }
    const names=side<0?['서연의 집','작은 책방','모닝 커피','꽃, 하루','연남 사진관','일상 잡화','동네 베이커리']:['온도 편집숍','옷의 취향','오늘의 향','느린 오후','초록 화원','한 장의 기록','골목 식탁'];
    sign(names[i],side*9.65,2.75,z,4.5,.65,'#f0e8dc','#303b36',-side*Math.PI/2);
  }
  // Doorway and special shop facades aligned to reachable interaction points.
  sign('302  ·  서연의 집',-9.63,1.95,-23.5,2,.35,'#303b36','#f0e8dc',Math.PI/2);
  sign('MORNING COFFEE',-9.62,2.6,-10,5,.6,'#374f45','#f5f0e8',Math.PI/2);
  sign('온도  /  옷의 취향',9.62,2.6,-18,4.7,.6,'#8e6050','#fff5e5',-Math.PI/2);
  // Shop-window reflection is a true reflector, with a full-body view from the pavement.
  box(.15,2.8,2.0,9.72,1.45,1.8,wood);
  const mirror=new Reflector(new THREE.PlaneGeometry(1.85,2.55),{color:0xbebebe,textureWidth:768,textureHeight:1024,clipBias:.003});
  mirror.rotation.y=-Math.PI/2;mirror.position.set(9.62,1.45,1.8);group.add(mirror);
  sign('오늘의 나',9.6,2.9,1.8,1.5,.3,'#303b36','#f0e8dc',-Math.PI/2);
  for(const x of [-5.1,5.1])for(const z of [-27,-16,-3,13,25])tree(x,z);
  for(const x of [-7.5,7.5])for(const z of [6,22]) {
    box(.65,.1,2.2,x,.46,z,wood,true,true);box(.12,.75,2.25,x+Math.sign(x)*.27,.67,z,wood,true);
    for(const dz of [-.8,.8])box(.4,.43,.06,x,.215,z+dz,dark);
  }
  for(const z of [-25,-5,18,29])for(const x of [-3.95,3.95]) {
    cyl(.035,.065,3.8,x,1.9,z,dark);cyl(.23,.15,.16,x,3.75,z,cream);
  }
  for(const [x,z,color] of [[-2.3,-22,'#677b79'],[2.3,0,'#efe8dd'],[-2.3,21,'#444b53']]) {
    const paint=mat(color,.3,.5);box(1.7,.7,3.4,x,.6,z,paint,true,true);box(1.45,.65,1.9,x,1.19,z-.15,glass,true);
    for(const dx of [-.85,.85])for(const dz of [-1.05,1.05]){const tire=cyl(.29,.29,.2,x+dx,.3,z+dz,dark);tire.rotation.z=Math.PI/2;}
  }
  // A pocket plaza closes the walk with a fountain and café tables.
  const water=mat('#7fa4a1',.14,.25);cyl(1.35,1.5,.32,0,.16,28,cream);cyl(1.23,1.23,.02,0,.34,28,water);obstacles.push({x:0,z:28,w:2.8,d:2.8});
  sign('연남의 아침',0,3,-31,6,1,'#ebe5d8','#374f45');
  const sun=new THREE.DirectionalLight('#fff1d7',3);sun.position.set(-8,18,7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-22,right:22,top:35,bottom:-35,near:1,far:75});sun.shadow.normalBias=.03;group.add(sun);
  group.add(new THREE.HemisphereLight('#dceef6','#8c806a',1.7));
  const stations=[
    {id:'home',name:'서연의 집',action:'집으로 들어가기',x:-8.4,z:-23.5,radius:1.6,y:2.1},
    {id:'cafe',name:'모닝 커피',action:'카페 들어가기',x:-8.4,z:-10,radius:1.6,y:2.1},
    {id:'boutique',name:'온도 편집숍',action:'의상 색상 고르기',x:8.35,z:-18,radius:1.6,y:2.1},
    {id:'reflection',name:'쇼윈도',action:'비친 모습 확인',x:8.1,z:1.8,radius:1.55,y:2.2},
    {id:'friend',name:'지민과의 약속',action:'지민과 이야기하기',x:6.9,z:21,radius:1.65,y:2.1},
  ];
  return {obstacles,cameraWalls,stations,mirror,bounds:{minX:-9.1,maxX:9.1,minZ:-30,maxZ:30},update(){}};
}

export function createCafe(group) {
  const {box,cyl,sign,mat,obstacles,cameraWalls}=builder(group);
  const plaster=mat('#dcd3be'),wood=mat('#795641'),dark=mat('#34413a'),cream=mat('#f0e4cd'),glass=mat('#9cb7b1',.2);
  box(12,.1,10,0,-.05,0,plaster);
  box(12,3.6,.15,0,1.8,-5,plaster,false,true);box(.15,3.6,10,-6,1.8,0,plaster,false,true);
  box(12,3.6,.15,0,1.8,5,glass,false,true);
  box(.15,3.6,10,6,1.8,0,glass,false,true);
  for(const z of [-4,-1,2,4.8])box(.2,3.6,.08,5.86,1.8,z,dark);
  box(7,1.04,1.0,-1,.52,-2.8,wood,true,true);box(7.1,.07,1.07,-1,1.075,-2.8,cream,true);
  box(1.2,.7,.65,-2.4,1.46,-2.9,dark,true);
  for(const x of [-4,-3.5,-.2,.3])cyl(.07,.052,.13,x,1.18,-2.6,cream);
  sign('MORNING  /  COFFEE',0,2.6,-4.87,4.8,.8,'#dcd3be','#34413a');
  sign('아메리카노  4.5    라테  5.0',-3.8,2.05,-4.87,3,.5,'#34413a','#f0e4cd');
  for(const x of [-3,2.8])for(const z of [.3,3.1]) {
    cyl(.72,.72,.07,x,.77,z,wood);cyl(.07,.12,.73,x,.365,z,dark);obstacles.push({x,z,w:1.5,d:1.5});
    for(const dx of [-1.1,1.1]) {
      box(.52,.08,.55,x+dx,.46,z,cream,true,true);box(.08,.63,.55,x+dx+Math.sign(dx)*.24,.75,z,wood,true);
      for(const dz of [-.19,.19])box(.035,.44,.035,x+dx,.22,z+dz,dark);
    }
    const lamp=new THREE.PointLight('#ffdcb0',14,4,2);lamp.position.set(x,2.25,z);group.add(lamp);cyl(.3,.4,.25,x,2.55,z,cream);
  }
  group.add(new THREE.HemisphereLight('#e9eee8','#b29c7f',1.5));const sunlight=new THREE.DirectionalLight('#ffedce',2);sunlight.position.set(6,4,2);group.add(sunlight);
  return {obstacles,cameraWalls,bounds:{minX:-5.6,maxX:5.6,minZ:-4.5,maxZ:4.5},stations:[
    {id:'order',name:'바리스타',action:'커피 주문하기',x:0,z:-1.5,radius:1.5,y:2},
    {id:'sit',name:'창가 자리',action:'앉아서 커피 마시기',x:3.9,z:3.1,radius:1.1,y:1.5},
    {id:'street',name:'카페 출입문',action:'거리로 나가기',x:0,z:4.1,radius:1.4,y:1.7},
  ],update(){}};
}
