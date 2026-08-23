# 카드뉴스 생성기

1차의료기관(의원급) 인스타그램 카드뉴스 8장을 만든다.
브라우저 없이 PNG 를 만들기 때문에 클라우드 샌드박스에서도 돈다.

## 빠른 실행

```bash
npm install
node render-svg.mjs      # content.json → out/card-01.png ~ card-08.png
```

`out/` 에 2160×2700 PNG 8장과 `out/caption.txt` 가 생긴다.

## 구조

| 파일 | 역할 |
|---|---|
| `content.json` | 원고. 이것만 바꾸면 새 카드뉴스가 된다 |
| `render-svg.mjs` | **메인 렌더러.** opentype.js 로 글자폭을 계산해 SVG 를 조립하고 resvg 로 PNG 화 |
| `template.html` | 구버전(크롬/playwright) 렌더용. `render.mjs` 와 한 쌍 |
| `render.mjs` | 구버전 렌더러. playwright 필요. 클라우드에서는 못 쓴다 |
| `compress.mjs` | 업로드용 축소 (1080×1350 JPEG) |
| `make-photos.mjs` | 실사 이미지 생성 (OpenAI) |
| `make-character.mjs` | 고정 캐릭터 시트 + 캐릭터 기반 일러스트 생성 |
| `swap-img.mjs` / `use-photos.mjs` | content.json 의 이미지 경로 일괄 교체 |
| `images/*.svg` | 손으로 그린 일러스트 (허리주사 편) |

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
