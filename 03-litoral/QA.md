# LITORAL 검증 기록

2026-09-22, 로컬 Google Chrome(headless)에서 검증.

- `npm run build`: 성공. JS 781.71 kB / gzip 208.59 kB. 번들 크기 안내 경고 1건.
- `npm test`: 6개 통과. 충돌 통과 방지, 벽면 슬라이딩, 바다 경계, 점프/착지,
  잘못된 저장 데이터 복구, 캐릭터 선택 저장과 이전 저장 형식 호환.
- 브라우저 검증: 게임 29개 + 캐릭터 20개 = 49개 통과. `npm run test:e2e`로 두 묶음을 실행.
  게임 검사는 시작, 캐릭터 크기/위치, 이동, 달리기/체력,
  점프/착지, 카메라 회전, 일시정지, 그래픽 설정, 지도, 장소 네 곳 기록,
  완주, 새로고침 후 복원, PNG 저장, 오디오, 출발점 복귀, 모바일 조이스틱/저화질.
- 캐릭터 검사는 여성 기본값, 얼굴/전신 미리보기, 골격 변환 후 비율과 발 위치,
  여성 걷기/달리기/점프/착지, 선택 중 이동 차단, 남녀 전환, 위치·진행도 보존,
  일시정지·시작 화면으로 취소, 선택 복원, 모바일 선택·전환·버튼 노출.
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
| `female-full.png`, `female-face.png` | 여성 모델 전신과 얼굴 확대 |
| `female-walk.png`, `female-run.png`, `female-jump.png` | 여성 캐릭터 실제 조작 |
| `male-full.png` | 남성 모델 선택 |
| `mobile-character.png`, `mobile-character-face.png` | 375px 캐릭터 선택 화면 |
| `character-results.json` | 캐릭터 관련 20개 검사 결과 |

범위: 작은 가상 해안 마을 탐험. 건물 내부, 수영, 전투는 구현하지 않습니다.
고화질 성능은 GPU에 따라 달라지며 기본값은 균형입니다. 에셋 약 47 MiB는 모두 로컬 제공.
여성 모델은 실제 인체 비율과 사진 기반 재질을 적용한 실사풍 3D 모델입니다.
