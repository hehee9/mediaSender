# MediaSender

카카오톡 메시지봇용 파일 전송 모듈

## 개요

MediaSender는 카카오톡 메시지봇에서 파일을 전송하기 위한 JavaScript 모듈입니다. 이미지, 동영상, 문서 등 다양한 파일 형식을 지원하며, 온라인 URL에서 파일을 다운로드하여 전송할 수도 있습니다.

## 주요 기능

- ✅ 다양한 파일 형식 지원 (이미지, 동영상, 음성, 문서, 압축파일 등)
- ✅ 온라인 URL에서 파일 자동 다운로드
- ✅ 단일 파일 및 다중 파일 전송
- ✅ Content Provider를 통한 안전한 파일 전송
- ✅ 확장자 자동 추출
- ✅ 자동 미디어 스캔 및 임시 파일 정리
- ✅ 메모리 누수 방지

## 버전 히스토리

### v1.2.4 (2025.07.09)
- 파일 경로 문자열 변환 오류 수정 (java.lang.String -> JS String 항상 변환)

### v1.2.3 (2025.07.02)
- 텍스트 기반 파일이 전송되지 않는 문제 수정

### v1.2.2 (2025.07.01)
- 일부 mp3 파일을 제대로 인식하지 못하는 문제 수정

### v1.2.1 (2025.07.01)
- 확장자 추출 로직 개선 (화이트리스트 기반 검증)
- URL에서 확장자 추출 불가 시, 파일 시그니처 분석으로 확장자 추측 기능 추가

### v1.2.0 (2025.06.30)
- 여러 파일을 다운로드 했을 때, 1번째 파일만 삭제하는 문제 해결
- Content Provider를 이용해 zip, pdf 등의 파일도 전송 가능
- 파일 다운로드 시 확장자 추출 개선
- 메모리 누수 방지 강화
- 기타 최적화

### v1.1.0 (2025.03.26)
- 앱 리프레시에 의한 이미지 전송 실패 문제 해결
- Mediascan을 추가하여 안전성 강화

### v1.0.0 (2025.02.19)
- 초기 버전

## 설치 및 사용법

### 1. 의존성
```javascript
const multiTask = require("multiTask");
```

### 2. 모듈 가져오기
```javascript
const MediaSender = require("mediaSender");
```

### 3. 사용 예시

#### 단일 파일 전송
```javascript
// 로컬 파일 전송
MediaSender.send(channelId, "sdcard/Pictures/image.jpg");

// 온라인 파일 전송
MediaSender.send(channelId, "https://example.com/image.jpg");
```

#### 다중 파일 전송
```javascript
const files = [
    "sdcard/Pictures/image1.jpg",
    "https://example.com/image2.jpg",
    "sdcard/Documents/document.pdf"
];
MediaSender.send(channelId, files);
```

## API 참조

### `MediaSender.send(channelId, path, timeout)`

파일을 지정된 채널에 전송합니다.

#### 매개변수
- `channelId` (string|bigint): 전송할 채널 ID
- `path` (string|string[]): 전송할 파일 경로 또는 파일 경로 배열
- `timeout` (number, 선택사항): 다운로드 타임아웃 (기본값: 30000ms)

#### 반환값
- `boolean`: 전송 성공 여부

## 지원하는 파일 형식

### 이미지
jpg, jpeg, gif, bmp, png, tif, tiff, tga, psd, ai

### 동영상
mp4, m4v, avi, asf, wmv, mkv, ts, mpg, mpeg, mov, flv, ogv

### 음성
mp3, wav, flac, tta, tak, aac, wma, ogg, m4a
* 오디오 파일은 Multiple로 전송 시 첨부파일이 아닌 음성 메시지로 전송됩니다.

### 문서
doc, docx, hwp, txt, rtf, xml, pdf, wks, xps, md, odf, odt, ods, odp, csv, tsv, xls, xlsx, ppt, pptx, pages, key, numbers, show, ce

### 압축파일
zip, gz, bz2, rar, 7z, lzh, alz

## 라이선스

CC BY-NC-SA 4.0

## 작성자

Hehee

## 링크

- [네이버 카페 - 메신저봇R](https://cafe.naver.com/nameyee) 
