# MediaSender

카카오톡 메신저봇R용 파일 전송 모듈

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


## 설치 및 사용법

### 1. 의존성 (추천, 필수 아님)
```javascript
/** @see https://cafe.naver.com/nameyee/50218 */
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

// base64 / Java 바이트 배열 파일 전송
MediaSender.send(channelId, "data:image/png;base64;...");
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

### `MediaSender.send(channelId, path, timeout, fileName, saveCache)`

파일을 지정된 채널에 전송합니다.

#### 매개변수
- `channelId: string|bigint`: 전송할 채널 ID
- `path: string|string[]`: 전송할 파일 경로 또는 파일 경로 배열
- `timeout?: number`: 다운로드 타임아웃 (기본값: 30000ms)
- `fileName?: string`: 파일명을 지정합니다
- `saveCache?: boolean`: 내장 경로의 파일이 아닌 경우, 해당 파일을 기기 내에 저장합니다. 추후 다운로드 없이 즉시 전송 가능합니다

#### 반환값
- `boolean`: 전송 성공 여부

### `MediaSender.clearCache(target)`

#### 매개변수
- `target?: string|string[]`: 지정된 캐시 파일을 삭제합니다. 값이 빈 경우 모든 캐시를 삭제합니다

### `MediaSender.return(packageName, delay)`

#### 매개변수
- `packageName?: string|string[]`: 특정 앱, 미지정 시 홈 화면으로 이동합니다
- `delay?: number = 5000`: 지정된 시간(ms) 후 동작합니다


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


## 버전 히스토리

### v1.5.0 (2025.12.24)
 - 메신저봇 0.7.40+ (Graal JS) 호환
   - 폴더 변경
   - Intent 설정 관련 호환성 문제 해결
 - 방 이름으로 전송할 채팅방 지정 가능

### v1.4.1 (2025.10.05)
 - `return(packageName?: string): boolean` 추가

### v1.4.0 (2025.09.22)
- Base64, ByteArray 입력 지원
- 외부 데이터에 대한 캐싱 옵션 지원
- 캐시 관련 설정 추가 (`MAX_CACHE_ITEMS`, `clearCache()`)
- 파일 확장자 추출 시 간혹 발생하던 오류 수정
- 0.7.36a 버전 호환
- 성능 최적화 및 가독성 향상

### v1.3.1 (2025.07.25)
- '다른 앱 위에 표시' 권한 확인 추가
- 권한이 없을 경우 로그에 권한 요청 메시지 추가

### v1.3.0 (2025.07.25)
- multiTask 모듈 의존성을 필수 -> 권장으로 변경
- multiTask 모듈이 없을 경우, 파일 다운로드를 동기적으로 처리하도록 수정
- 동일 url 입력 시 캐싱

### v1.2.5 (2025.07.14)
- 메신저봇 v0.7.34a에서도 지원하도록 수정

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


## 라이선스

CC BY-NC-SA 4.0

## 작성자

Hehee