import * as THREE from 'three';
import { box, cylinder, tube, materials as m, pbr, boardTexture, sign, seededRandom, batch } from './materials.js';

const noiseGLSL=`
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);vec2 u=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1.,0.)),u.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.)),u.x),u.y);}
float fbm(vec2 p){float f=0.,a=.5;for(int i=0;i<5;i++){f+=noise(p)*a;p=mat2(1.6,1.2,-1.2,1.6)*p;a*=.5;}return f;}
`;

function makeSky(scene) {
  const material=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,
    uniforms:{uTime:{value:0},uNight:{value:0},uTop:{value:new THREE.Color('#728a99')},uHorizon:{value:new THREE.Color('#e8b184')},uSun:{value:new THREE.Vector3(.48,.065,-.87).normalize()}},
    vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
    fragmentShader:`
      uniform float uTime,uNight;uniform vec3 uTop,uHorizon,uSun;varying vec3 vDir;
      ${noiseGLSL}
      void main(){
        vec3 dir=normalize(vDir);float h=max(dir.y,0.);
        vec3 sky=mix(uHorizon,uTop,pow(smoothstep(-.03,.72,dir.y),.5));
        float glow=pow(max(dot(dir,uSun),0.),32.);sky+=vec3(.8,.39,.15)*glow*(1.-uNight);
        float sun=smoothstep(.99982,.99994,dot(dir,uSun));sky+=mix(vec3(7.,4.9,2.7),vec3(1.5,1.8,2.),uNight)*sun;
        vec2 p=dir.xz/max(.085,dir.y+.17)*2.2;p.x+=uTime*.002;
        float cloud=smoothstep(.37,.68,fbm(p))*smoothstep(-.04,.1,dir.y);
        float detail=fbm(p*2.7+4.);vec3 cloudColor=mix(vec3(.47,.49,.48),vec3(.74,.69,.60),detail);
        cloudColor=mix(cloudColor,vec3(.055,.085,.12),uNight);
        sky=mix(sky,cloudColor,cloud*.68);
        gl_FragColor=vec4(sky,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1800,48,32),material));return material;
}

function makeOcean(scene) {
  const geometry=new THREE.PlaneGeometry(2800,2800,1,1);geometry.rotateX(-Math.PI/2);
  const material=new THREE.ShaderMaterial({
    uniforms:{uTime:{value:0},uCamera:{value:new THREE.Vector3()},uNight:{value:0},uSun:{value:new THREE.Vector3(.48,.065,-.87).normalize()},uHorizon:{value:new THREE.Color('#e8b184')},uDeep:{value:new THREE.Color('#36565a')}},
    vertexShader:'varying vec3 vWorld;void main(){vec4 p=modelMatrix*vec4(position,1.);vWorld=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}',
    fragmentShader:`
      uniform float uTime,uNight;uniform vec3 uCamera,uSun,uHorizon,uDeep;varying vec3 vWorld;
      ${noiseGLSL}
      void main(){
        vec2 p=vWorld.xz;float t=uTime;
        float warp=fbm(p*.065+t*.018);
        float a=sin(p.x*.23+p.y*.11+t*.4+warp*3.),b=sin(p.x*.81-p.y*.42-t*.65+warp*5.),c=sin(p.x*2.3+p.y*1.3+t*.91);
        float fine=1.-smoothstep(50.,300.,distance(uCamera,vWorld));
        vec3 n=normalize(vec3(a*.055+b*.025,1.,b*.065+c*.019*fine));
        vec3 v=normalize(uCamera-vWorld);float fresnel=pow(1.-max(dot(n,v),0.),4.);
        vec3 reflected=mix(uHorizon,vec3(.24,.34,.42),.33+abs(n.x)*2.);
        vec3 col=mix(uDeep,reflected,.25+fresnel*.68);
        vec3 halfDir=normalize(uSun+v);float spec=pow(max(dot(n,halfDir),0.),100.)*(.6+noise(p*.8)*.4);
        col+=vec3(1.9,1.3,.7)*spec*(1.-uNight*.85);
        float shore=(1.-smoothstep(4.8,7.,p.x))*smoothstep(.64,.86,fbm(p*.7-vec2(t*.12,0.)));
        col+=vec3(.075,.08,.076)*shore;
        float haze=smoothstep(110.,850.,distance(uCamera,vWorld));col=mix(col,uHorizon*.7,haze*.7);
        gl_FragColor=vec4(col,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const ocean=new THREE.Mesh(geometry,material);ocean.position.set(1399,-1.4,-450);scene.add(ocean);return material;
}

function terrainHeight(x,z) {
  const distance=Math.max(0,-x-17);
  return Math.pow(Math.min(distance/70,1),1.2)*(25+Math.sin(z*.026)*12+Math.sin(z*.061+x*.024)*5);
}

function makeLand(scene,textures) {
  const ground=pbr(textures,'asphalt_02',[60,90],{color:'#686958',roughness:.95});
  box(scene,[24,.45,420],[-6,-.24,-65],ground);
  const geo=new THREE.PlaneGeometry(200,500,96,160);geo.rotateX(-Math.PI/2);geo.translate(-112,0,-100);
  const p=geo.attributes.position,colors=[];const color=new THREE.Color();
  for(let i=0;i<p.count;i++){
    const x=p.getX(i),z=p.getZ(i);p.setY(i,terrainHeight(x,z)-.2);
    const shade=Math.sin(x*.08+z*.05)*.025+Math.sin(z*.11)*.015;
    color.setHSL(.27,.17,.2+shade,THREE.SRGBColorSpace);colors.push(color.r,color.g,color.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
  const hill=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:1}));hill.receiveShadow=true;scene.add(hill);
  for(let n=0;n<4;n++){
    const g=new THREE.PlaneGeometry(300,120,80,20);g.rotateX(-Math.PI/2);
    const a=g.attributes.position;
    for(let i=0;i<a.count;i++){
      const x=a.getX(i),z=a.getZ(i);const envelope=Math.max(0,1-(x/160)**2)*Math.max(0,1-(z/65)**2);
      a.setY(i,envelope*(30+8*Math.sin(x*.033)+6*Math.sin(x*.079+n)));
    }
    g.computeVertexNormals();
    const mountain=new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:new THREE.Color().setHSL(.49,.08,.25+n*.035,THREE.SRGBColorSpace),roughness:1}));
    mountain.position.set(240+n*60,-3,-300-n*85);scene.add(mountain);
  }
}

function makeFoliage(scene) {
  const random=seededRandom(91);
  const texture=boardTexture((ctx,w,h)=>{
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#fff';ctx.beginPath();ctx.moveTo(w*.5,h*.03);
    ctx.bezierCurveTo(w*.96,h*.35,w*.95,h*.69,w*.5,h*.96);ctx.bezierCurveTo(w*.05,h*.69,w*.04,h*.35,w*.5,h*.03);ctx.fill();
  },64,128);
  const leafMat=new THREE.MeshStandardMaterial({color:'#536342',map:texture,alphaTest:.5,side:THREE.DoubleSide,roughness:.95});
  const leaves=new THREE.InstancedMesh(new THREE.PlaneGeometry(.36,.76),leafMat,152000);
  const branches=new THREE.InstancedMesh(new THREE.CylinderGeometry(.03,.065,1,5),m.timber,1700);
  const dummy=new THREE.Object3D();let leafCount=0,branchCount=0;
  const up=new THREE.Vector3(0,1,0),color=new THREE.Color();
  for(let t=0;t<125;t++){
    const x=-21-random()*95,z=-190+random()*315,base=terrainHeight(x,z),height=3+random()*5;
    dummy.position.set(x,base+height*.45,z);dummy.rotation.set(0,0,(random()-.5)*.16);dummy.scale.set(2.4,height,2.4);dummy.updateMatrix();branches.setMatrixAt(branchCount++,dummy.matrix);
    for(let b=0;b<9;b++){
      const angle=b*2.4+t,reach=1+random()*1.9,by=height*(.45+b*.052);
      const end=new THREE.Vector3(x+Math.sin(angle)*reach,base+by+.5,z+Math.cos(angle)*reach);
      const start=new THREE.Vector3(x,base+by-1,z);const direction=end.clone().sub(start);
      dummy.position.copy(start).lerp(end,.5);dummy.quaternion.setFromUnitVectors(up,direction.clone().normalize());dummy.scale.set(1,direction.length(),1);dummy.updateMatrix();branches.setMatrixAt(branchCount++,dummy.matrix);
      for(let j=0;j<135;j++){
        const a=random()*Math.PI*2,r=Math.sqrt(random())*1.5;
        dummy.position.set(end.x+Math.cos(a)*r,end.y+(random()-.4)*1.3,end.z+Math.sin(a)*r);
        dummy.rotation.set(random()*Math.PI,random()*6.28,random()*3);dummy.scale.setScalar(.7+random()*.65);dummy.updateMatrix();leaves.setMatrixAt(leafCount,dummy.matrix);
        color.setHSL(.24+random()*.045,.20,.44+random()*.19,THREE.SRGBColorSpace);leaves.setColorAt(leafCount++,color);
      }
    }
  }
  leaves.count=leafCount;branches.count=branchCount;leaves.castShadow=true;branches.castShadow=true;scene.add(leaves,branches);
  const grassGeo=new THREE.BufferGeometry();grassGeo.setAttribute('position',new THREE.Float32BufferAttribute([-.018,0,0,.018,0,0,.014,.34,.02],3));grassGeo.computeVertexNormals();
  const grass=new THREE.InstancedMesh(grassGeo,new THREE.MeshStandardMaterial({color:'#6d7650',side:THREE.DoubleSide,roughness:1}),7500);
  for(let i=0;i<7500;i++){
    const x=i<5000?2+random()*2.5:-12-random()*5,z=random()*165-110;
    dummy.position.set(x,0,z);dummy.rotation.set(0,random()*6.28,0);dummy.scale.setScalar(.5+random()*2);dummy.updateMatrix();grass.setMatrixAt(i,dummy.matrix);
  }
  scene.add(grass);
}

function house(scene,x,z,scale=1) {
  const group=new THREE.Group();group.position.set(x,terrainHeight(x,z),z);group.scale.setScalar(scale);
  box(group,[5.6,4.9,5.6],[0,2.45,0],new THREE.MeshStandardMaterial({color:'#aba799',roughness:.9}));
  for(const side of [-1,1]){
    for(let y=.3;y<2.8;y+=.15)box(group,[.055,.11,5.65],[side*2.84,y,0],m.timber);
    const roof=box(group,[3.5,.14,6.35],[side*1.58,5.18,0],m.roof);roof.rotation.z=side*-.33;
    for(let n=0;n<26;n++){
      const tile=cylinder(group,.075,3.5,[side*1.58,5.29,-3.05+n*.24],m.roof,.075,8);
      tile.rotation.z=Math.PI/2-side*.33;
    }
    for(const z2 of [-1.6,1.2]){
      box(group,[.055,1.65,1.7],[side*2.87,3.75,z2],m.dark);
      box(group,[.065,1.48,1.5],[side*2.91,3.76,z2],new THREE.MeshStandardMaterial({color:'#b4b3a0',emissive:'#a78c58',emissiveIntensity:.15,roughness:.3}));
      for(let i=0;i<4;i++)box(group,[.08,1.5,.025],[side*2.96,3.76,z2-.6+i*.4],m.timber);
    }
  }
  for (const front of [-1, 1]) {
    for (let y = .2; y < 2.75; y += .15) box(group, [5.65, .11, .055], [0, y, front * 2.84], m.timber);
    box(group, [1.42, 2.22, .09], [.85, 1.11, front * 2.89], m.dark);
    box(group, [1.23, 1.77, .11], [.85, 1.24, front * 2.91], new THREE.MeshStandardMaterial({ color: '#72847d', roughness: .32, metalness: .15 }));
    for (let n = 0; n < 5; n++) box(group, [.045, 1.92, .14], [.33 + n * .26, 1.25, front * 2.94], m.timber);
    box(group, [2.18, 1.55, .085], [-.38, 3.65, front * 2.88], m.dark);
    box(group, [1.98, 1.37, .1], [-.38, 3.65, front * 2.91], new THREE.MeshStandardMaterial({ color: '#798885', metalness: .2, roughness: .3 }));
    for (const dx of [-.68, 0, .68]) box(group, [.035, 1.45, .15], [-.38 + dx, 3.65, front * 2.94], m.timber);
    box(group, [2.44, .07, .48], [-.38, 4.47, front * 3], m.roof);
    box(group, [.85, .6, .35], [-1.7, .46, front * 3.02], m.cream, .035);
    const fan = cylinder(group, .22, .02, [-1.7, .46, front * 3.21], m.iron, .22, 20); fan.rotation.x = Math.PI / 2;
    for (let n = 0; n < 7; n++) box(group, [.5, .017, .025], [-1.7, .25 + n * .07, front * 3.235], m.cream);
  }
  batch(group);scene.add(group);
}

function streetDetails(scene) {
  house(scene,-18,-23,.85);house(scene,-20,-42,1);house(scene,-19,-65,.9);house(scene,-20,17,.8);
  for(let z=-140;z<110;z+=22){
    cylinder(scene,.1,8.2,[-13,3.8,z],m.iron,.16);
    box(scene,[2.4,.08,.12],[-13,7.3,z],m.iron);
    for(const dx of [-.8,0,.8]){
      cylinder(scene,.07,.27,[-13+dx,7.44,z],m.cream,.07,8);
      tube(scene,[[-13+dx,7.52,z],[-13+dx,6.82,z+11],[-13+dx,7.52,z+22]],.015,m.dark,12);
    }
  }
  const fence=new THREE.Group();
  for(let z=-90;z<30;z+=1.4){box(fence,[.07,1.2,.08],[-9.7,1.5,z],m.iron);}
  for(const y of [1.1,1.8,2.1])tube(fence,[[-9.7,y,-90],[-9.7,y,30]],.019,m.iron,2);
  batch(fence);scene.add(fence);
}

function makeRain(scene) {
  const random=seededRandom(638),count=1300;
  const positions=new Float32Array(count*6),seeds=new Float32Array(count*2),tails=new Float32Array(count*2);
  for(let i=0;i<count;i++){
    const x=(random()-.5)*80,y=random()*26,z=(random()-.5)*110;
    positions.set([x,y,z,x-.045,y-.55,z+.015],i*6);seeds[i*2]=seeds[i*2+1]=random();tails[i*2+1]=1;
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('aSeed',new THREE.BufferAttribute(seeds,1));geometry.setAttribute('aTail',new THREE.BufferAttribute(tails,1));
  const material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,
    uniforms:{uTime:{value:0},uOpacity:{value:.09}},
    vertexShader:'uniform float uTime;attribute float aSeed,aTail;varying float vAlpha;void main(){vec3 p=position;p.y=mod(p.y+aTail*.55-uTime*(12.+aSeed*4.),26.)-aTail*.55;p.x-=p.y*.035;vec4 mv=modelViewMatrix*vec4(p,1.);vAlpha=1.-smoothstep(5.,70.,-mv.z);if(p.y<4.4&&p.x>-9.5&&p.x<-2.5&&p.z>-34.&&p.z<24.)vAlpha=0.;gl_Position=projectionMatrix*mv;}',
    fragmentShader:'uniform float uOpacity;varying float vAlpha;void main(){gl_FragColor=vec4(.78,.85,.88,uOpacity*vAlpha);}',
  });
  const rain=new THREE.LineSegments(geometry,material);rain.frustumCulled=false;scene.add(rain);return material;
}

export function createEnvironment(scene,textures) {
  const sky=makeSky(scene),ocean=makeOcean(scene);makeLand(scene,textures);makeFoliage(scene);streetDetails(scene);
  return {sky,ocean,rain:makeRain(scene)};
}
