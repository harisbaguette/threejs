# Three.js 작품 모음

각 폴더가 별도의 프로젝트입니다. 기존 Git 기록과 로컬 `graft` 자료는 루트에 유지합니다.

두 번째 작품은 비가 갠 일본 해안역을 배경으로 합니다. [사용법](02-shiosai/README.md) · [샘플 영상](02-shiosai/exports/shiosai-preview.mp4) · [해질녘 사진](02-shiosai/exports/shiosai-sunset.png) · [푸른 밤 사진](02-shiosai/exports/shiosai-blue-hour.png)

| 작품 | 폴더 | 로컬 실행 |
|---|---|---|
| 느린 궤도 — 애니메이션풍 계곡 열차 | `01-slow-rail/` | `npm run dev:01` → http://127.0.0.1:5173 |
| 潮騒 — 비가 머문 역 | `02-shiosai/` | `npm run dev:02` → http://127.0.0.1:5174 |
| LITORAL — 바다 곁을 걷다, 3인칭 탐험 게임 | `03-litoral/` | `npm run dev:03` → http://127.0.0.1:5175 |
| 타인의 아침 — 빙의·거울·일상 체험 | `04-another-morning/` | `npm run dev:04` → http://127.0.0.1:5176 |

루트에서 `npm run dev`를 실행하면 네 번째 작품을 엽니다. 개별 폴더에서도 `npm install`, `npm run dev`, `npm run build`를 사용할 수 있습니다.

네 번째 작품은 성인 남성으로 시작해 여성 서연에게 빙의하고, 실제 반사 거울과 다섯 가지 일상 상호작용을 경험하는 프로토타입입니다. 인물 외형은 기존 샘플 모델 기반이며 한국인 실사 전용 모델은 아직 포함하지 않습니다. [조작법과 구현 범위](04-another-morning/README.md)

세 번째 작품은 여성 SOFIA가 기본입니다. 시작 화면의 **함께 걸을 사람**에서 여성·남성을
선택하고, 얼굴을 확대하거나 전신을 회전해서 확인할 수 있습니다. [조작법과 실행 안내](03-litoral/README.md)
