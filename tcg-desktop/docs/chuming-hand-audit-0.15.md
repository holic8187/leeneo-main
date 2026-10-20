# 츄밍 손 일러스트 점검 — 0.15

2026-10-20. 사용자가 요청한 기존 일러스트 교체. 모든 원본 9장을 `view_image`로 직접 확인했고, 내장 `image_gen`을 카드별로 1회씩 사용해 6장을 보정했다. CLI/API 폴백과 Python 이미지 편집은 사용하지 않았다. WebP 소비 경로는 생성된 PNG를 Sharp로 형식 변환만 하여 유지했다.

## 점검 결과

| 등급 | 조치 | 확인 사항 |
| --- | --- | --- |
| C | 손 보정 | 뻗은 손의 과한 손가락 간격·손목과 엄지 형상을 정돈 |
| U | 원본 유지 | 마이크를 쥔 손, 무릎에 놓인 손의 연결과 방향에 뚜렷한 오류 없음 |
| R | 손 보정 | 뻗은 손의 손가락 길이와 관절·손바닥 형상 정돈 |
| RR | 손 보정 | 뻗은 손의 손가락 비율과 손목 연결 정돈 |
| RRR | 손 보정 | 여우를 향하는 손등과 손가락 분리를 명확하게 정돈 |
| SR | 원본 유지 | 가슴에 얹은 손과 마이크를 쥔 손의 연결에 뚜렷한 오류 없음 |
| HR | 손 보정 | 머리 위 손의 얽힌 손가락을 분리하여 명확한 다섯 손가락으로 정돈 |
| UR | 원본 유지 | 팔과 손의 연결, 마이크를 쥔 동작에 뚜렷한 오류 없음 |
| SSR | 손·팔 연결 보정 | 가슴 위 손을 왼손 방향으로 다시 그리고 왼쪽 어깨–팔꿈치–손목 연결을 명확하게 수정 |

원래 얼굴·표정·헤어·의상·여우·배경·등급별 연출은 보존했다. 출력물은 생성 후 직접 육안 검수하고 기존 사용 경로에 저장했다. 배포 준비 중 PNG를 소비하던 U/RRR/SR/UR/SSR은 디코딩 RGBA 해시가 동일한 무손실 WebP로 변환했다. 이제 츄밍 9종의 최종 소비 경로는 모두 `tcg-desktop/public/assets/cards/chuming-<rarity>.webp`이며, 해당 PNG 원본은 `tcg-desktop/docs/art-originals-0.15/`에 로컬 보관한다(빌드·Git 중복 제외). 해부학적 판정은 이미지의 시각적 검수이며 자동화 검사 결과가 아니다.

## 생성 기록
### chuming-c

- 도구: built-in image_gen
- 원본/최종: `tcg-desktop/public/assets/cards/chuming-c.webp`
- 생성 원본: `C:\Users\USER\.codex\generated_images\01a156a9-d98b-7413-a127-27d435bd953c\exec-7522e792-dcfb-449f-aaba-47807c95dce7.png`
- 프롬프트:

```text
Use case: precise-object-edit. Image 1 is the exact edit target for a portrait game card illustration. Change ONLY Chuming's outstretched LEFT hand on viewer-right. Replace its incorrect reversed thumb anatomy with a natural welcoming LEFT hand, palm turned slightly upward rather than flat toward the viewer. Four gracefully separated fingers reach toward the upper-right, the SHORT thumb branches from the lower edge of that hand toward her own torso, with a convincing thumb web and wrist. Use a gentle relaxed gesture, not a five-point star. Preserve exactly two hands; her RIGHT hand still holds the microphone normally. Keep the simple pale-blue plain background and small stars, character placement, wink, cyan-and-pink twin tails, white fox, navy/gold costume, lighting and C rarity simplicity unchanged. Keep original composition and all unmentioned pixels as close as possible. Do not mirror the picture. Exactly five fingers per human hand, no extra limbs. No text, labels, frame or watermark. Preserve original portrait aspect ratio.
```

### chuming-r

- 도구: built-in image_gen
- 원본/최종: `tcg-desktop/public/assets/cards/chuming-r.webp`
- 생성 원본: `C:\Users\USER\.codex\generated_images\01a156a9-d98b-7413-a127-27d435bd953c\exec-50dc6f2b-c589-4747-9fe4-e28c32bc2f08.png`
- 프롬프트:

```text
Use case: precise-object-edit. Image 1 is the exact edit target for a portrait game card illustration. Change ONLY Chuming's outstretched LEFT hand on viewer-right. Repair reversed thumb anatomy: a believable LEFT palm tilted slightly upward in a relaxed reaching gesture, four distinct tapered fingers directed upper-right and a short thumb on the lower edge toward her torso. Correct thumb web, knuckles and wrist, no spidery or equally long fingers. Preserve her other hand and microphone, wink, face, cyan-and-pink twin tails, white fox, navy/gold costume, shooting star, concert stage, background and R rarity visual richness unchanged. Keep original composition and all unmentioned pixels as close as possible. Do not mirror the picture. Exactly five fingers per human hand, no extra limbs. No text, labels, frame or watermark. Preserve original portrait aspect ratio.
```

### chuming-rr

- 도구: built-in image_gen
- 원본/최종: `tcg-desktop/public/assets/cards/chuming-rr.webp`
- 생성 원본: `C:\Users\USER\.codex\generated_images\01a156a9-d98b-7413-a127-27d435bd953c\exec-4cff9f99-cc7f-435f-9bfc-28e75679f79b.png`
- 프롬프트:

```text
Use case: precise-object-edit. Image 1 is the exact edit target for a portrait game card illustration. Repair ONLY the outstretched left hand on the upper-right: keep the same reaching pose, but redraw relaxed natural proportions, convincing foreshortening, distinct knuckles, four gently fanned fingers and a distinctly shorter anatomical thumb, coherent wrist. Keep face, wink, hair, outfit, white fox, spectacular galaxy concert background identical. Keep original composition, style and all unmentioned elements unchanged. Do not mirror the picture. Exactly two arms/two hands with five digits each. No text, labels, frame or watermark. Preserve original portrait aspect ratio.
```

### chuming-rrr

- 도구: built-in image_gen
- 최종: `tcg-desktop/public/assets/cards/chuming-rrr.webp` (원본 PNG는 로컬 보관소에 유지)
- 생성 원본: `C:\Users\USER\.codex\generated_images\01a156a9-d98b-7413-a127-27d435bd953c\exec-96293e03-5768-4e81-bf6a-db5fd77c476c.png`
- 프롬프트:

```text
Use case: precise-object-edit. Image 1 is the exact edit target for a portrait game card illustration. Repair ONLY the hand reaching downward toward the white fox at center-right. Show the BACK of her LEFT hand with natural knuckles, four gently spread fingers and a short thumb, all five digits clearly separated with no merged or missing finger. The hand follows her existing left forearm naturally in a graceful palm-down gesture toward the fox. Keep microphone grip, face, eyes, hair, entire costume, body position, fox, starry terrace and background identical. Keep original composition, style and all unmentioned elements unchanged. Do not mirror the picture. Exactly two arms/two hands with five digits each. No text, labels, frame or watermark. Preserve original portrait aspect ratio.
```

### chuming-hr

- 도구: built-in image_gen
- 원본/최종: `tcg-desktop/public/assets/cards/chuming-hr.webp`
- 생성 원본: `C:\Users\USER\.codex\generated_images\01a156a9-d98b-7413-a127-27d435bd953c\exec-fda70567-4c6a-4bed-8003-79bdc0090693.png`
- 프롬프트:

```text
Use case: precise-object-edit. Image 1 is the exact edit target: Chuming HR portrait card illustration. Repair ONLY her raised hand at the very top center-right. Keep the same arm raised toward the galaxy, but give it a clearly readable graceful open hand with four naturally spaced curved fingers and one shorter thumb in a correct perspective, five digits total, distinct joints and coherent wrist. Remove the tangled overlapping finger shapes; modest relaxed fan rather than extreme spreading, no excessively long fingers. Preserve her other hand gripping the microphone, face, singing expression, cyan/pink hair, navy-gold star idol costume, small white fox, galaxy and crystalline stage, existing lighting, rich HR effects, original framing and portrait aspect ratio. No extra limb, no mirrored whole image, no text/frame/watermark.
```

### chuming-ssr

- 도구: built-in image_gen
- 최종: `tcg-desktop/public/assets/cards/chuming-ssr.webp` (원본 PNG는 로컬 보관소에 유지)
- 생성 원본: `C:\Users\USER\.codex\generated_images\01a156a9-d98b-7413-a127-27d435bd953c\exec-0a16ce42-9732-49a8-b44c-f8837a4ab31c.png`
- 프롬프트:

```text
Use case: precise-object-edit. Image 1 is the exact edit target, a portrait game card illustration of Chuming. Repair ONLY the anatomical error in her left arm and the hand over her heart. Her anatomical right hand, on viewer-left, continues holding the microphone unchanged. Her anatomical LEFT arm starts at the bare shoulder on viewer-right; show a coherent upper arm going down to a clearly bent elbow near her waist, then a connected forearm rising diagonally across her torso to her heart. The back of her LEFT hand is visible against her chest: four natural tapered fingers point toward viewer-left/upper-left, with the thumb on the anatomically correct side. Exactly one left arm, one left wrist, five total digits, no extra arm, no floating hand. The existing hand currently points the wrong way; redraw that hand and the connecting forearm naturally, do not merely mirror the whole illustration. Keep her face, eyes, cyan-and-pink twin tails, expression, navy/gold star idol costume, microphone, small white fox, galaxy, crystalline stairs, stars, lighting, framing, painterly anime quality and spectacular SSR richness unchanged. No labels, text, watermark, frame or new props. Preserve the original portrait aspect ratio.
```
