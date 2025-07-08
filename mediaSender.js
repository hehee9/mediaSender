/**
 * @module MediaSender
 * @description 파일 전송 모듈
 * 
 * @author Hehee
 * @license CC BY-NC-SA 4.0
 * @since 2025.02.19
 * @version 1.2.4
 */

/**
 * @changeLog
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

(function() {
    const CONFIG = {
        Intent: Packages.android.content.Intent,
        Uri: Packages.android.net.Uri,
        URL: Packages.java.net.URL,
        HttpURLConnection: Packages.java.net.HttpURLConnection,
        Arrays: Packages.java.util.Arrays,
        File: Packages.java.io.File,
        Long: Packages.java.lang.Long,
        Integer: Packages.java.lang.Integer,
        MediaScannerConnection: Packages.android.media.MediaScannerConnection,
        FileProvider: Packages.androidx.core.content.FileProvider,
        ArrayList: Packages.java.util.ArrayList
    };

    const FILE_PROVIDER_AUTHORITY = "com.xfl.msgbot.provider";

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
        { exts: ['7z'], sig: [0x37, 0x7A, 0xBC, 0xAF, 0x27, 192] },
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

    let context;
    try {
        context = Api.getContext();
    } catch (e) {
        context = App.getContext();
    }

    /** @see https://cafe.naver.com/nameyee/50218 */
    const multiTask = require("multiTask");
    const MediaSender = {};

    /**
     * @description 미디어 스캔
     * @param {string} path 스캔할 파일 경로
     */
    function scanMedia(path) {
        try {
            let file = new CONFIG.File(path);
            if (!file.exists()) return;
            CONFIG.MediaScannerConnection.scanFile(context, [path], null, null);
        } catch (e) {
            Log.e(`${e.name}\n${e.message}\n${e.stack}`);
        }
    }

    /**
     * @description byte[]로 확장자 추측
     * @param {byte[]} bytes 바이너리 데이터
     * @returns {string|null} 매칭되는 파일 확장자 | null
     */
    function guessFileTypeFromBytes(bytes) {
        if (!bytes || bytes.length === 0) return null;
        
        for (let i = 0; i < SIGNATURES.length; i++) {
            let type = SIGNATURES[i];
            let { sig, offset = 0, secondarySig, secondaryOffset = 0 } = type;
            if (bytes.length < offset + sig.length) continue;
            let primaryMatch = true;
            for (let j = 0; j < sig.length; j++) {
                if ((bytes[offset + j] & 0xFF) !== sig[j]) {
                    primaryMatch = false;
                    break;
                }
            }
            if (primaryMatch) {
                if (secondarySig) {
                    if (bytes.length < secondaryOffset + secondarySig.length) continue;
                    let secondaryMatch = true;
                    for (let k = 0; k < secondarySig.length; k++) {
                        if ((bytes[secondaryOffset + k] & 0xFF) !== secondarySig[k]) {
                            secondaryMatch = false;
                            break;
                        }
                    }
                    if (secondaryMatch) return type.exts[0];
                } else {
                    return type.exts[0];
                }
            }
        }
        return null;
    }

    /**
     * @description URL로부터 앞 256바이트만 읽어 확장자 추측
     * @param {string} urlString 검사할 파일의 URL
     * @returns {string|null} 감지된 확장자 | null
     */
    function getExtensionFromUrl(urlString) {
        let conn = null;
        let is = null;
        try {
            let url = new CONFIG.URL(urlString);
            conn = url.openConnection();
            conn.setConnectTimeout(5000);
            conn.setReadTimeout(5000);
            conn.setRequestMethod("GET");
            conn.setRequestProperty("Range", "bytes=0-255");
            conn.connect();
            let responseCode = conn.getResponseCode();
            if (responseCode === CONFIG.HttpURLConnection.HTTP_OK || responseCode === CONFIG.HttpURLConnection.HTTP_PARTIAL) {
                is = conn.getInputStream();
                let buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 256);
                let bytesRead = is.read(buffer, 0, buffer.length);
                if (bytesRead > 0) {
                    let actualBytes = CONFIG.Arrays.copyOf(buffer, bytesRead);
                    return guessFileTypeFromBytes(actualBytes);
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
    function getFileExtension(filePath) {
        try {
            filePath = String(filePath); // java.lang.String -> JS String으로 변환
            const url = new CONFIG.URL(filePath);
            let path = url.getPath();
            let lastDotInPath = path.lastIndexOf(".");
            if (lastDotInPath !== -1 && path.length > lastDotInPath + 1) {
                let ext = path.substring(lastDotInPath + 1).toLowerCase();
                if (MIME_MAP[ext]) return ext;
            }
            let query = url.getQuery();
            if (query) {
                const params = query.split('&');
                for (let i = 0; i < params.length; i++) {
                    const param = params[i];
                    let lastDotInQuery = param.lastIndexOf(".");
                    if (lastDotInQuery !== -1 && param.length > lastDotInQuery + 1) {
                        let ext = param.substring(lastDotInQuery + 1).toLowerCase();
                        if (MIME_MAP[ext]) return ext;
                    }
                }
            }
        } catch (e) { }

        let pathWithoutQuery = filePath.split('?')[0].split('#')[0];
        let lastDot = pathWithoutQuery.lastIndexOf(".");
        if (lastDot !== -1 && lastDot < pathWithoutQuery.length - 1) {
            let lastSlash = pathWithoutQuery.lastIndexOf("/");
            if (lastDot > lastSlash) {
                let ext = pathWithoutQuery.substring(lastDot + 1).toLowerCase();
                if (MIME_MAP[ext]) return ext;
            }
        }

        if (filePath.toLowerCase().startsWith("http")) {
            let extFromSignature = getExtensionFromUrl(filePath);
            if (extFromSignature) return extFromSignature;
        }

        return "jpg";
    }

    /** @description 파일 확장자에 따른 MIME 타입 반환 */
    function getMimeType(ext) {
        return MIME_MAP[ext.toLowerCase()] || "application/octet-stream";
    }

    /**
     * @description 전송할 파일 준비
     * @param {string} filePath 파일 경로 | URL
     * @param {string} folder 파일 저장 폴더
     * @param {number} timeout 다운로드 타임아웃 (ms)
     * @param {number} [index] 파일명 중복 방지용 인덱스
     * @returns {Object} { localPath: string, mime: string, downloaded: boolean }
     * @throws {Error} 로컬 파일 존재하지 않을 때
     */
    function prepareFile(filePath, folder, timeout, index) {
        let localPath = filePath;
        let ext = "";
        let mime = "";
        let downloaded = false;
        let isLocal = /^\/?(sdcard\/|storage\/emulated\/0\/)/.test(filePath);

        if (!isLocal) {
            ext = getFileExtension(filePath);
            mime = getMimeType(ext);
            let timestamp = Date.now();
            localPath = (typeof index !== "undefined") ?
                `${folder}${timestamp}_${index}.${ext}` :
                `${folder}${timestamp}.${ext}`;

            let file = new CONFIG.File(localPath);
            let parentDir = file.getParentFile();
            if (!parentDir.exists()) parentDir.mkdirs();

            let inputStream = null;
            let outputStream = null;
            try {
                let connection = new CONFIG.URL(filePath).openConnection();
                connection.setConnectTimeout(timeout || 30000);
                connection.setReadTimeout(timeout || 30000);
                inputStream = connection.getInputStream();
                outputStream = new java.io.FileOutputStream(file);
                let buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 4096);
                let bytesRead;
                while ((bytesRead = inputStream.read(buffer)) !== -1)
                    outputStream.write(buffer, 0, bytesRead);
                downloaded = true;
            } finally {
                if (outputStream) {
                    outputStream.flush();
                    outputStream.close();
                }
                if (inputStream) {
                    inputStream.close();
                }
            }
            if (downloaded) scanMedia(localPath);
        } else {
            ext = getFileExtension(filePath);
            mime = getMimeType(ext);
            if (!new CONFIG.File(localPath).exists())
                throw new Error("파일이 없음: " + localPath);
            scanMedia(localPath);
        }
        return { localPath, mime, downloaded };
    }

    /**
     * @description Intent 생성
     * @param {string} action Intent Action (ACTION_SENDTO, ACTION_SEND_MULTIPLE)
     * @param {string|bigint} channelId 타겟 채널 ID
     * @param {string} mimeType MIME 타입
     * @param {Packages.java.util.ArrayList|Packages.android.net.Uri} streamData URI 리스트 | URI
     * @returns {Packages.android.content.Intent} 생성된 인텐트 객체
     */
    function createSendIntent(action, channelId, mimeType, streamData) {
        let intent = new CONFIG.Intent(action);
        intent.setPackage("com.kakao.talk");
        intent.setType(mimeType);

        const extraKey = CONFIG.Intent.EXTRA_STREAM;
        if (action === CONFIG.Intent.ACTION_SEND_MULTIPLE) {
            intent.putParcelableArrayListExtra(extraKey, streamData);
        } else {
            intent.putExtra(extraKey, streamData);
        }

        let channelIdLong = new CONFIG.Long(channelId.toString());
        intent.putExtra("key_id", channelIdLong);
        intent.putExtra("key_type", new CONFIG.Integer(1));
        intent.putExtra("key_from_direct_share", true);
        intent.addFlags(CONFIG.Intent.FLAG_ACTIVITY_NEW_TASK | CONFIG.Intent.FLAG_ACTIVITY_CLEAR_TOP | CONFIG.Intent.FLAG_GRANT_READ_URI_PERMISSION);
        return intent;
    }

    /**
     * @description 파일 전송
     * @param {string|bigint} channelId 전송할 채널 ID
     * @param {string|string[]} path 전송할 파일 경로 | 파일 경로 배열
     * @param {number} [timeout] 다운로드 타임아웃 (ms)
     * @returns {boolean} 전송 성공 여부
     */
    MediaSender.send = (channelId, path, timeout) => {
        try {
            let folder = "sdcard/botData/tmp/";
            timeout = timeout || 30000;
            let downloadedFiles = [];

            if (Array.isArray(path)) {
                let tasks = [];
                for (let i = 0; i < path.length; i++) {
                    tasks.push([prepareFile, path[i], folder, timeout, i]);
                }
                let results = multiTask.run(tasks, timeout);
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
                let intent = createSendIntent(CONFIG.Intent.ACTION_SEND_MULTIPLE, channelId, "*/*", uriList);
                context.startActivity(intent);
            } else {
                let result = prepareFile(path, folder, timeout);
                if (result.downloaded) downloadedFiles.push(result.localPath);
                let file = new CONFIG.File(result.localPath);
                let uri = CONFIG.FileProvider.getUriForFile(context, FILE_PROVIDER_AUTHORITY, file);

                // 텍스트 기반 파일은 */* 및 ACTION_SEND_MULTIPLE로 전송해야 보내짐
                if (result.mime.startsWith("text/")) {
                    let uriList = new CONFIG.ArrayList();
                    uriList.add(uri);
                    let intent = createSendIntent(CONFIG.Intent.ACTION_SEND_MULTIPLE, channelId, "*/*", uriList);
                    context.startActivity(intent);
                } else {
                    let intent = createSendIntent(CONFIG.Intent.ACTION_SEND, channelId, result.mime, uri);
                    context.startActivity(intent);
                }
            }

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

    module.exports = MediaSender;
})();