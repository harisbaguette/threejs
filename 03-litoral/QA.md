# LITORAL 검증 기록

2026-09-22, 로컬 Google Chrome(headless)에서 검증.

- `npm run build`: 성공. JS 752.09 kB / gzip 201.16 kB.
- `npm test`: 5개 통과. 충돌 통과 방지, 벽면 슬라이딩, 바다 경계, 점프/착지, 잘못된 저장 데이터 복구.
- `npm run test:e2e`: 29개 통과. 시작, 캐릭터 크기/위치, 이동, 달리기/체력,
  점프/착지, 카메라 회전, 일시정지, 그래픽 설정, 지도, 장소 네 곳 기록,
  완주, 새로고침 후 복원, PNG 저장, 오디오, 출발점 복귀, 모바일 조이스틱/저화질.
- 브라우저 오류·실패한 에셋 요청·WebGL 오류: 0.
- 1440×900 데스크톱과 375×812 모바일 스크린샷을 실제로 확인.
- 디자인 lint: ERROR 0. WARN은 3D/Canvas 색상값과 작은 게임 HUD 라벨 등의 정적 규칙 경고.

이미지와 상세 결과는 `test-results/`에 생성됩니다(Git 제외).

| 파일 | 확인 내용 |
|---|---|
| `desktop-intro.png` | 시작 화면과 해안 마을 구도 |
| `desktop-game.png` | 실제 인체 모델과 게임 HUD |
| `desktop-high.png` | SSAO가 켜진 고화질 장면 |
| `desktop-map.png` | 지도와 장소 기록 |
| `lighthouse.png` | 네 곳 기록 완료 |
| `mobile-intro.png` | 좁은 화면 시작 UI |
| `mobile-game.png` | 조이스틱, 점프/달리기, 실제 이동 |
| `postcard.png` | 다운로드된 게임 화면 |
| `results.json` | 29개 검사 결과와 렌더 상태 |

범위: 작은 가상 해안 마을 탐험. 건물 내부, 수영, 전투는 구현하지 않습니다.
고화질 성능은 GPU에 따라 달라지며 기본값은 균형입니다. 에셋 약 24 MB는 모두 로컬 제공.
