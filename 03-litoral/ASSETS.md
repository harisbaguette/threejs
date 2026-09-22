# Asset sources

원본 모델과 촬영 재질을 로컬에 저장합니다. 머리카락은 아래 원본에서 분리한 파생 에셋이며,
건축물과 소품은 게임 코드로 생성합니다.

| 에셋 | 출처 / 조건 |
|---|---|
| Cobblestone Floor 001 | https://polyhaven.com/a/cobblestone_floor_001 — Poly Haven CC0 |
| Plastered Wall 02 | https://polyhaven.com/a/plastered_wall_02 — Poly Haven CC0 |
| Aerial Rocks 02 | https://polyhaven.com/a/aerial_rocks_02 — Poly Haven CC0 |
| Concrete Floor 02 | https://polyhaven.com/a/concrete_floor_02 — Poly Haven CC0 |
| Coastal Sky HDRI | https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky — Poly Haven CC0 |
| Traveler.glb (Josh) | https://github.com/hh-hang/three-player-controller/blob/80d12e5c34e3567475006cab18077cd1b8a5e156/example/public/glb/josh.glb — 해당 예제에서 제공하는 인체와 이동 애니메이션. 저장소 MIT 저작권 표시는 `public/assets/Traveler.LICENSE.txt`에 포함합니다. 캐릭터 등 제3자 에셋의 권리는 각 제작자에게 있습니다. |
| TravelerFemale.glb (SOFIA) | https://avatarsdk.com/avatars/ — MetaPerson의 공식 Female GLB 샘플 ZIP 안 `model.glb`. 원본 다운로드: https://drive.google.com/uc?export=download&id=1aOu0Yzr93_cj_IEXhqrFnfcrs1x_sE9b . 얼굴·피부·의상 텍스처 및 표정 morph target 포함. SOFIA는 이 게임 안에서 붙인 이름이며 모델 권리는 Itseez3D/Avatar SDK에 있습니다. 공개 샘플이며 CC0 에셋이 아닙니다. |
| TravelerHair.glb | https://github.com/avatarsdk/metaperson-loader-threejs/blob/ba6eb2505ea3e4d05874bdf7c31a4e45003653d4/public/models/sample_avatar.glb — 공식 Three.js 샘플의 `haircut` 메시를 Head 기준 좌표로 변환하고 GLB로 내보냈습니다. 원본 저장소 BSD-3-Clause 표시는 `public/assets/MetaPerson.LICENSE.txt`에 포함합니다. |
| Water normals | https://github.com/mrdoob/three.js/blob/r186/examples/textures/waternormals.jpg — Three.js Water 예제 재질 |

캐릭터 참고 예제: https://github.com/hh-hang/three-player-controller

Poly Haven 라이선스: https://polyhaven.com/license

Three.js 코드 라이선스: https://github.com/mrdoob/three.js/blob/r186/LICENSE

`scripts/download-assets.py`는 촬영 재질 4종과 남녀 캐릭터, 하늘, 물 노멀맵을 다시 다운로드합니다.
여성 모델의 이동 애니메이션은 실행 시 Josh의 관절 회전을 여성 골격의 기준 자세에 맞춰 변환합니다.
머리카락 재생성은 개발 서버를 켠 뒤 `node scripts/prepare-hair.mjs`로 실행합니다.
위 라이선스 파일은 각 저장소의 고지이며, 별도 배포된 여성 샘플의 권리를 BSD로 재지정하지 않습니다.
