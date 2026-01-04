/**
 * @module MediaSender
 * @description 파일 전송 모듈
 * 
 * @author Hehee
 * @license CC BY-NC-SA 4.0
 * @since 2025.02.19
 * @version 1.5.1
 */

/**
 * @changeLog
 * v1.5.1 (2026.01.04)
 * - 각종 효율성 개선
 *   - 다중 파일 전송 시 메타데이터 I/O 감소 (N회 → 1회)
 *   - SHA-256 Hex 변환 최적화 (O(n²) → O(n))
 *   - Java byte[] 판별 최적화 (fast path 우선)
 *   - 파일 시그니처 매칭 최적화 (첫 바이트 인덱싱)
 *
 * v1.5.0 (2025.12.24)
 * - 메신저봇 0.7.40+ (Graal JS) 호환
 *   - 폴더 변경
 *   - Intent 설정 관련 호환성 문제 해결
 * - 방 이름으로 전송할 채팅방 지정 가능
 * 
 * v1.4.1 (2025.10.05)
 * - `return(packageName?: string): boolean` 추가
 * 
 * v1.4.0 (2025.09.22)
 * - Base64, ByteArray 입력 지원
 * - 외부 데이터에 대한 캐싱 옵션 지원
 * - 캐시 관련 설정 추가 (`MAX_CACHE_ITEMS`, `clearCache()`)
 * - 파일 확장자 추출 시 간혹 발생하던 오류 수정
 * - 0.7.36a 버전 호환
 * - 성능 최적화 및 가독성 향상
 * 
 * v1.3.1 (2025.07.25)
 * - '다른 앱 위에 표시' 권한 확인 추가
 * - 권한이 없을 경우 로그에 권한 요청 메시지 추가
 * 
 * v1.3.0 (2025.07.25)
 * - multiTask 모듈 의존성을 필수 -> 권장으로 변경
 * - multiTask 모듈이 없을 경우, 파일 다운로드를 동기적으로 처리하도록 수정
 * - 동일 url 입력 시 캐싱
 * 
 * v1.2.5 (2025.07.14)
 * - 메신저봇 v0.7.34a에서도 지원하도록 수정
 * 
 * v1.2.4 (2025.07.09)
 * - 파일 경로 문자열 변환 오류 수정 (java.lang.String -> JS String 항상 변환)
 * 
 * v1.2.3 (2025.07.02)
 * - 텍스트 기반 파일이 전송되지 않는 문제 수정
 * 
 * v1.2.2 (2025.07.01)
 * - 일부 mp3 파일을 제대로 인식하지 못하는 문제 수정
 * 
 * v1.2.1 (2025.07.01)
 * - 확장자 추출 로직 개선 (화이트리스트 기반 검증)
 * - URL에서 확장자 추출 불가 시, 파일 시그니처 분석으로 확장자 추측 기능 추가
 * 
 * v1.2.0 (2025.06.30)
 * - 여러 파일을 다운로드 했을 때, 1번째 파일만 삭제하는 문제 해결
 * - Content Provider를 이용해 zip, pdf 등의 파일도 전송 가능
 * - 파일 다운로드 시 확장자 추출 개선
 * - 메모리 누수 방지 강화
 * - 기타 최적화
 * 
 * v1.1.0 (2025.03.26)
 * - 앱 리프레시에 의한 이미지 전송 실패 문제 해결 @see https://cafe.naver.com/nameyee/50574
 * - Mediascan을 추가하여 안전성 강화
 * 
 * v1.0.0 (2025.02.19)
 * - 초기 버전
 */




/* =================================== 상수/전역 =================================== */


const CONFIG = {
    Intent: Packages.android.content.Intent,
    Uri: Packages.android.net.Uri,
    URL: Packages.java.net.URL,
    Base64: Packages.android.util.Base64,
    HttpURLConnection: Packages.java.net.HttpURLConnection,
    Arrays: Packages.java.util.Arrays,
    File: Packages.java.io.File,
    Long: Packages.java.lang.Long,
    Integer: Packages.java.lang.Integer,
    MediaScannerConnection: Packages.android.media.MediaScannerConnection,
    FileProvider: Packages.androidx.core.content.FileProvider,
    ArrayList: Packages.java.util.ArrayList,
    Settings: Packages.android.provider.Settings,
    Bundle: Packages.android.os.Bundle
};


const FILE_PROVIDER_AUTHORITY = "com.xfl.msgbot.provider";


const MEDIA_DIR = "sdcard/msgbot_media/";
const CACHE_DIR = MEDIA_DIR + ".mediaSender_cache/";
const CACHE_META_PATH = CACHE_DIR + "metadata.json";
const MAX_CACHE_ITEMS = 200;


const IO_BUFFER_SIZE = 16384;
const SIGNATURE_READ_BYTES = 256;
const UTF8 = "UTF-8";
const BYTES_PREFIX = new java.lang.String("BYTES|").getBytes(UTF8);


const MIME_MAP = {
    // 이미지
    "jpg": "image/jpeg", "jpeg": "image/jpeg",
    "gif": "image/gif",
    "bmp": "image/bmp",
    "png": "image/png",
    "tif": "image/tiff", "tiff": "image/tiff", "tga": "image/x-tga",
    "psd": "image/vnd.adobe.photoshop", "ai": "application/postscript",
    "webp": "image/webp",
    // 동영상
    "mp4": "video/mp4", "m4v": "video/mp4", "avi": "video/x-msvideo",
    "asf": "video/x-ms-asf", "wmv": "video/x-ms-wmv",
    "mkv": "video/x-matroska", "ts": "video/mp2t",
    "mpg": "video/mpeg", "mpeg": "video/mpeg",
    "mov": "video/quicktime", "flv": "video/x-flv", "ogv": "video/ogg",
    // 음성
    "mp3": "audio/mpeg", "wav": "audio/wav", "flac": "audio/flac",
    "tta": "audio/x-tta", "tak": "audio/x-tak",
    "aac": "audio/aac", "wma": "audio/x-ms-wma",
    "ogg": "audio/ogg", "m4a": "audio/mp4",
    // 문서 및 기타
    "doc": "application/msword", "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "hwp": "application/x-hwp", "txt": "text/plain",
    "rtf": "application/rtf", "xml": "application/xml",
    "pdf": "application/pdf", "wks": "application/vnd.ms-works", "xps": "application/vnd.ms-xpsdocument",
    "md": "text/markdown",
    "odf": "application/vnd.oasis.opendocument.text", "odt": "application/vnd.oasis.opendocument.text", "ods": "application/vnd.oasis.opendocument.spreadsheet", "odp": "application/vnd.oasis.opendocument.presentation",
    "csv": "text/csv", "tsv": "text/tab-separated-values",
    "xls": "application/vnd.ms-excel", "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "ppt": "application/vnd.ms-powerpoint", "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "pages": "application/x-iwork-pages-sffpages", "key": "application/x-iwork-keynote-sffkey", "numbers": "application/x-iwork-numbers-sffnumbers",
    "show": "application/octet-stream", "ce": "application/octet-stream",
    // 압축파일
    "zip": "application/zip", "gz": "application/gzip",
    "bz2": "application/x-bzip2",
    "rar": "application/x-rar-compressed",
    "7z": "application/x-7z-compressed",
    "lzh": "application/x-lzh", "alz": "application/x-alz-compressed"
};
const SIGNATURES = [
    { exts: ['jpg', 'jpeg'], sig: [0xFF, 0xD8, 0xFF] },
    { exts: ['png'], sig: [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A] },
    { exts: ['gif'], sig: [0x47, 0x49, 0x46, 0x38] },
    { exts: ['webp'], offset: 8, sig: [0x57, 0x45, 0x42, 0x50] },
    { exts: ['bmp'], sig: [0x42, 0x4D] },
    { exts: ['tif', 'tiff'], sig: [0x49, 0x49, 0x2A, 0x00] },
    { exts: ['tif', 'tiff'], sig: [0x4D, 0x4D, 0x00, 0x2A] },
    { exts: ['psd'], sig: [0x38, 0x42, 0x50, 0x53] },
    { exts: ['ai'], sig: [0x25, 0x21] },
    { exts: ['pdf'], sig: [0x25, 0x50, 0x44, 0x46] },
    { exts: ['hwp'], sig: [0x48, 0x57, 0x50, 0x20, 0x44, 0x6F, 0x63, 0x75, 0x6D, 0x65, 0x6E, 0x74, 0x20, 0x46, 0x69, 0x6C, 0x65] },
    { exts: ['doc', 'xls', 'ppt'], sig: [0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1] },
    { exts: ['rtf'], sig: [0x7B, 0x5C, 0x72, 0x74, 0x66, 0x31] },
    { exts: ['zip', 'docx', 'xlsx', 'pptx', 'odt', 'pages', 'key', 'numbers'], sig: [0x50, 0x4B, 0x03, 0x04] },
    { exts: ['rar'], sig: [0x52, 0x61, 0x72, 0x21, 0x1A, 0x07] },
    { exts: ['7z'], sig: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 0x1C] },
    { exts: ['gz'], sig: [0x1F, 0x8B] },
    { exts: ['bz2'], sig: [0x42, 0x5A, 0x68] },
    { exts: ['alz'], sig: [0x41, 0x4C, 0x5A, 0x01] },
    { exts: ['lzh'], offset: 2, sig: [0x2D, 0x6C, 0x68] },
    { exts: ['avi'], sig: [0x52, 0x49, 0x46, 0x46], secondarySig: [0x41, 0x56, 0x49, 0x20], secondaryOffset: 8 },
    { exts: ['wav'], sig: [0x52, 0x49, 0x46, 0x46], secondarySig: [0x57, 0x41, 0x56, 0x45], secondaryOffset: 8 },
    { exts: ['mp4', 'm4v', 'm4a', 'mov'], offset: 4, sig: [0x66, 0x74, 0x79, 0x70] },
    { exts: ['mkv'], sig: [0x1A, 0x45, 0xDF, 0xA3] },
    { exts: ['flv'], sig: [0x46, 0x4C, 0x56] },
    { exts: ['wmv', 'asf', 'wma'], sig: [0x30, 0x26, 0xB2, 0x75, 0x8E, 0x66, 0xCF, 0x11, 0xA6, 0xD9, 0x00, 0xAA, 0x00, 0x62, 0xCE, 0x6C] },
    { exts: ['mpg', 'mpeg'], sig: [0x00, 0x00, 0x01, 0xBA] },
    { exts: ['ts'], sig: [0x47] },
    { exts: ['ogg', 'ogv'], sig: [0x4F, 0x67, 0x67, 0x53] },
    { exts: ['mp3'], sig: [0x49, 0x44, 0x33] },
    { exts: ['mp3'], sig: [0xFF, 0xFB] },
    { exts: ['mp3'], sig: [0xFF, 0xFA] },
    { exts: ['mp3'], sig: [0xFF, 0xF3] },
    { exts: ['mp3'], sig: [0xFF, 0xF2] },
    { exts: ['flac'], sig: [0x66, 0x4C, 0x61, 0x43] },
    { exts: ['aac'], sig: [0xFF, 0xF1] }
];
const SIGNATURE_INDEX = (() => {
    let index = Object.create(null);
    let withOffset = [];
    for (let type of SIGNATURES) {
        let offset = type.offset || 0;
        if (offset === 0 && type.sig.length > 0) {
            let firstByte = type.sig[0];
            (index[firstByte] || (index[firstByte] = [])).push(type);
        } else {
            withOffset.push(type);
        }
    }
    index._withOffset = withOffset;
    return index;
})();
const MIME_TO_EXT = (() => {
    let m = {};
    for (let k in MIME_MAP) {
        let v = MIME_MAP[k];
        if (!m[v]) m[v] = k;
    }
    return m;
})();


/** @description 앱 컨텍스트 획득 (0.7.36a 호환용) */
function _getContext() {
    if (_getContext._ctx) return _getContext._ctx;

    let ctx = null;
    try {
        let ActivityThread = Packages.android.app.ActivityThread;
        if (ActivityThread && ActivityThread.currentApplication) {
            ctx = ActivityThread.currentApplication();
        }
    } catch (_) { }
    if (!ctx) {
        try {
            let AppGlobals = Packages.android.app.AppGlobals;
            if (AppGlobals && AppGlobals.getInitialApplication) {
                ctx = AppGlobals.getInitialApplication();
            }
        } catch (_) { }
    }

    if (!ctx) {
        try {
            if (typeof App !== "undefined") ctx = App.getContext();
            else if (typeof Api !== "undefined") ctx = Api.getContext();
        } catch (_) { }
    }

    if (!ctx) throw new Error("Android Context 획득 실패");
    _getContext._ctx = ctx;
    return ctx;
}
const context = _getContext();
/** @see https://cafe.naver.com/nameyee/50218 */
let multiTask = null;
try {
    multiTask = require("shared/multiTask");
} catch (e) {
    Log.e(`multiTask 모듈 설치를 권장합니다.\nhttps://cafe.naver.com/nameyee/50218`);
}


const hasDrawOverlaysPermission = CONFIG.Settings.canDrawOverlays(context);
if (!hasDrawOverlaysPermission) Log.e("'다른 앱 위에 표시' 권한이 없습니다.\n권한이 없을 경우 메신저봇 앱을 띄워둘 때에만 파일 전송이 가능합니다.\n설정에서 권한을 허용해주세요.");




/* =================================== 헬퍼/유틸 =================================== */


/* ==================== 파일 입출력 ==================== */

/**
 * @description byte[]를 파일로 저장
 * @param {java.io.File} outFile
 * @param {byte[]} bytes
 */
function _writeBytes(outFile, bytes) {
    let bos = null;
    try {
        let fos = new java.io.FileOutputStream(outFile);
        bos = new java.io.BufferedOutputStream(fos, IO_BUFFER_SIZE);
        bos.write(bytes);
    } finally {
        if (bos) bos.close();
    }
}
/**
 * @description 파일 복사
 * @param {java.io.File} srcFile
 * @param {java.io.File} destFile
 */
function _copyFile(srcFile, destFile) {
    let bis = null, bos = null;
    try {
        let fis = new java.io.FileInputStream(srcFile);
        let fos = new java.io.FileOutputStream(destFile);
        bis = new java.io.BufferedInputStream(fis, IO_BUFFER_SIZE);
        bos = new java.io.BufferedOutputStream(fos, IO_BUFFER_SIZE);
        let buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, IO_BUFFER_SIZE);
        let bytesRead;
        while ((bytesRead = bis.read(buffer)) !== -1) {
            bos.write(buffer, 0, bytesRead);
        }
    } finally {
        if (bos) bos.close();
        if (bis) bis.close();
    }
}
/**
 * @description URL을 outFile로 다운로드
 * @param {string} urlStr
 * @param {java.io.File} outFile
 * @param {number} timeout
 */
function _downloadToFile(urlStr, outFile, timeout) {
    let conn = null;
    let bis = null, bos = null;
    try {
        conn = new CONFIG.URL(urlStr).openConnection();
        conn.setConnectTimeout(timeout);
        conn.setReadTimeout(timeout);

        let is = conn.getInputStream();
        let fos = new java.io.FileOutputStream(outFile);
        bis = new java.io.BufferedInputStream(is, IO_BUFFER_SIZE);
        bos = new java.io.BufferedOutputStream(fos, IO_BUFFER_SIZE);

        let buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, IO_BUFFER_SIZE);
        let bytesRead;
        while ((bytesRead = bis.read(buffer)) !== -1) {
            bos.write(buffer, 0, bytesRead);
        }
    } finally {
        if (bos) bos.close();
        if (bis) bis.close();
        try { if (conn && conn.disconnect) conn.disconnect(); } catch (_) {}
    }
}


/** @description 캐시 경로 보장 */
function _ensureCacheDir() {
    let dir = new CONFIG.File(CACHE_DIR);
    if (!dir.exists()) dir.mkdirs();
}
/** @description 캐시 메타데이터 로드 */
function _loadCacheMeta() {
    let raw = FileStream.read(CACHE_META_PATH) || "";
    let meta = { v: 1, items: {} };
    if (raw) {
        try {
            meta = JSON.parse(raw);
            if (!meta.items) meta.items = {};
        } catch (e) {
            Log.e(`${e.name}\n${e.message}\n${e.stack}`);
            meta = { v: 1, items: {} };
        }
    }
    return meta;
}
/**
 * @description 캐시 메타데이터 저장
 * @param {object} meta 메타데이터
 */
function _saveCacheMeta(meta) {
    try {
        _ensureCacheDir();
        FileStream.write(CACHE_META_PATH, JSON.stringify(meta));
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
    }
}
/**
 * @description 배치 처리용 공유 메타 컨텍스트
 * @param {Function} fn 실행할 함수 (meta를 인자로 받음)
 * @returns {any} fn의 반환값
 */
function _withSharedMeta(fn) {
    _ensureCacheDir();
    let meta = _loadCacheMeta();
    let result = fn(meta);
    _evictIfNeeded(meta);
    _saveCacheMeta(meta);
    return result;
}
/**
 * @description 캐시 조회 (메타 공유 버전)
 * @param {object} meta 공유 메타데이터
 * @param {string} key 캐시 키
 * @returns {object|null} 캐시 엔트리
 */
function _getCacheEntry(meta, key) {
    return meta.items[key] || null;
}
/**
 * @description 캐시 업데이트 (메타 공유 버전, 저장은 나중에)
 * @param {object} meta 공유 메타데이터
 * @param {object} update 업데이트 내용
 */
function _updateCacheEntry(meta, update) {
    if (!update || !update.key) return;
    let cur = meta.items[update.key] || {};
    if (update.file) cur.file = update.file;
    if (update.mime) cur.mime = update.mime;
    if (update.ext) cur.ext = update.ext;
    cur.lastUsed = Math.max(cur.lastUsed || 0, update.lastUsed || Date.now());
    if (typeof update.size === "number" && update.size > 0) cur.size = update.size;
    meta.items[update.key] = cur;
}


/* ==================== 연산 헬퍼 ==================== */

const HEX_CHARS = "0123456789abcdef";
/**
 * @description byte[]를 hex 문자열로 변환 (O(n))
 * @param {byte[]} digest 바이트 배열
 * @returns {string} hex 문자열
 */
function _bytesToHex(digest) {
    let arr = new Array(digest.length * 2);
    for (let i = 0; i < digest.length; i++) {
        let b = digest[i] & 0xFF;
        arr[i * 2] = HEX_CHARS.charAt(b >>> 4);
        arr[i * 2 + 1] = HEX_CHARS.charAt(b & 0x0F);
    }
    return arr.join("");
}
/**
 * @description SHA-256 해시
 * @param {string} input 해시할 문자열
 * @returns {string} hex 문자열
 */
function _sha256(input) {
    try {
        if (typeof Security !== "undefined" && Security.sha256) {
            return Security.sha256(input);
        }
    } catch (_) { }
    let MessageDigest = Packages.java.security.MessageDigest;
    let md = MessageDigest.getInstance("SHA-256");
    let bytes = new java.lang.String(input).getBytes(UTF8);
    md.update(bytes);
    return _bytesToHex(md.digest());
}
/**
 * @description SHA-256 해시 (raw byte[] + 접두부 바이트)
 * @param {byte[]} prefixBytes 예: BYTES_PREFIX("BYTES|"의 UTF-8 바이트)
 * @param {byte[]} bytes
 * @returns {string} hex
 */
function _sha256BytesWithPrefix(prefixBytes, bytes) {
    let MessageDigest = Packages.java.security.MessageDigest;
    let md = MessageDigest.getInstance("SHA-256");
    if (prefixBytes && prefixBytes.length) md.update(prefixBytes);
    md.update(bytes);
    return _bytesToHex(md.digest());
}


/**
 * @description Java 바이트 배열에서 메타데이터 키 설정
 * - bytes -> Base64 -> _sha256
 * @param {byte[]} bytes 바이트 배열
 * @returns {string} _sha256
 */
function _computeKeyFromBytes(bytes) {
    return _sha256BytesWithPrefix(BYTES_PREFIX, bytes);
}
/**
 * @description url에서 메타데이터 키 설정
 * @param {string} url url
 * @returns {string} _sha256
 */
function _computeKeyFromUrl(url) {
    return _sha256(`URL|${url}`);
}
/**
 * @description 캐시 파일명으로 절대 경로 생성
 * @param {string} fileName 
 * @returns {string}
 */
function _makeCacheFilePathByName(fileName) {
    return CACHE_DIR + fileName;
}
/**
 * @description 오래된 메타데이터 삭제 (LRU)
 * @param {object} meta 메타데이터
 */
function _evictIfNeeded(meta) {
    let keys = Object.keys(meta.items);
    if (keys.length <= MAX_CACHE_ITEMS) return;
    keys.sort((a, b) => {
        let la = meta.items[a].lastUsed || 0;
        let lb = meta.items[b].lastUsed || 0;
        return la - lb;
    });
    let removeCount = keys.length - MAX_CACHE_ITEMS;
    for (let i = 0; i < removeCount; i++) {
        let k = keys[i];
        let it = meta.items[k];
        let ext = it && it.ext ? it.ext : "dat";
        let fileName = (it && it.file) ? it.file : (`${k}.${ext}`);
        let p = CACHE_DIR + fileName;
        try {
            let f = new CONFIG.File(p);
            if (f.exists()) f.delete();
        } catch (e) {
            Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        }
        delete meta.items[k];
    }
}


/* ==================== 확장자, 판단 ==================== */

/**
 * @description Java primitive byte[] 여부 확인
 * @param {any} x
 * @returns {boolean}
 */
function _isJavaByteArray(x) {
    if (!x) return false;

    // 가장 빠른 체크: toString 패턴
    try {
        let s = "" + x;
        if (s.startsWith("[B@")) return true;
    } catch (_) { }

    // 정확한 체크 (위에서 실패한 경우만)
    try {
        let cls = x.getClass && x.getClass();
        if (cls && cls.isArray()) {
            let comp = cls.getComponentType();
            return comp && comp.getName() === "byte";
        }
    } catch (_) { }

    return false;
}
/**
 * @description 힌트 없는 Base64 문자열 판단
 * @param {string} s
 * @returns {boolean}
 */
function _isLikelyBase64String(s) {
    if (typeof s !== "string") return false;
    let trimmed = s.trim();
    if (trimmed.length < 64) return false; // 최소 길이

    let cleaned = trimmed.replace(/\s+/g, "");
    if (!/^[A-Za-z0-9+\/\-_=]+$/.test(cleaned)) return false;

    // 패딩 보정
    let mod4 = cleaned.length % 4;
    if (mod4 !== 0) cleaned += "===".slice(mod4);

    try {
        CONFIG.Base64.decode(cleaned, CONFIG.Base64.DEFAULT);
        return true;
    } catch (e) {
        try {
            CONFIG.Base64.decode(cleaned, CONFIG.Base64.URL_SAFE);
            return true;
        } catch (e2) {
            return false;
        }
    }
}
/**
 * @description Base64 문자열 디코드
 * @param {string} b64
 * @returns {byte[]}
 * @throws {Error} 디코딩 실패 시
 */
function _decodeBase64Flexible(b64) {
    let cleaned = b64.replace(/\s+/g, "");
    let mod4 = cleaned.length % 4;
    if (mod4 !== 0) cleaned += "===".slice(mod4);

    try {
        return CONFIG.Base64.decode(cleaned, CONFIG.Base64.DEFAULT);
    } catch (e) {
        try {
            return CONFIG.Base64.decode(cleaned, CONFIG.Base64.URL_SAFE);
        } catch (e2) {
            // 수동 치환 후 재시도
            let replaced = cleaned.replace(/-/g, "+").replace(/_/g, "/");
            let m = replaced.length % 4;
            if (m !== 0) replaced += "===".slice(m);
            try {
                return CONFIG.Base64.decode(replaced, CONFIG.Base64.DEFAULT);
            } catch (e3) {
                throw new Error("Base64 디코딩 실패");
            }
        }
    }
}
/**
 * @description 시그니처 매칭 헬퍼
 * @param {byte[]} bytes 바이너리 데이터
 * @param {object} type 시그니처 정의
 * @returns {boolean} 매칭 여부
 */
function _matchSignature(bytes, type) {
    let sig = type.sig;
    let offset = type.offset || 0;

    if (bytes.length < offset + sig.length) return false;

    for (let j = 0; j < sig.length; j++) {
        if ((bytes[offset + j] & 0xFF) !== sig[j]) return false;
    }

    // secondary signature 체크 (AVI, WAV 등 RIFF 기반)
    if (type.secondarySig) {
        let secOff = type.secondaryOffset || 0;
        let secSig = type.secondarySig;
        if (bytes.length < secOff + secSig.length) return false;
        for (let k = 0; k < secSig.length; k++) {
            if ((bytes[secOff + k] & 0xFF) !== secSig[k]) return false;
        }
    }
    return true;
}
/**
 * @description byte[]로 확장자 추측 (첫 바이트 인덱싱 최적화)
 * @param {byte[]} bytes 바이너리 데이터
 * @returns {string|null} 매칭되는 파일 확장자 | null
 */
function _guessFileTypeFromBytes(bytes) {
    if (!bytes || bytes.length === 0) return null;

    let firstByte = bytes[0] & 0xFF;
    let candidates = SIGNATURE_INDEX[firstByte] || [];

    // 1. 첫 바이트 매칭 후보 검사
    for (let type of candidates) {
        if (_matchSignature(bytes, type)) return type.exts[0];
    }

    // 2. offset이 있는 시그니처 검사 (webp, lzh, mp4 등)
    for (let type of SIGNATURE_INDEX._withOffset) {
        if (_matchSignature(bytes, type)) return type.exts[0];
    }

    return null;
}
/**
 * @description URL로부터 앞 256바이트만 읽어 확장자 추측
 * @param {string} urlString 검사할 파일의 URL
 * @returns {string|null} 감지된 확장자 | null
 */
function _getExtensionFromUrl(urlString) {
    let conn = null;
    let is = null;
    try {
        let url = new CONFIG.URL(urlString);
        conn = url.openConnection();
        conn.setConnectTimeout(5000);
        conn.setReadTimeout(5000);
        conn.setRequestMethod("GET");
        conn.setRequestProperty("Range", "bytes=0-" + (SIGNATURE_READ_BYTES - 1));
        conn.connect();
        let responseCode = conn.getResponseCode();
        if (responseCode === CONFIG.HttpURLConnection.HTTP_OK || responseCode === CONFIG.HttpURLConnection.HTTP_PARTIAL) {
            is = conn.getInputStream();
            let buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, SIGNATURE_READ_BYTES);
            let bytesRead = is.read(buffer, 0, buffer.length);
            if (bytesRead > 0) {
                let actualBytes = CONFIG.Arrays.copyOf(buffer, bytesRead);
                return _guessFileTypeFromBytes(actualBytes);
            }
        }
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
    } finally {
        if (is !== null) try { is.close(); } catch (e) { }
        if (conn !== null) try { conn.disconnect(); } catch (e) { }
    }
    return null;
}
/**
 * @description 파일 경로에서 확장자 추출
 * @param {string} filePath 파일 경로 또는 URL
 * @returns {string} 소문자 확장자, 없으면 기본 "jpg"
 */
function _getFileExtension(filePath) {
    try {
        filePath = String(filePath); // java.lang.String -> JS String
        let url = new CONFIG.URL(filePath);

        let path = String(url.getPath());
        let lastDotInPath = path.lastIndexOf(".");
        if (lastDotInPath !== -1 && lastDotInPath + 1 < path.length) {
            let ext = path.slice(lastDotInPath + 1).toLowerCase();
            if (MIME_MAP[ext]) return ext;
        }

        let queryObj = url.getQuery();
        if (queryObj) {
            let query = String(queryObj);
            let params = query.split("&");
            for (let p of params) {
                let dot = p.lastIndexOf(".");
                if (dot !== -1 && dot + 1 < p.length) {
                    let ext = p.slice(dot + 1).toLowerCase();
                    if (MIME_MAP[ext]) return ext;
                }
            }
        }
    } catch (_) { }

    let base = filePath.split("?")[0].split("#")[0];
    let dot = base.lastIndexOf(".");
    if (dot !== -1 && dot + 1 < base.length) {
        let slash = base.lastIndexOf("/");
        if (dot > slash) {
            let ext = base.slice(dot + 1).toLowerCase();
            if (MIME_MAP[ext]) return ext;
        }
    }

    if ((typeof filePath === "string") && (filePath.startsWith("http://") || filePath.startsWith("https://"))) {
        let extFromSignature = _getExtensionFromUrl(filePath);
        if (extFromSignature) return extFromSignature;
    }
    return "jpg";
}
/** @description 파일 확장자에 따른 MIME 타입 반환 */
function _getMimeType(ext) {
    return MIME_MAP[ext.toLowerCase()] || "application/octet-stream";
}


/**
 * @description 파일 경로에서 파일명만 추출
 * @param {string} filePath 파일 경로
 * @returns {string} 파일명
 */
function _getFileName(filePath) {
    filePath = String(filePath);
    let pathWithoutQuery = filePath.split('?')[0].split('#')[0];
    let lastSlash = pathWithoutQuery.lastIndexOf("/");
    if (lastSlash !== -1 && lastSlash < pathWithoutQuery.length - 1) {
        return pathWithoutQuery.slice(lastSlash + 1);
    }
    return pathWithoutQuery;
}
/**
 * @description 파일명 유효성 검사 (윈도우/안드로이드 금지문자)
 * @param {string} fileName 검사할 파일명
 * @returns {boolean} 유효하면 true, 아니면 false
 */
function _isValidFileName(fileName) {
    return /^[^\\/:*?"<>|\0]+$/.test(fileName) && fileName !== '.' && fileName !== '..';
}
/**
 * @description 인덱스가 있는 안전한 파일명 생성
 * @param {string} base 원본 파일명
 * @param {number} index
 * @returns {string} base_index 형식 문자열
 */
function _makeIndexedName(base, index) {
    let safe = (typeof base === "string" && base.length) ? base : "file";
    safe = safe.replace(/[\\/:*?"<>|\0]+/g, "_");
    return `${safe}_${index}`;
}


/**
 * @description 보낼 방 -> channelId 해석
 * @param {string|bigint|any} target 방 이름, channelId
 * @returns {string|bigint|any|null} 변환된 channelId | null
 */
function _resolveChannelId(target) {
    if (typeof target !== "string") return target;
    if (/^\d+$/.test(target)) return target;

    // roomName -> channelId
    try {
        const session = com.xfl.msgbot.application.notification.session.NotificationSession.INSTANCE;
        const room = session.findRoomByName(target);
        return room ? BigInt(room.id) : null;
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        return null;
    }
}


/* ==================== 메인 로직 ==================== */

/**
 * @description 준비 단계에서 수집된 메타 업데이트를 한 번에 병합/저장
 * @param {object[]} updates
 */
function _applyMetaUpdates(updates) {
    if (!updates || updates.length === 0) return;
    try {
        _ensureCacheDir();
        let meta = _loadCacheMeta();

        for (let u of updates) {
            if (!u || !u.key) continue;

            let cur = meta.items[u.key] || {};
            // file/mime/ext는 최신값으로 갱신
            if (u.file) cur.file = u.file;
            if (u.mime) cur.mime = u.mime;
            if (u.ext) cur.ext  = u.ext;

            // lastUsed는 최댓값 유지
            let prev = cur.lastUsed || 0;
            if (typeof u.lastUsed === "number" && u.lastUsed > prev) {
                cur.lastUsed = u.lastUsed;
            } else if (!cur.lastUsed) {
                cur.lastUsed = Date.now();
            }

            // size 갱신
            if (typeof u.size === "number" && u.size > 0) {
                cur.size = u.size;
            }

            meta.items[u.key] = cur;
        }

        _evictIfNeeded(meta);
        _saveCacheMeta(meta);
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
    }
}


/**
 * @description 미디어 스캔
 * @param {string} path 스캔할 파일 경로
 */
function _scanMedia(path) {
    try {
        let file = new CONFIG.File(path);
        if (!file.exists()) return;
        CONFIG.MediaScannerConnection.scanFile(context, [path], null, null);
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
    }
}
/**
 * @description 전송할 파일 준비
 * @param {string|byte[]} filePath 파일 경로 | URL | Base64 문자열 | Java byte[]
 * @param {string} folder 파일 저장 폴더
 * @param {number} timeout 다운로드 타임아웃 (ms)
 * @param {number} [index] 파일명 중복 방지용 인덱스
 * @param {string} [fileName] 저장할 파일명(옵션)
 * @param {boolean} [saveCache=false] 캐시 사용 여부
 * @param {object} [sharedMeta] 공유 메타데이터 (배치 처리용)
 * @returns {object}
 */
function _prepareFile(filePath, folder, timeout, index, fileName, saveCache, sharedMeta) {
    let localPath = filePath;
    let ext = "";
    let mime = "";
    let downloaded = false;

    // byte[] 처리
    let isBytes = _isJavaByteArray(filePath);
    if (isBytes) {
        let bytes = filePath;

        let extFromSig = _guessFileTypeFromBytes(bytes);
        ext = extFromSig ? extFromSig : "jpg";
        mime = _getMimeType(ext);

        let customFileName = null;
        if (fileName) {
            if (!_isValidFileName(fileName)) throw new Error("잘못된 파일명: " + fileName);
            customFileName = fileName.toLowerCase().endsWith("." + ext) ? fileName : (fileName + "." + ext);
        }

        if (saveCache) {
            if (!sharedMeta) _ensureCacheDir();
            let key = _computeKeyFromBytes(bytes);
            let entry = sharedMeta ? _getCacheEntry(sharedMeta, key) : null;
            if (!entry && !sharedMeta) {
                let meta = _loadCacheMeta();
                entry = meta.items[key];
            }

            let cacheFileName = (entry && entry.file) ? entry.file : (key + "." + ext);
            let cachePath = _makeCacheFilePathByName(cacheFileName);
            let outFile = new CONFIG.File(cachePath);

            if (!outFile.exists()) {
                let parentDir = outFile.getParentFile();
                if (!parentDir.exists()) parentDir.mkdirs();
                _writeBytes(outFile, bytes);
                _scanMedia(cachePath);
            }

            let metaUpdate = {
                key: key,
                file: cacheFileName,
                mime: mime,
                ext: cacheFileName.substring(cacheFileName.lastIndexOf(".") + 1),
                lastUsed: Date.now(),
                size: outFile.exists() ? outFile.length() : (bytes ? bytes.length : 0)
            };

            if (sharedMeta) _updateCacheEntry(sharedMeta, metaUpdate);

            if (customFileName) {
                localPath = folder + customFileName;
                let destFile = new CONFIG.File(localPath);
                let parentDir = destFile.getParentFile();
                if (!parentDir.exists()) parentDir.mkdirs();
                _copyFile(outFile, destFile);
                downloaded = true;
                _scanMedia(localPath);
            } else {
                localPath = cachePath; // 캐시 파일 직접 사용
                downloaded = false;
            }

            return sharedMeta ? { localPath, mime, downloaded } : { localPath, mime, downloaded, metaUpdate };
        }

        // 캐시 미사용: tmp에 저장
        let timestamp = Date.now();
        localPath = customFileName
            ? (folder + customFileName)
            : ((typeof index !== "undefined")
                ? (folder + timestamp + "_" + index + "." + ext)
                : (folder + timestamp + "." + ext));

        let outFile = new CONFIG.File(localPath);
        let parentDir = outFile.getParentFile();
        if (!parentDir.exists()) parentDir.mkdirs();
        _writeBytes(outFile, bytes);

        downloaded = true;
        _scanMedia(localPath);
        return { localPath, mime, downloaded };
    }

    // 문자열 정규화 (java.lang.String → JS String)
    if (typeof filePath !== "string") {
        try {
            let isJavaString = filePath && filePath.getClass && filePath.getClass().getName && filePath.getClass().getName() === "java.lang.String";
            if (isJavaString) {
                filePath = String(filePath);
            }
        } catch (_) { }
    }
    localPath = filePath;

    // 기본 플래그 계산
    let isString = (typeof filePath === "string");
    let isDataUrl = isString && filePath.startsWith("data:");
    // base64: / base64
    let isBase64Prefixed = isString && /^base64[:\,]/i.test(filePath);
    let isHttpLike = isString && (filePath.startsWith("http://") || filePath.startsWith("https://"));
    let isLocal = isString && !isHttpLike && (
        /^\/?(sdcard\/|storage\/emulated\/0\/)/.test(filePath) ||
        filePath.startsWith("/sdcard/") ||
        filePath.startsWith("/storage/emulated/0/") ||
        new CONFIG.File(filePath).exists()
    );
    let isRawBase64 = isString && !isLocal && !isHttpLike && _isLikelyBase64String(filePath);

    // Data URL / Base64 처리
    if (isDataUrl || isBase64Prefixed || isRawBase64) {
        let bytes = null;
        let fromMime = "";

        if (isDataUrl) {
            let commaIdx = filePath.indexOf(",");
            if (commaIdx <= 5) throw new Error("잘못된 data URL 형식");
            let header = filePath.slice(5, commaIdx);
            let headerParts = header.split(";");
            fromMime = headerParts[0] || "";
            let payload = filePath.substring(commaIdx + 1);
            bytes = _decodeBase64Flexible(payload);
        } else if (isBase64Prefixed) {
            let b64 = filePath.slice(7); // "base64:" 또는 "base64," 이후
            bytes = _decodeBase64Flexible(b64);
        } else {
            bytes = _decodeBase64Flexible(filePath);
        }

        let extFromSig = _guessFileTypeFromBytes(bytes);
        if (extFromSig) {
            ext = extFromSig;
        } else if (fromMime) {
            ext = MIME_TO_EXT[fromMime] || "jpg";
        } else {
            ext = "jpg";
        }
        mime = _getMimeType(ext);

        let customFileName = null;
        if (fileName) {
            if (!_isValidFileName(fileName)) throw new Error("잘못된 파일명: " + fileName);
            customFileName = fileName.toLowerCase().endsWith("." + ext) ? fileName : (fileName + "." + ext);
        }

        if (saveCache) {
            if (!sharedMeta) _ensureCacheDir();

            let key = _computeKeyFromBytes(bytes);
            let entry = sharedMeta ? _getCacheEntry(sharedMeta, key) : null;
            if (!entry && !sharedMeta) {
                let meta = _loadCacheMeta();
                entry = meta.items[key];
            }

            let cacheFileName = (entry && entry.file) ? entry.file : (key + "." + ext);
            let cachePath = _makeCacheFilePathByName(cacheFileName);
            let outFile = new CONFIG.File(cachePath);

            if (!outFile.exists()) {
                let parentDir = outFile.getParentFile();
                if (!parentDir.exists()) parentDir.mkdirs();
                _writeBytes(outFile, bytes);
                _scanMedia(cachePath);
            }

            let metaUpdate = {
                key: key,
                file: cacheFileName,
                mime: mime,
                ext: cacheFileName.substring(cacheFileName.lastIndexOf(".") + 1),
                lastUsed: Date.now(),
                size: outFile.exists() ? outFile.length() : (bytes ? bytes.length : 0)
            };

            if (sharedMeta) _updateCacheEntry(sharedMeta, metaUpdate);

            if (customFileName) {
                localPath = folder + customFileName;
                let destFile = new CONFIG.File(localPath);
                let parentDir = destFile.getParentFile();
                if (!parentDir.exists()) parentDir.mkdirs();
                _copyFile(outFile, destFile);
                downloaded = true; // tmp 복제본 삭제 대상
                _scanMedia(localPath);
            } else {
                localPath = cachePath; // 캐시 파일 직접 사용
                downloaded = false;
            }

            return sharedMeta ? { localPath, mime, downloaded } : { localPath, mime, downloaded, metaUpdate };
        }

        // 캐시 미사용: tmp에 저장
        let timestamp = Date.now();
        localPath = customFileName
            ? (folder + customFileName)
            : ((typeof index !== "undefined")
                ? (folder + timestamp + "_" + index + "." + ext)
                : (folder + timestamp + "." + ext));

        let outFile = new CONFIG.File(localPath);
        let parentDir = outFile.getParentFile();
        if (!parentDir.exists()) parentDir.mkdirs();

        _writeBytes(outFile, bytes);

        downloaded = true;
        _scanMedia(localPath);
        return { localPath, mime, downloaded };
    }

    // URL 처리 (http/https)
    if (isHttpLike) {
        ext = ext || _getFileExtension(filePath);
        mime = _getMimeType(ext);

        if (saveCache) {
            if (!sharedMeta) _ensureCacheDir();
            let key = _computeKeyFromUrl(filePath);
            let entry = sharedMeta ? _getCacheEntry(sharedMeta, key) : null;
            if (!entry && !sharedMeta) {
                let meta = _loadCacheMeta();
                entry = meta.items[key];
            }
            if (entry) {
                ext = entry.ext || ext;
                mime = entry.mime || mime;
            }

            let cacheFileName = (entry && entry.file) ? entry.file : (key + "." + ext);
            let cachePath = _makeCacheFilePathByName(cacheFileName);
            let cacheFile = new CONFIG.File(cachePath);

            if (!cacheFile.exists()) {
                let parentDir = cacheFile.getParentFile();
                if (!parentDir.exists()) parentDir.mkdirs();
                _downloadToFile(filePath, cacheFile, timeout || 30000);
                _scanMedia(cachePath);
            }

            let metaUpdate = {
                key: key,
                file: cacheFileName,
                mime: mime,
                ext: cacheFileName.substring(cacheFileName.lastIndexOf(".") + 1),
                lastUsed: Date.now(),
                size: cacheFile.exists() ? cacheFile.length() : 0
            };

            if (sharedMeta) _updateCacheEntry(sharedMeta, metaUpdate);

            let customFileName = null;
            if (fileName) {
                if (!_isValidFileName(fileName)) throw new Error("잘못된 파일명: " + fileName);
                customFileName = fileName.toLowerCase().endsWith("." + ext) ? fileName : (fileName + "." + ext);
            }

            if (customFileName) {
                localPath = folder + customFileName;
                let destFile = new CONFIG.File(localPath);
                let parentDir = destFile.getParentFile();
                if (!parentDir.exists()) parentDir.mkdirs();
                _copyFile(cacheFile, destFile);
                downloaded = true;
                _scanMedia(localPath);
            } else {
                localPath = cachePath;
                downloaded = false;
            }
            return sharedMeta ? { localPath, mime, downloaded } : { localPath, mime, downloaded, metaUpdate };
        }

        // 캐시 미사용
        let timestamp = Date.now();

        let customFileName = null;
        if (fileName) {
            if (!_isValidFileName(fileName)) throw new Error("잘못된 파일명: " + fileName);
            customFileName = fileName.toLowerCase().endsWith("." + ext) ? fileName : (fileName + "." + ext);
        }
        localPath = customFileName ?
            (folder + customFileName) :
            ((typeof index !== "undefined") ?
                (folder + timestamp + "_" + index + "." + ext) :
                (folder + timestamp + "." + ext));

        let file = new CONFIG.File(localPath);
        let parentDir = file.getParentFile();
        if (!parentDir.exists()) parentDir.mkdirs();

        _downloadToFile(filePath, file, timeout || 30000);
        downloaded = true;
        _scanMedia(localPath);
        return { localPath, mime, downloaded };
    }

    // 로컬 파일 처리
    ext = ext || _getFileExtension(filePath);
    mime = _getMimeType(ext);

    // msgbot_media 내부인지 확인
    let underMediaDir = false;
    if (typeof localPath === "string") {
        underMediaDir = localPath.startsWith(MEDIA_DIR) || localPath.startsWith("/" + MEDIA_DIR);
    }

    // 확장자 보정
    let fileNameToUse = fileName ? (
        (_isValidFileName(fileName) ?
            (fileName.toLowerCase().endsWith("." + ext) ? fileName : (fileName + "." + ext)) :
            (() => { throw new Error("잘못된 파일명: " + fileName); })())
    ) : _getFileName(filePath);

    if (underMediaDir && !fileName) {
        _scanMedia(localPath);
        return { localPath, mime, downloaded: false };
    }

    // 폴더 밖이거나 fileName 지정으로 복사 필요
    let targetPath = folder + fileNameToUse;

    let srcFile = new CONFIG.File(localPath);
    let destFile = new CONFIG.File(targetPath);
    let parentDir = destFile.getParentFile();
    if (!parentDir.exists()) parentDir.mkdirs();

    _copyFile(srcFile, destFile);

    localPath = targetPath;
    downloaded = true; // 1분 뒤 삭제 대상
    _scanMedia(localPath);
    return { localPath, mime, downloaded };
}


/**
 * @description Intent 생성
 * @param {string} action Intent Action (ACTION_SEND, ACTION_SEND_MULTIPLE)
 * @param {string|bigint} channelId 타겟 채널 ID
 * @param {string} mimeType MIME 타입
 * @param {Packages.java.util.ArrayList|Packages.android.net.Uri} streamData URI 리스트 | URI
 * @returns {Packages.android.content.Intent} 생성된 인텐트 객체
 */
function _createSendIntent(action, channelId, mimeType, streamData) {
    let intent = new CONFIG.Intent(action);
    intent.setPackage("com.kakao.talk");
    // GPT 왈: 뭔가 방이 잘 안 열린다면 주석을 해제해볼 것
    // intent.setClassName("com.kakao.talk", "com.kakao.talk.activity.ShareReceiverActivity");
    intent.setType(mimeType);

    const extraKey = CONFIG.Intent.EXTRA_STREAM;
    if (action === CONFIG.Intent.ACTION_SEND_MULTIPLE) {
        intent.putParcelableArrayListExtra(extraKey, streamData);
    } else {
        intent.putExtra(extraKey, streamData);
    }

    let b = new CONFIG.Bundle();
    b.putLong("key_id", CONFIG.Long.parseLong(channelId.toString()));
    b.putInt("key_type", 1);
    b.putBoolean("key_from_direct_share", true);
    intent.putExtras(b);

    intent.addFlags(
        CONFIG.Intent.FLAG_ACTIVITY_NEW_TASK |
        CONFIG.Intent.FLAG_ACTIVITY_CLEAR_TOP |
        CONFIG.Intent.FLAG_GRANT_READ_URI_PERMISSION
    );

    return intent;
}




/* =================================== MediaSender 객체 =================================== */


const MediaSender = {};


/**
 * @description 파일 전송
 * @param {string|bigint} channelId 전송할 채널 ID
 * @param {string|string[]} path 전송할 파일 경로 | 파일 경로 배열
 * @param {number} [timeout] 다운로드 타임아웃 (ms)
 * @param {string} [fileName] 저장할 파일명(옵션)
 * @param {boolean} [saveCache=false] 캐시 사용 여부 (URL/Base64/byte[])
 * @returns {boolean} 전송 성공 여부
 */
MediaSender.send = (channelId, path, timeout, fileName, saveCache) => {
    try {
        // channelId 대신 방 이름이 들어온 경우를 위해
        let resolved = _resolveChannelId(channelId);
        if (resolved === null || typeof resolved === "undefined") {
            throw new Error("channelId/roomName 해석 실패: " + channelId);
        }
        channelId = resolved;

        let folder = MEDIA_DIR;
        timeout = timeout || 30000;
        let downloadedFiles = [];

        // 복수 파일
        if (Array.isArray(path) && !_isJavaByteArray(path)) {
            let uniquePaths = [];
            let mapIndex = [];
            let cacheMap = Object.create(null);

            for (let i = 0; i < path.length; i++) {
                let p = path[i];
                if (typeof p === "string") {
                    if (cacheMap[p] === undefined) {
                        cacheMap[p] = uniquePaths.length;
                        uniquePaths.push(p);
                    }
                    mapIndex[i] = cacheMap[p];
                } else {
                    // Java byte[] 등 비문자 유니크 취급
                    mapIndex[i] = uniquePaths.length;
                    uniquePaths.push(p);
                }
            }
            
            // 파일 준비 (중복 제거된 목록)
            let uniqueResults = [];
            // multiTask 있으면 병렬, 없으면 동기
            if (multiTask) {
                let tasks = [];
                for (let j = 0; j < uniquePaths.length; j++) {
                    let fileNameForThis = (typeof fileName === "string" && fileName.length) ? _makeIndexedName(fileName, j + 1) : undefined;
                    tasks.push([_prepareFile, uniquePaths[j], folder, timeout, j, fileNameForThis, saveCache]);
                }
                uniqueResults = multiTask.run(tasks, timeout);
            } else if (saveCache) {
                // 동기 + 캐시: 공유 메타로 I/O 최소화
                _withSharedMeta((meta) => {
                    for (let j = 0; j < uniquePaths.length; j++) {
                        let fileNameForThis = (typeof fileName === "string" && fileName.length) ? _makeIndexedName(fileName, j + 1) : undefined;
                        uniqueResults.push(_prepareFile(uniquePaths[j], folder, timeout, j, fileNameForThis, saveCache, meta));
                    }
                });
            } else {
                for (let j = 0; j < uniquePaths.length; j++) {
                    let fileNameForThis = (typeof fileName === "string" && fileName.length) ? _makeIndexedName(fileName, j + 1) : undefined;
                    uniqueResults.push(_prepareFile(uniquePaths[j], folder, timeout, j, fileNameForThis, saveCache));
                }
            }

            let results = [];
            for (let i = 0; i < path.length; i++) {
                results.push(uniqueResults[mapIndex[i]]);
            }

            let uriList = new CONFIG.ArrayList();
            for (let result of results) {
                if (result) {
                    let file = new CONFIG.File(result.localPath);
                    let uri = CONFIG.FileProvider.getUriForFile(context, FILE_PROVIDER_AUTHORITY, file);
                    uriList.add(uri);
                    if (result.downloaded) downloadedFiles.push(result.localPath);
                }
            }
            if (uriList.isEmpty()) return false;
            let intent = _createSendIntent(CONFIG.Intent.ACTION_SEND_MULTIPLE, channelId, "*/*", uriList);
            context.startActivity(intent);

            // multiTask 사용 시에만 metaUpdate 병합 필요 (sharedMeta 미사용)
            if (multiTask) {
                try {
                    let updates = [];
                    for (let result of uniqueResults) {
                        if (result && result.metaUpdate) updates.push(result.metaUpdate);
                    }
                    if (updates.length > 0) _applyMetaUpdates(updates);
                } catch (e) {
                    Log.e(`${e.name}\n${e.message}\n${e.stack}`);
                }
            }
        }
        
        // 단일 파일
        else {
            let result = _prepareFile(path, folder, timeout, undefined, fileName, saveCache);
            if (result.downloaded) downloadedFiles.push(result.localPath);
            let file = new CONFIG.File(result.localPath);
            let uri = CONFIG.FileProvider.getUriForFile(context, FILE_PROVIDER_AUTHORITY, file);

            // 텍스트 기반 파일은 */* 및 ACTION_SEND_MULTIPLE로 전송해야 보내짐
            if (result.mime.startsWith("text/")) {
                let uriList = new CONFIG.ArrayList();
                uriList.add(uri);
                let intent = _createSendIntent(CONFIG.Intent.ACTION_SEND_MULTIPLE, channelId, "*/*", uriList);
                context.startActivity(intent);
            } else {
                let intent = _createSendIntent(CONFIG.Intent.ACTION_SEND, channelId, result.mime, uri);
                context.startActivity(intent);
            }

            try {
                if (result.metaUpdate) _applyMetaUpdates([result.metaUpdate]);
            } catch (e) {
                Log.e(`${e.name}\n${e.message}\n${e.stack}`);
            }
        }

        // 다운로드한 임시 파일 자동 삭제
        setTimeout(() => {
            for (let filePath of downloadedFiles) {
                try {
                    let tmpFile = new CONFIG.File(filePath);
                    if (tmpFile.exists()) tmpFile.delete();
                } catch (e) {
                    Log.e(`${e.name}\n${e.message}\n${e.stack}`);
                }
            }
        }, 60000);
        return true;

    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        return false;
    }
};
/**
 * @description 카카오톡 전송 후 지정 앱 또는 홈 화면으로 복귀
 * @param {string} [packageName] 이동할 앱의 패키지명, 미지정 시 홈 화면
 * @param {number} [delay=5000] 복귀까지의 지연(ms)
 * @returns {boolean} 스케줄링 성공 여부
 */
MediaSender.return = (packageName, delay) => {
    try {
        let ms = (typeof delay === "number" && delay >= 0) ? delay : 5000;

        setTimeout(() => {
            try {
                let moved = false;

                if (typeof packageName === "string" && packageName.length) {
                    let pm = context.getPackageManager();
                    let launch = pm ? pm.getLaunchIntentForPackage(packageName) : null;
                    if (launch) {
                        launch.addFlags(CONFIG.Intent.FLAG_ACTIVITY_NEW_TASK | CONFIG.Intent.FLAG_ACTIVITY_CLEAR_TOP);
                        context.startActivity(launch);
                        moved = true;
                    }
                }

                if (!moved) {
                    let home = new CONFIG.Intent(CONFIG.Intent.ACTION_MAIN);
                    home.addCategory(CONFIG.Intent.CATEGORY_HOME);
                    home.setFlags(CONFIG.Intent.FLAG_ACTIVITY_NEW_TASK | CONFIG.Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    context.startActivity(home);
                }
            } catch (e) {
                Log.e(`${e.name}\n${e.message}\n${e.stack}`);
                try {
                    let home = new CONFIG.Intent(CONFIG.Intent.ACTION_MAIN);
                    home.addCategory(CONFIG.Intent.CATEGORY_HOME);
                    home.setFlags(CONFIG.Intent.FLAG_ACTIVITY_NEW_TASK | CONFIG.Intent.FLAG_ACTIVITY_CLEAR_TOP);
                    context.startActivity(home);
                } catch (e2) {
                    Log.e(`${e2.name}\n${e2.message}\n${e2.stack}`);
                }
            }
        }, ms);

        return true;
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        return false;
    }
};
/**
 * @description 캐시 삭제
 * @param {string|string[]} [target] 없음: 전체 삭제, 문자열: 해당 파일/키 삭제, 문자열 배열: 여러 개 삭제
 * @returns {boolean} 성공 여부
 */
MediaSender.clearCache = (target) => {
    try {
        _ensureCacheDir();
        let meta = _loadCacheMeta();

        /** @description Key 기준 제거 */
        function _removeByKey(key) {
            if (!key) return;
            let it = meta.items[key];
            if (it) {
                let p = CACHE_DIR + (it.file || (`${key}.${(it.ext || "dat")}`));
                try {
                    let f = new CONFIG.File(p);
                    if (f.exists()) f.delete();
                } catch (e) {
                    Log.e(`${e.name}\n${e.message}\n${e.stack}`);
                }
                delete meta.items[key];
            } else {
                // 메타에 없더라도 파일명이 직접 들어온 경우 시도 삭제
                let guess = new CONFIG.File(CACHE_DIR + key);
                if (guess.exists()) guess.delete();
            }
        }

        if (typeof target === "undefined") {
            // 전체 삭제
            let dir = new CONFIG.File(CACHE_DIR);
            if (dir.exists()) {
                let files = dir.listFiles();
                if (files) {
                    for (let i = 0; i < files.length; i++) {
                        let name = files[i].getName();
                        if (name !== "metadata.json") {
                            try { files[i].delete(); } catch (e) { Log.e(`${e.name}\n${e.message}\n${e.stack}`); }
                        }
                    }
                }
            }
            meta.items = {};
            _saveCacheMeta(meta);
            return true;
        } else if (typeof target === "string") {
            let name = target;
            let lastSlash = name.lastIndexOf("/");
            if (lastSlash !== -1) name = name.substring(lastSlash + 1);
            let key = (name.indexOf(".") !== -1) ? name.substring(0, name.indexOf(".")) : name;
            _removeByKey(key);
            _saveCacheMeta(meta);
            return true;
        } else if (Array.isArray(target)) {
            for (let name of target) {
                let lastSlash = name.lastIndexOf("/");
                if (lastSlash !== -1) name = name.substring(lastSlash + 1);
                let key = (name.indexOf(".") !== -1) ? name.substring(0, name.indexOf(".")) : name;
                _removeByKey(key);
            }
            _saveCacheMeta(meta);
            return true;
        }
        return false;
    } catch (e) {
        Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        return false;
    }
};


module.exports = MediaSender;