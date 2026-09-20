# 릴스·카드뉴스 생성기

1차의료기관(의원급) 인스타그램 콘텐츠를 원고 하나(`content.json`)로 만든다.
**기본 산출물은 릴스용 세로 동영상(MP4)** 이고, 같은 원고로 카드뉴스 8장도 뽑는다.
브라우저 없이 만들기 때문에 클라우드 샌드박스에서도 돈다.

## 빠른 실행

```bash
npm install
node render-reel.mjs     # content.json → out_reel/reel.mp4 (기본)
node render-svg.mjs      # content.json → out/card-01.png ~ card-08.png (요청 시)
```

`out_reel/` 에 1080×1920 MP4, 썸네일 `cover.jpg`, `caption.txt` 가 생긴다.
`out/` 에 2160×2700 PNG 8장과 `out/caption.txt` 가 생긴다.

두 렌더러 모두 본문이 안전영역을 넘으면 **넘침 경고**를 찍는다. 경고가 0건이 될 때까지
글자를 줄이고 다시 렌더한다.

## 구조

| 파일 | 역할 |
|---|---|
| `CLAUDE.md` | 이 저장소의 기본값. 산출물은 영상 |
| `reel.md` / `cardnews.md` | 주제를 받아 한 편을 만드는 작업 흐름 |
| `content.json` | 원고. 이것만 바꾸면 새 카드뉴스가 된다 |
| `card-svg.mjs` | **카드 조판 엔진.** opentype.js 로 글자폭을 계산해 SVG 를 조립한다. 캔버스 비율을 인자로 받아 4:5 와 9:16 이 같은 코드를 쓴다 |
| `render-svg.mjs` | 캐러셀 렌더러. 1080×1350 을 2배로 resvg 래스터화 |
| `render-reel.mjs` | **릴스 렌더러.** 9:16 장면을 뽑아 켄번스 줌 + 슬라이드 전환으로 MP4 인코딩 |
| `template.html` | 구버전(크롬/playwright) 렌더용. `render.mjs` 와 한 쌍 |
| `render.mjs` | 구버전 렌더러. playwright 필요. 클라우드에서는 못 쓴다 |
| `compress.mjs` | 업로드용 축소 (1080×1350 JPEG) |
| `make-photos.mjs` | 실사 이미지 생성 (OpenAI) |
| `make-character.mjs` | 고정 캐릭터 시트 + 캐릭터 기반 일러스트 생성 |
| `swap-img.mjs` / `use-photos.mjs` | content.json 의 이미지 경로 일괄 교체 |
| `images/*.svg` | 손으로 그린 일러스트 (허리주사 편) |

## 릴스 (`render-reel.mjs`)

같은 `content.json` 을 9:16 으로 다시 조판한다. 카드를 레터박스로 욱여넣지 않고
1080×1920 캔버스에 새로 앉히기 때문에 글자 크기와 여백이 그대로 살아 있다.

```bash
node render-reel.mjs                    # out_reel/reel.mp4
node render-reel.mjs --audio bgm.m4a    # 배경음 깔기 (없으면 무음 트랙)
node render-reel.mjs --style fade       # 전환 방식 (기본 slideleft)
node render-reel.mjs --out out_reel2 --content other.json
```

| 옵션 | 기본값 | 설명 |
|---|---|---|
| `--content` | `content.json` | 원고 파일 |
| `--out` | `out_reel` | 출력 폴더 |
| `--fps` | `30` | 프레임레이트 |
| `--transition` | `0.45` | 전환 길이(초) |
| `--style` | `slideleft` | xfade 전환 종류. `fade` 는 앞뒤 카드 글자가 겹쳐 읽힌다 |
| `--audio` | (없음) | 배경음 파일. 길이에 맞춰 반복·페이드된다 |

- **장면 길이**는 글자 수에서 자동 계산한다 (약 15자/초 + 고정 2.2초, 2.8~5.2초 범위).
  표지는 훅이라 0.5초 더 붙잡는다. 8장 기준 총 35~40초.
- **안전 영역**: 상단 120px, 하단 360px 은 인스타 UI(캡션·버튼)가 덮으므로 비워 둔다.
  `card-svg.mjs` 의 `SIZES.reel.safeTop / safeBottom` 에서 조정한다.
- **움직임**: 장면마다 5% 느린 줌을 걸고 방향을 번갈아 준다. 전환은 슬라이드.
- 무음이어도 AAC 트랙을 넣는다. 오디오가 없는 파일은 업로드에서 탈이 나는 경우가 있다.
- `out_reel/cover.jpg` 는 릴스 커버로 지정할 첫 장면이다.

ffmpeg 는 `ffmpeg-static` 패키지의 것을 쓴다. 시스템 설치가 필요 없다.

## content.json 형식

```json
{
  "meta": {
    "label": "허리주사",
    "imageMode": "bleed",
    "caption": "인스타 캡션",
    "hashtags": ["#허리통증"]
  },
  "cards": [
    { "type": "cover", "title": "제목 [형광펜]", "sub": "부제", "image": "images_photo/1.png" },
    { "type": "point", "title": "...", "text": "...", "image": "..." },
    { "type": "list",  "title": "...", "items": ["...", "..."] },
    { "type": "quote", "title": "...", "by": "..." },
    { "type": "cta",   "title": "...", "text": "..." }
  ]
}
```

- `[대괄호]` 로 감싼 어절이 노란 형광펜으로 강조된다. 한 장에 한 곳.
- `imageMode: "bleed"` 면 사진이 카드 상단을 꽉 채우고 아래로 배경색 페이드된다.
  빼면 이미지가 본문 아래 인라인으로 들어간다 (투명 배경 일러스트용).
- `type: cover / quote / cta` 는 어두운 카드, 나머지는 밝은 카드.

## 글자수 상한

| 항목 | 상한 |
|---|---|
| cover title | 20자 |
| point title | 25자 |
| text | 60자 |
| list item | 12자 |

제목이 두 줄로 넘어갈 때 마지막 줄에 한 어절만 남지 않게 어절 길이를 조절할 것.

## 색

| 토큰 | 값 | 용도 |
|---|---|---|
| ink | `#0E1116` | 어두운 카드 배경 |
| paper | `#E9EAEC` | 밝은 카드 배경 |
| accent | `#F2C230` | 형광펜, 어두운 카드 위 글자 |
| accent-deep | `#8A6A00` | 밝은 카드 위 글자 |

밝은 배경에 `#F2C230` 을 글자로 쓰면 안 보인다. 두 톤을 반드시 구분해 쓸 것.

## 이미지 생성 (선택)

`OPENAI_API_KEY` 가 있으면:

```bash
node make-photos.mjs      # 실사
node make-character.mjs   # 고정 캐릭터 일러스트
```

없어도 렌더는 된다. `image` 필드를 빼면 텍스트만으로 카드가 나온다.

## 의료 표현 제약

- 치료 효과 단정 금지 → "도움이 될 수 있습니다"
- 최상급·비교우위 금지 ("최고의", "유일한", "부작용 없는")
- 수치에는 조건 명시 (대상·연도·연구)
- 부작용·금기가 있으면 반드시 함께
- 마지막 장에 "전문의 상담" 문구
- red flag 가 있는 주제면 반드시 포함
