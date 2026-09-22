import './style.css';
import { createWorld } from './world.js';
import { StationAudio } from './audio.js';

const $=selector=>document.querySelector(selector),app=$('#app'),audio=new StationAudio();
let world,toastTimer,recorder,recordingTimer,recordingStream;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
function icon(button,name){button.querySelector('use').setAttribute('href',`/icons.svg#${name}`);}
function toast(text){clearTimeout(toastTimer);$('#toast').textContent=text;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function error(error){console.error(error);$('#loading').classList.add('loaded');$('#error').hidden=false;}
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function playback(){const running=world.state.running;icon($('#play'),running?'pause':'play');$('#play').setAttribute('aria-label',running?'풍경 정지':'풍경 재생');$('#play').setAttribute('aria-pressed',String(!running));}
function togglePlayback(){world.state.running=!world.state.running;playback();}
function hideUI(hidden){app.classList.toggle('ui-hidden',hidden);$('#show-ui').hidden=!hidden;}
function cameraButtons(name){document.querySelectorAll('[data-camera]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.camera===name)));}

async function savePhoto(){
  const button=$('#photo');button.disabled=true;
  try{
    const image=new Image();image.src=world.capture();await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    canvas.getContext('2d').drawImage(image,0,0);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw new Error('이미지 생성 실패');
    download(blob,`시오사이-${world.state.night?'푸른밤':'해질녘'}.png`);toast('지금의 풍경을 사진으로 저장했어요.');
  }catch(e){console.error(e);toast('사진을 저장하지 못했어요. 다시 시도해 주세요.');}finally{button.disabled=false;}
}

function resetRecording(){clearInterval(recordingTimer);recordingStream?.getTracks().forEach(track=>track.stop());$('#record').setAttribute('aria-pressed','false');$('#record').setAttribute('aria-label','12초 영상 저장');$('#record>span:last-child').textContent='영상';}
function record(){
  if(recorder?.state==='recording'){recorder.stop();return;}
  if(!window.MediaRecorder||!HTMLCanvasElement.prototype.captureStream){toast('영상 저장을 지원하지 않는 브라우저예요. 사진 저장을 이용해 주세요.');return;}
  const mimeType=['video/mp4;codecs=avc1.42001E','video/mp4','video/webm;codecs=vp9','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));
  if(!mimeType){toast('Chrome에서 영상 저장을 이용해 주세요.');return;}
  try{
    recordingStream=world.stream();recorder=new MediaRecorder(recordingStream,{mimeType,videoBitsPerSecond:10_000_000});const chunks=[];
    recorder.addEventListener('dataavailable',e=>{if(e.data.size)chunks.push(e.data);});
    recorder.addEventListener('stop',()=>{resetRecording();if(chunks.length){download(new Blob(chunks,{type:mimeType}),`시오사이.${mimeType.includes('mp4')?'mp4':'webm'}`);toast('풍경을 영상으로 저장했어요.');}});
    recorder.addEventListener('error',()=>{resetRecording();toast('녹화를 마치지 못했어요.');});
    recorder.start(500);$('#record').setAttribute('aria-pressed','true');$('#record').setAttribute('aria-label','녹화 마치기');
    let left=12;$('#record>span:last-child').textContent=`${left}초`;
    recordingTimer=setInterval(()=>{left--;$('#record>span:last-child').textContent=`${left}초`;if(left<=0&&recorder.state==='recording')recorder.stop();},1000);
    toast('12초간 풍경을 담습니다. 한 번 더 누르면 저장해요.');
  }catch(e){console.error(e);resetRecording();toast('녹화를 시작하지 못했어요.');}
}

function bind(){
  $('#play').addEventListener('click',togglePlayback);$('#photo').addEventListener('click',savePhoto);$('#record').addEventListener('click',record);
  document.querySelectorAll('[data-camera]').forEach(button=>button.addEventListener('click',()=>{world.preset(button.dataset.camera,reducedMotion);cameraButtons(button.dataset.camera);}));
  document.querySelectorAll('[data-time]').forEach(button=>button.addEventListener('click',()=>{world.state.night=button.dataset.time==='night';$('#scene-time').textContent=world.state.night?'19:08':'17:42';document.querySelectorAll('[data-time]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}));
  $('#rain').addEventListener('click',()=>{world.state.rain=!world.state.rain;const label=world.state.rain?'비 끄기':'비 켜기';$('#rain').setAttribute('aria-pressed',String(world.state.rain));$('#rain').setAttribute('aria-label',label);$('#rain').title=label;});
  $('#sound').addEventListener('click',async()=>{try{const on=await audio.toggle();icon($('#sound'),on?'sound-on':'sound-off');$('#sound').setAttribute('aria-pressed',String(on));$('#sound').setAttribute('aria-label',on?'소리 끄기':'소리 켜기');$('#sound').title=on?'소리 끄기':'소리 켜기';}catch(e){toast(e.message);}});
  $('#hide-ui').addEventListener('click',()=>hideUI(true));$('#show-ui').addEventListener('click',()=>hideUI(false));
  document.addEventListener('visibilitychange',()=>audio.visibility(!document.hidden).catch(()=>{}));
  window.addEventListener('keydown',event=>{
    if(['INPUT','TEXTAREA','BUTTON','A'].includes(document.activeElement.tagName))return;
    if(event.code==='Space'){event.preventDefault();togglePlayback();}
    if(event.key.toLowerCase()==='h')hideUI(!app.classList.contains('ui-hidden'));
    if(event.key==='Escape')hideUI(false);
  });
}

$('#retry').addEventListener('click',()=>location.reload());
try{
  world=await createWorld($('#scene'),{reducedMotion,onStatus:text=>$('#train-status').textContent=text,onFreeCamera:()=>cameraButtons('free'),onError:error});
  bind();playback();app.dataset.ready='true';$('#loading').classList.add('loaded');
  if(import.meta.env.DEV)window.__shiosai={state:world.state,stats:world.stats};
}catch(e){error(e);}
