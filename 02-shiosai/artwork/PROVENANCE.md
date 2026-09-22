# 시오사이 창가 — 생성 이미지 기록

2026-09-22, 내장 `image_gen.imagegen`으로 생성. 실제 촬영·실제 역·사진 측량 자료가 아닌 가상의 일본 해안역이다. 외부 이미지나 작가 작품을 입력하지 않았다. 야간 이미지는 첫 생성 결과를 편집해 만든다. 원본은 이 폴더의 PNG 2장, 실행용은 `public/assets/window/*.webp`이며 cwebp q94로 인코딩했다.

## 1. station-source.png

Use case: photorealistic-natural. Create one ultra-photoreal cinematic photograph asset, landscape 3:2 aspect ratio, as high resolution as possible. This is the exterior view for an immersive Japanese railway window experience; ONLY THE EXTERIOR, no window frame or glass, no rain on camera lens, no interior, no typography overlay. At blue twilight immediately after a September rainstorm on a fictional rural Japanese coastal railway station. Camera at seated passenger height 1.7m on a train across the tracks, looking slightly diagonally along a narrow empty wet station platform. Left 45% contains lovingly detailed weathered Japanese station architecture: dark old timber waiting room, corrugated overhanging roof, one warm fluorescent lamp reflected in wet concrete, round analog clock, Japanese station sign with just 潮騒, aged cream plaster, a small old red drinks vending machine, wooden bench with one forgotten transparent umbrella, subtle tactile yellow paving. Center at x55% there is the front and receding side of a very realistic old sage-green and cream Japanese commuter train stopped further down the platform, warm interior windows, visibly heavy manufactured metal, small glowing lights. Right 40% opens onto an expansive calm silvery turquoise Seto Inland Sea with distant overlapping blue island ridges and a thin peach strip at horizon under enormous soft blue-gray clouds. Platform converges toward vanishing point x56%, y50%. Horizon y47%. View has beautiful photographic depth, asymmetrical framing, melancholy yet comforting, nostalgic and intimate, extremely rich real world imperfection and exquisite natural subdued tones. Foreground bottom 20% has dark wet tracks and ballast fading into shadow. Everything life-size. Natural analog 35mm film color, medium format editorial travel photography, believable physical exposure. NO miniature, NO voxel, NO low poly, NO illustration, NO artificial 3D render, NO heavily saturated orange/teal grading, NO oversize text, NO people, NO watermark. The central 40% must also work as a portrait crop, keeping train front, part of station and sea visible.

## 2. station-night-source.png

入力: station-source.png / edit target.

Use case: lighting-weather. Edit this exact photograph into a deeply atmospheric late blue hour NIGHT photograph 30 minutes later. Preserve EXACT pixel placement, composition, lens, all geometry, train position, mountain and roof outlines, architecture, clock, sign, foreground, everything. Change only light and time of day. Sky a dark desaturated marine blue, the peach sunset strip is now a very faint cool gray afterglow. Clouds still visible but much darker. Sea nearly dark navy with quiet silver blue texture. Existing train windows warmly lit honey amber, station light warm, vending machine light softly visible. The bright tungsten lamps reflected in wet concrete provide the focus, reflections physically plausible, slight halation around practical lights. Shadows retain natural texture, real film night exposure, not crushed black. Quiet wistful analog Japanese travel photograph, absolutely photorealistic. Do not add moon/stars/people/elements, no additional text. Make it beautifully comforting and subtly lonely. Same 1536x1024 dimensions, same exact view.

## 実装

生成背景を浅い起伏のメッシュに投影。前景の窓枠は3D。雨、屈折、曇り、拭き跡、海面の動きはコードによるリアルタイム描画。全方位を歩けるフォトリアルな3D空間ではない。

물리적인 색 공간 처리는 [Three.js 공식 문서](https://threejs.org/docs/)와 설치된 r186 셰이더 구현을 참고했다. 사진 질감과 3D 전경을 선형 렌더 타깃에 합성한 뒤 sRGB로 출력한다.
