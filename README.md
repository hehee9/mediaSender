# MediaSender

카카오톡 메시지봇용 파일 전송 모듈

## 개요

MediaSender는 카카오톡 메시지봇에서 파일을 전송하기 위한 JavaScript 모듈입니다. 이미지, 동영상, 문서 등 다양한 파일 형식을 지원하며, 온라인 URL에서 파일을 다운로드하여 전송할 수도 있습니다.

## 주요 기능

- ✅ 미디어 파일 형식 지원 (이미지, 동영상, 음성)
- ✅ 온라인 URL에서 파일 자동 다운로드
- ✅ 단일 파일 및 다중 파일 전송
- ✅ Android Intent를 통한 카카오톡 전송
- ✅ 임시 파일 자동 정리

## 버전 히스토리

### v1.0.0 (2025.02.19)
- 초기 버전
- 기본 파일 전송 기능
- 단일 및 다중 파일 전송 지원
- 온라인 파일 다운로드 지원

## 설치 및 사용법

### 1. 의존성
```javascript
const multiTask = require("multiTask");
```

### 2. 모듈 가져오기
```javascript
const MediaSender = require("./mediaSender");
```

### 3. 사용 예시

#### 단일 파일 전송
```javascript
// 로컬 파일 전송
MediaSender.send(channelId, "/sdcard/Pictures/image.jpg");

// 온라인 파일 전송
MediaSender.send(channelId, "https://example.com/image.jpg");
```

#### 다중 파일 전송
```javascript
const files = [
    "/sdcard/Pictures/image1.jpg",
    "https://example.com/image2.jpg",
    "/sdcard/Documents/document.pdf"
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

> **참고**: v1.0.0에서는 문서 및 압축파일 전송이 제대로 지원되지 않습니다.

## 라이선스

CC BY-NC-SA 4.0

## 작성자

Hehee

## 링크

- [네이버 카페 - 메신저봇R](https://cafe.naver.com/nameyee) 