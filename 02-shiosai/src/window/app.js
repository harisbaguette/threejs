import "./style.css";
import { createWindow } from "./scene.js";
import { WindowAudio } from "./audio.js";
import {
  defaultLine,
  dateLabel,
  download,
  remember,
  recalled,
  createPostcard,
} from "./postcard.js";

const $ = (selector) => document.querySelector(selector);
const app = $("#experience"),
  sound = new WindowAudio();
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
let world, toastTimer, hintTimer, postcardSource, postcardNight, postcardDate;
let recorder,
  stream,
  recordingTimer,
  beforeRecordingPaused = false;
function icon(button, name) {
  button.querySelector("use").setAttribute("href", `/window-icons.svg#${name}`);
}
function toast(message, duration = 4000) {
  clearTimeout(toastTimer);
  $("#toast").textContent = message;
  $("#toast").classList.add("visible");
  toastTimer = setTimeout(
    () => $("#toast").classList.remove("visible"),
    duration,
  );
}
function failure(error) {
  console.error(error);
  $("#failure").hidden = false;
  $("#failure-message").textContent =
    error.message || "잠시 후 다시 열어 주세요.";
  $(".arrival").inert = true;
}
function updatePlayback() {
  const paused = !world.state.running;
  icon($("#pause"), paused ? "play" : "pause");
  $("#pause").setAttribute("aria-label", paused ? "풍경 재생" : "풍경 정지");
  $("#pause").setAttribute("aria-pressed", String(paused));
  sound.setPaused(paused);
}
function pause() {
  if ($("#pause").disabled) return;
  world.state.running = !world.state.running;
  updatePlayback();
}
function soundButton() {
  icon($("#sound"), sound.enabled ? "sound-on" : "sound-off");
  $("#sound").setAttribute(
    "aria-label",
    sound.enabled ? "소리 끄기" : "소리 켜기",
  );
  $("#sound").setAttribute("aria-pressed", String(sound.enabled));
}
async function enter() {
  if (world.state.entered) return;
  world.state.entered = true;
  app.dataset.entered = "true";
  $(".arrival").inert = true;
  $(".dock").inert = false;
  $("#hide").disabled = false;
  $("#record").disabled = false;
  world.canvas.focus({ preventScroll: true });
  $("#gesture-hint").hidden = false;
  hintTimer = setTimeout(() => {
    $("#gesture-hint").hidden = true;
  }, 6500);
  try {
    sound.setPaused(false);
    await sound.enable(true);
    soundButton();
  } catch (error) {
    toast(error.message);
  }
}
function quiet(hidden) {
  if (!world.state.entered) return;
  $("#settings").close();
  app.classList.toggle("quiet", hidden);
  document.querySelectorAll(".chrome").forEach((element) => {
    element.inert = hidden;
  });
  $("#restore").hidden = !hidden;
  requestAnimationFrame(() =>
    (hidden ? $("#restore") : $("#menu-open")).focus({ preventScroll: true }),
  );
}
function openPostcard() {
  postcardSource = world.capture();
  postcardNight = world.state.night;
  postcardDate = dateLabel();
  $("#postcard-image").src = postcardSource;
  $("#postcard-date").textContent =
    `${postcardDate} / ${postcardNight ? "19:08" : "17:42"}`;
  $("#memory").value = recalled();
  $("#postcard-line").textContent = $("#memory").value || defaultLine;
  $("#postcard").showModal();
}
async function savePostcard() {
  $("#postcard-save").disabled = true;
  try {
    const line = $("#memory").value;
    const blob = await createPostcard(
      postcardSource,
      line,
      postcardDate,
      postcardNight,
    );
    download(blob, `시오사이-${postcardDate}.png`);
    const stored = remember(line);
    $("#postcard").close();
    toast(
      stored
        ? "오늘의 창가를 엽서로 간직했어요."
        : "엽서를 저장했어요. 이 브라우저에는 글을 보관할 수 없어요.",
    );
  } catch (error) {
    toast(error.message);
  } finally {
    $("#postcard-save").disabled = false;
  }
}
function resetRecording() {
  clearInterval(recordingTimer);
  stream?.getTracks().forEach((track) => track.stop());
  stream = null;
  world.setRecording(false);
  sound.setPaused(beforeRecordingPaused);
  $("#pause").disabled = false;
  $("#record").setAttribute("aria-pressed", "false");
  $("#record span").textContent = "소리와 함께 12초 담기";
}
async function record() {
  if (recorder?.state === "recording") {
    recorder.stop();
    return;
  }
  if (record.busy) return;
  if (!window.MediaRecorder || !world.canvas.captureStream) {
    toast("이 브라우저는 영상 저장을 지원하지 않아요. 엽서로 간직해 주세요.");
    return;
  }
  const mimeType = [
    "video/mp4;codecs=avc1.42001E,mp4a.40.2",
    "video/mp4",
    "video/webm;codecs=vp9,opus",
    "video/webm",
  ].find((type) => MediaRecorder.isTypeSupported(type));
  if (!mimeType) {
    toast("이 브라우저에서 지원하는 영상 형식이 없어요.");
    return;
  }
  record.busy = true;
  beforeRecordingPaused = sound.paused;
  try {
    stream = world.canvas.captureStream(30);
    try {
      stream.addTrack(await sound.recordingTrack());
    } catch {
      toast("소리 없이 풍경을 녹화합니다.");
    }
    sound.setPaused(false);
    world.setRecording(true);
    $("#pause").disabled = true;
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 10_000_000,
      audioBitsPerSecond: 160000,
    });
    const chunks = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      resetRecording();
      if (chunks.length) {
        download(
          new Blob(chunks, { type: mimeType }),
          `시오사이-창가.${mimeType.includes("mp4") ? "mp4" : "webm"}`,
        );
        toast("창가의 시간을 영상으로 저장했어요.");
      }
    };
    recorder.onerror = () => {
      resetRecording();
      toast("녹화를 마치지 못했어요. 다시 시도해 주세요.");
    };
    recorder.start(250);
    $("#record").setAttribute("aria-pressed", "true");
    $("#settings").close();
    let left = 12;
    $("#record span").textContent = `녹화 마치기 · ${left}초`;
    toast("12초 동안 풍경을 담습니다.", 3000);
    recordingTimer = setInterval(() => {
      left--;
      $("#record span").textContent = `녹화 마치기 · ${left}초`;
      if (left <= 0 && recorder.state === "recording") recorder.stop();
    }, 1000);
  } catch (error) {
    resetRecording();
    toast("영상을 시작하지 못했어요. 엽서 저장을 이용해 주세요.");
    console.error(error);
  } finally {
    record.busy = false;
  }
}
function bind() {
  $("#enter").addEventListener("click", enter);
  $("#menu-open").addEventListener("click", () => $("#settings").showModal());
  $("#pause").addEventListener("click", pause);
  $("#sound").addEventListener("click", async () => {
    try {
      await sound.enable(!sound.enabled);
      soundButton();
    } catch (error) {
      toast(error.message);
    }
  });
  document.querySelectorAll("[data-moment]").forEach((button) =>
    button.addEventListener("click", () => {
      world.state.night = button.dataset.moment === "night";
      $("#clock").textContent = world.state.night ? "19:08" : "17:42";
      document
        .querySelectorAll("[data-moment]")
        .forEach((item) =>
          item.setAttribute("aria-pressed", String(item === button)),
        );
    }),
  );
  $("#rain").addEventListener("change", () => {
    world.state.rain = $("#rain").checked;
    sound.setRain(world.state.rain);
  });
  $("#volume").addEventListener("input", () =>
    sound.setVolume(Number($("#volume").value) / 100),
  );
  $("#clear-glass").addEventListener("click", () => {
    world.clearGlass();
    $("#settings").close();
    toast("창이 맑아졌어요.");
  });
  $("#hide").addEventListener("click", () => quiet(true));
  $("#restore").addEventListener("click", () => quiet(false));
  $("#postcard-open").addEventListener("click", openPostcard);
  $("#postcard-save").addEventListener("click", savePostcard);
  $("#memory").addEventListener("input", () => {
    $("#postcard-line").textContent = $("#memory").value || defaultLine;
  });
  $("#record").addEventListener("click", record);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden && recorder?.state === "recording") recorder.stop();
    world.setVisible(!document.hidden);
    sound.visibility(!document.hidden).catch(() => {});
  });
  window.addEventListener("keydown", (event) => {
    if (document.querySelector("dialog[open]")) return;
    if (event.key === "Escape") {
      quiet(false);
      return;
    }
    if (["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) return;
    if (event.key.toLowerCase() === "h") {
      quiet(!app.classList.contains("quiet"));
      return;
    }
    if (
      event.code === "Space" &&
      world.state.entered &&
      !["BUTTON", "A"].includes(document.activeElement.tagName)
    ) {
      event.preventDefault();
      pause();
    }
  });
  // Native dialog focus trapping and Escape; clicking the backdrop dismisses.
  document.querySelectorAll("dialog").forEach((dialog) =>
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const rect = dialog.getBoundingClientRect();
      if (
        event.clientX < rect.left ||
        event.clientX > rect.right ||
        event.clientY < rect.top ||
        event.clientY > rect.bottom
      )
        dialog.close();
    }),
  );
}
$("#retry").addEventListener("click", () => location.reload());
$("#hide").disabled = true;
$("#record").disabled = true;
try {
  world = await createWindow($("#landscape"), {
    reducedMotion,
    onError: failure,
    onWipe: () => {
      clearTimeout(hintTimer);
      $("#gesture-hint").hidden = true;
    },
  });
  bind();
  updatePlayback();
  app.dataset.ready = "true";
  $("#enter").disabled = false;
  $("#enter-label").textContent = "창가에 앉기";
  if (import.meta.env.DEV)
    window.__windowSeat = {
      state: world.state,
      stats: world.stats,
      audio: () => ({
        enabled: sound.enabled,
        paused: sound.paused,
        volume: sound.volume,
        rain: sound.rain,
        context: sound.context?.state,
      }),
    };
} catch (error) {
  failure(error);
}
