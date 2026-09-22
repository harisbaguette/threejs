import * as THREE from 'three';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { box, cylinder, tube, boardTexture, sign, materials as m, pbr, seededRandom, batch } from './materials.js';

function createPlatform(scene, textures) {
  const concrete = pbr(textures,'concrete_floor_02',[3,30],{color:'#a8a99f',roughness:.78});
  box(scene,[8,.9,130],[-5.5,.45,-32],concrete,.02);
  const shader = {
    uniforms: { ...THREE.UniformsUtils.clone(Reflector.ReflectorShader.uniforms), uFloor:{value:textures.asphalt_02.map}, uTime:{value:0}, uWet:{value:.7} },
    vertexShader: Reflector.ReflectorShader.vertexShader.replace('void main() {','varying vec2 floorUv;\nvoid main() {\nfloorUv=uv;'),
    fragmentShader: `
      uniform sampler2D tDiffuse; uniform sampler2D uFloor; uniform float uTime; uniform float uWet;
      varying vec4 vUv; varying vec2 floorUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);}
      void main(){
        vec2 uv=floorUv*vec2(2.66,43.33); vec3 base=texture2D(uFloor,uv).rgb;
        float puddle=smoothstep(.36,.65,noise(floorUv*vec2(8.,70.))*.65+noise(floorUv*vec2(18.,140.))*.35);
        vec4 reflected=vUv; reflected.xy+=vec2(sin(uv.y*51.+uTime*.7),cos(uv.x*65.+uTime))*.0003*vUv.w;
        vec3 reflection=texture2DProj(tDiffuse,reflected).rgb;
        vec3 color=mix(base*vec3(.47,.53,.57),reflection,(.13+puddle*.64)*uWet);
        gl_FragColor=vec4(color,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  };
  const surface = new Reflector(new THREE.PlaneGeometry(8,130),{textureWidth:1024,textureHeight:1024,clipBias:.003,shader,multisample:0});
  surface.rotation.x=-Math.PI/2;surface.position.set(-5.5,.907,-32);scene.add(surface);
  const tactile=new THREE.MeshStandardMaterial({color:'#a89554',roughness:.5,metalness:.12});
  box(scene,[.48,.035,129],[-2.04,.931,-32],tactile,.008);
  box(scene,[.075,.025,129],[-1.62,.933,-32],m.cream);
  const studs=new THREE.InstancedMesh(new THREE.SphereGeometry(.025,6,4),tactile,2200);
  const dummy=new THREE.Object3D();let n=0;
  for(let z=-96;z<32;z+=.19) for(const x of [-2.19,-2.04,-1.89]){
    dummy.position.set(x,.956,z);dummy.scale.set(1,.45,1);dummy.updateMatrix();studs.setMatrixAt(n++,dummy.matrix);
  }
  studs.count=n;studs.receiveShadow=true;scene.add(studs);
  for(let z=-92;z<32;z+=2) box(scene,[.28,.86,.055],[-1.51,.47,z],m.iron);
  return surface;
}

function createCanopy(scene, lights) {
  const group=new THREE.Group();
  const painted=new THREE.MeshStandardMaterial({color:'#64665b',roughness:.67,metalness:.4});
  for(const z of [-32,-21,-10,1,12,23]) {
    box(group,[.18,3.47,.18],[-6.6,2.6,z],painted,.015);
    box(group,[.42,.16,.43],[-6.6,1.0,z],m.iron,.025);
    box(group,[7,.16,.12],[-5.9,4.27,z],painted);
    const brace=box(group,[.09,1.65,.1],[-6.03,3.83,z],painted);brace.rotation.z=-.77;
    const brace2=box(group,[.09,1.65,.1],[-7.18,3.83,z],painted);brace2.rotation.z=.77;
  }
  for(let x=-9.5;x<-2.5;x+=.24) {
    const strip=box(group,[.25,.055,59],[x,4.45+Math.abs(x+6)*.075,-5],m.roof);
    strip.rotation.z=x<-6?-.075:.075;
  }
  for(const x of [-9.5,-2.5]) box(group,[.13,.19,59],[x,4.4,-5],painted);
  tube(group,[[-2.45,4.35,24],[-2.45,4.33,-34]],.068,m.iron,2);
  for(const z of [-22,-5,12]) {
    box(group,[.18,.08,1.45],[-4.7,4.14,z],m.iron,.02);
    box(group,[.1,.04,1.3],[-4.7,4.08,z],m.bulb,.025);
    const light=new THREE.PointLight('#ffd6a0',19,17,1.5);light.position.set(-4.7,3.9,z);lights.station.push(light);scene.add(light);
  }
  batch(group);scene.add(group);
}

function stationSign(scene) {
  const texture=boardTexture((ctx,w,h)=>{
    ctx.fillStyle='#e5e5d4';ctx.fillRect(0,0,w,h);ctx.fillStyle='#213f37';ctx.textAlign='center';
    ctx.font='76px "Hiragino Sans",sans-serif';ctx.fillText('し お さ い',w/2,110);
    ctx.font='190px "Hiragino Mincho ProN",serif';ctx.fillText('潮 騒',w/2,315);
    ctx.font='43px sans-serif';ctx.fillText('S H I O S A I',w/2,389);
    ctx.fillStyle='#355b4b';ctx.fillRect(0,420,w,50);ctx.fillStyle='#e7e9d5';ctx.font='30px sans-serif';ctx.fillText('← 鎌倉高校前                         七里ヶ浜 →',w/2,457);
    const rand=seededRandom(12);ctx.fillStyle='#58523a15';for(let i=0;i<1300;i++)ctx.fillRect(rand()*w,rand()*h,rand()*3,1);
  });
  const signMesh=sign(scene,[2.5,1.25],[-6.72,2.8,-13],texture,{rotation:Math.PI/2,emissive:.1});
  signMesh.material.side=THREE.DoubleSide;
  for(const z of [-14,-12]) cylinder(scene,.045,2.55,[-6.75,2.19,z],m.iron);
  const hanging=boardTexture((ctx,w,h)=>{
    ctx.fillStyle='#243933';ctx.fillRect(0,0,w,h);ctx.fillStyle='#e5dfc4';ctx.font='110px "Hiragino Sans",sans-serif';ctx.fillText('1',65,285);ctx.font='76px "Hiragino Sans",sans-serif';ctx.fillText('海岸線 のりば',235,215);ctx.font='38px sans-serif';ctx.fillText('FOR KAMAKURA',242,303);
  });
  sign(scene,[2.55,.85],[-4.95,3.66,1],hanging,{emissive:.2});
  for(const x of [-5.95,-3.95]) tube(scene,[[x,4.33,1],[x,4.07,1]],.014,m.iron,2);
}

function createBench(scene,z) {
  const group=new THREE.Group();group.position.set(-8.1,.92,z);
  for(const x of [-.45,-.27,-.09,.09,.27,.45]) {
    box(group,[.15,.065,2.55],[x,.46,0],m.timber,.02);
    box(group,[.065,.15,2.55],[-.5,.6+(x+.45)*.67,0],m.timber,.02);
  }
  for(const p of [-.9,.9]) {
    box(group,[.085,.48,.11],[-.35,.22,p],m.iron,.015);box(group,[.085,.48,.11],[.35,.22,p],m.iron,.015);
    tube(group,[[-.49,.38,p],[-.55,1.22,p]],.037,m.iron,3);
  }
  batch(group);scene.add(group);
}

function createVending(scene) {
  const group=new THREE.Group();group.position.set(-8.45,.92,-4);group.rotation.y=Math.PI/2;
  box(group,[1.02,2.03,.67],[0,1.04,0],new THREE.MeshStandardMaterial({color:'#cfcec3',metalness:.35,roughness:.45}),.055);
  const texture=boardTexture((ctx,w,h)=>{
    ctx.fillStyle='#d6dedc';ctx.fillRect(0,0,w,h);ctx.fillStyle='#d65439';ctx.fillRect(0,0,w,80);ctx.fillStyle='#fff4d5';ctx.font='46px sans-serif';ctx.textAlign='center';ctx.fillText('つめた〜い',w/2,58);
    const colors=['#da6949','#ded2b0','#527a8a','#b4b776','#889c98'];
    for(let row=0;row<3;row++)for(let col=0;col<6;col++){
      const x=65+col*145,y=130+row*160;ctx.fillStyle='#9bb9be';ctx.fillRect(x-25,y-18,125,143);
      ctx.fillStyle=colors[(row+col)%colors.length];ctx.fillRect(x,y,63,96);ctx.fillStyle='#f0eee1';ctx.fillRect(x,y+17,63,36);ctx.fillStyle='#819199';ctx.fillRect(x-2,y-6,67,8);
    }
    ctx.fillStyle='#374c47';ctx.fillRect(110,690,580,95);ctx.fillStyle='#d6b36b';ctx.fillRect(798,630,60,60);ctx.fillStyle='#4b5851';ctx.fillRect(780,720,130,50);
  },1024,1024);
  sign(group,[.91,1.75],[0,1.14,.354],texture,{emissive:.6});
  scene.add(group);
}

function createTrack(scene,textures) {
  const ballast=pbr(textures,'asphalt_02',[1,80],{color:'#b2ad9b',roughness:.93});
  box(scene,[4,.16,370],[0,-.02,-70],ballast);
  const ties=new THREE.InstancedMesh(new THREE.BoxGeometry(2.08,.12,.23),m.timber,630);
  const dummy=new THREE.Object3D();
  for(let i=0;i<630;i++){dummy.position.set(0,.12,-250+i*.58);dummy.updateMatrix();ties.setMatrixAt(i,dummy.matrix);}
  ties.castShadow=true;ties.receiveShadow=true;scene.add(ties);
  for(const x of [-.5335,.5335]) {
    box(scene,[.12,.035,370],[x,.196,-70],m.iron);
    box(scene,[.035,.09,370],[x,.25,-70],m.iron);
    box(scene,[.069,.045,370],[x,.318,-70],m.steel,.012);
  }
  const random=seededRandom(493),stones=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),m.iron,3200);
  for(let i=0;i<3200;i++){
    const x=(random()-.5)*3.9,z=random()*180-115;
    dummy.position.set(x,.095+random()*.03,z);dummy.rotation.set(random()*3,random()*6,random()*2);dummy.scale.set(.04+random()*.055,.02+random()*.035,.05+random()*.045);dummy.updateMatrix();stones.setMatrixAt(i,dummy.matrix);
  }
  stones.receiveShadow=true;scene.add(stones);
  for(let z=-210;z<120;z+=24) {
    cylinder(scene,.1,7,[2.85,3.1,z],m.iron,.15);
    tube(scene,[[2.85,6.2,z],[2.6,5.65,z],[0,5.65,z]],.045,m.iron,4);
    cylinder(scene,.06,.28,[0,5.52,z],m.cream,.06);
  }
  tube(scene,[[0,5.4,-260],[0,5.4,160]],.011,m.dark,2);
  tube(scene,[[0,5.76,-260],[0,5.76,160]],.015,m.dark,2);
}

export function createStation(scene,textures,lights) {
  const surface=createPlatform(scene,textures);createCanopy(scene,lights);stationSign(scene);
  createBench(scene,-8);createBench(scene,9);createVending(scene);createTrack(scene,textures);
  const seawall=pbr(textures,'concrete_floor_02',[1,55],{color:'#828b80',roughness:.9});
  box(scene,[.6,1.7,360],[5,-.5,-60],seawall,.04);
  for(let z=-180;z<110;z+=3.2) cylinder(scene,.027,1.03,[4.8,1.23,z],m.iron);
  for(const y of [.78,1.3,1.75]) tube(scene,[[4.8,y,-180],[4.8,y,110]],.022,m.iron,2);
  batch(scene);
  return surface;
}
