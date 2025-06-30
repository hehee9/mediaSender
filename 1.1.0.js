/**
 * @module MediaSender
 * @description 파일 전송 모듈
 * 
 * @author Hehee
 * @license CC BY-NC-SA 4.0
 * @since 2025.02.19
 * @version 1.1.0
 */

/**
 * @changeLog
 * v1.1.0 (2025.03.26)
 * - 앱 리프레시에 의한 이미지 전송 실패 문제 해결 @see https://cafe.naver.com/nameyee/50574
 * - Mediascan을 추가하여 안전성 강화
 * 
 * v1.0.0 (2025.02.19)
 * - 초기 버전
 */



/**
 * @module MediaSender
 * @description 파일 전송 모듈
 */
(function() {
    let MEDIA_CONFIG = {
        Intent: Packages.android.content.Intent,
        Uri: Packages.android.net.Uri,
        File: Packages.java.io.File,
        Long: Packages.java.lang.Long,
        Integer: Packages.java.lang.Integer,
        MediaScannerConnection: Packages.android.media.MediaScannerConnection
    };

    // 레거시, API2 모두 지원
    let context;
    try {
        context = Api.getContext();
    } catch (e) {
        context = App.getContext();
    }

    /**
     * @description 이미지 여러 장 전송 시 비동기 처리
     * @requires multiTask
     * @see https://cafe.naver.com/nameyee/50218
     */
    const multiTask = require("multiTask");

    let MediaSender = {};


    /**
     * @description 미디어 스캔
     * @param {string} path 스캔할 파일 경로
     */
    function scanMedia(path) {
        try {
            let file = new MEDIA_CONFIG.File(path);
            if (!file.exists()) return;
            MEDIA_CONFIG.MediaScannerConnection.scanFile(context, [path], null, null);
        } catch (e) {
            Log.e("scanMedia\n" + e);
        }
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
        let isLocal = /^\/?(sdcard\/|storage\/emulated\/0\/)/.test(filePath);   // sdcard 또는 storage/emulated/0/ 경로인지 확인
    
        if (!isLocal) {
            // 원격 파일 처리
            ext = "jpg";
            try {
                let urlObj = new java.net.URL(filePath);
                let urlPath = urlObj.getPath();
                ext = getFileExtension(urlPath);
            } catch (e) {
                ext = "jpg";
            }
            mime = getMimeType(ext);
            let timestamp = Date.now();
            localPath = (typeof index !== "undefined")
                ? `${folder}${timestamp}_${index}.${ext}`
                : `${folder}${timestamp}.${ext}`;
    
            let file = new MEDIA_CONFIG.File(localPath);
            let parentDir = file.getParentFile();
            if (!parentDir.exists()) parentDir.mkdirs();
    
            // 파일 다운로드 및 저장
            let connection = new java.net.URL(filePath).openConnection();
            connection.setConnectTimeout(timeout || 30000);
            connection.setReadTimeout(timeout || 30000);
            let inputStream = connection.getInputStream();
            let outputStream = new java.io.FileOutputStream(file);
            let buffer = java.lang.reflect.Array.newInstance(java.lang.Byte.TYPE, 4096);
            let bytesRead;
            while ((bytesRead = inputStream.read(buffer)) !== -1)
                outputStream.write(buffer, 0, bytesRead);

            outputStream.flush();
            outputStream.close();
            inputStream.close();
            downloaded = true;
            scanMedia(localPath);
        } else {
            // 로컬 파일 처리
            ext = getFileExtension(filePath);
            mime = getMimeType(ext);
            if (!new MEDIA_CONFIG.File(localPath).exists())
                throw new Error("파일이 없음: " + localPath);
            scanMedia(localPath);
        }
        return { localPath, mime, downloaded };
    }
    
    /**
     * @description 파일 전송 함수
     * @param {bigint|string} channelId 전송할 채널 ID
     * @param {string|string[]} path 파일 경로 (로컬 | URL)
     * @param {number} [timeout=30000] 파일 다운로드 타임아웃
     * @returns {boolean} 전송 성공 여부 - 다만 true를 반환해도 전송 실패 가능성 있음
     */
    MediaSender.send = (channelId, path, timeout) => {
        // 화면이 켜져있을 때 전송을 안 하려면 주석 해제
        // if (Device.isScreenOn()) return false;
    
        try {
            if (Array.isArray(path)) {
                let folder = "sdcard/botData/images/";
                let tasks = [];
                for (let i = 0; i < path.length; i++) {
                    tasks.push([prepareFile, path[i], folder, timeout || 30000, i]);
                }

                let results = multiTask.run(tasks, timeout || 30000);
                let uris = [];
                let downloaded = [];
                for (let result of results)
                    if (result) {
                        let uri = MEDIA_CONFIG.Uri.fromFile(new MEDIA_CONFIG.File(result.localPath));
                        uris.push(uri);
                        if (result.downloaded) downloaded.push(result.localPath);
                    }
    
                if (uris.length === 0) return false;
    
                let intent = new MEDIA_CONFIG.Intent(MEDIA_CONFIG.Intent.ACTION_SEND_MULTIPLE);
                intent.setPackage("com.kakao.talk");
                intent.setType("image/*");
                intent.putExtra(MEDIA_CONFIG.Intent.EXTRA_STREAM, uris);
    
                let channelIdLong = new MEDIA_CONFIG.Long(channelId.toString());
                intent.putExtra("key_id", channelIdLong);
                intent.putExtra("key_type", new MEDIA_CONFIG.Integer(1));
                intent.putExtra("key_from_direct_share", true);
    
                intent.addFlags(MEDIA_CONFIG.Intent.FLAG_ACTIVITY_NEW_TASK | MEDIA_CONFIG.Intent.FLAG_ACTIVITY_CLEAR_TOP);
                context.startActivity(intent);
    
                // 다운로드된 임시 파일 삭제 (60초 후)
                for (let filePath of downloaded)
                    setTimeout(() => {
                        try {
                            let tmpFile = new MEDIA_CONFIG.File(filePath);
                            if (tmpFile.exists()) tmpFile.delete();
                        } catch (delErr) {
                            Log.e("send - file deletion\n" + delErr);
                        }
                    }, 60000);

                return true;
            } else {
                let folder = "";
                if (!/^\/?(sdcard\/|storage\/emulated\/0\/)/.test(path)) {
                    let tempExt = "jpg";
                    try {
                        let urlObj = new java.net.URL(path);
                        let urlPath = urlObj.getPath();
                        tempExt = getFileExtension(urlPath);
                    } catch (e) {
                        tempExt = "jpg";
                    }
                    let mimeCheck = getMimeType(tempExt);
                    folder = mimeCheck.startsWith("image/") ? "sdcard/botData/images/" : "sdcard/botData/files/";
                }
                let result = prepareFile(path, folder, timeout || 30000);
    
                let intent = new MEDIA_CONFIG.Intent(MEDIA_CONFIG.Intent.ACTION_SENDTO);
                intent.setPackage("com.kakao.talk");
                intent.setType(result.mime);
    
                let uri = MEDIA_CONFIG.Uri.fromFile(new MEDIA_CONFIG.File(result.localPath));
                intent.putExtra(MEDIA_CONFIG.Intent.EXTRA_STREAM, uri);
    
                let channelIdLong = new MEDIA_CONFIG.Long(channelId.toString());
                intent.putExtra("key_id", channelIdLong);
                intent.putExtra("key_type", new MEDIA_CONFIG.Integer(1));
                intent.putExtra("key_from_direct_share", true);
    
                intent.addFlags(MEDIA_CONFIG.Intent.FLAG_ACTIVITY_NEW_TASK | MEDIA_CONFIG.Intent.FLAG_ACTIVITY_CLEAR_TOP);
                context.startActivity(intent);
    
                if (result.downloaded) {
                    setTimeout(() => {
                        try {
                            let tmpFile = new MEDIA_CONFIG.File(result.localPath);
                            if (new MEDIA_CONFIG.File(result.localPath).exists()) tmpFile.delete();
                        } catch (e) {
                            Log.e("send - file deletion\n" + e);
                        }
                    }, 60000);
                }
                return true;
            }
        } catch (e) {
            Log.e("send\n" + e);
            return false;
        }
    };
    
    /**
     * @description 파일 경로에서 확장자를 추출하는 헬퍼 함수
     * @param {string} filePath 파일 경로 또는 URL
     * @returns {string} 소문자 확장자, 없으면 기본 "jpg"
     */
    function getFileExtension(filePath) {
        let dotIndex = filePath.lastIndexOf(".");
        if (dotIndex !== -1 && dotIndex < filePath.length - 1)
            return filePath.substring(dotIndex + 1).toLowerCase();
        return "jpg";
    }
    
    /**
     * @description 파일 확장자에 따른 MIME 타입 반환 함수
     * @param {string} ext 파일 확장자
     * @returns {string} MIME 타입
     */
    function getMimeType(ext) {
        ext = ext.toLowerCase();
        let mimeMap = {
            // 이미지
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "gif": "image/gif",
            "bmp": "image/bmp",
            "png": "image/png",
            "tif": "image/tiff",
            "tiff": "image/tiff",
            "tga": "image/x-tga",
            "psd": "image/vnd.adobe.photoshop",
            "ai": "application/postscript",
    
            // 동영상
            "mp4": "video/mp4",
            "m4v": "video/mp4",
            "avi": "video/x-msvideo",
            "asf": "video/x-ms-asf",
            "wmv": "video/x-ms-wmv",
            "mkv": "video/x-matroska",
            "ts": "video/mp2t",
            "mpg": "video/mpeg",
            "mpeg": "video/mpeg",
            "mov": "video/quicktime",
            "flv": "video/x-flv",
            "ogv": "video/ogg",
    
            // 음성
            "mp3": "audio/mpeg",
            "wav": "audio/wav",
            "flac": "audio/flac",
            "tta": "audio/x-tta",
            "tak": "audio/x-tak",
            "aac": "audio/aac",
            "wma": "audio/x-ms-wma",
            "ogg": "audio/ogg",
            "m4a": "audio/mp4",
    
            /* =================== 문서, 압축 파일은 제대로 전송이 안 됨 - 누군가 고쳐주세요 =================== */
            // 문서 및 기타
            "doc": "application/msword",
            "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "hwp": "application/x-hwp",
            "txt": "text/plain",
            "rtf": "application/rtf",
            "xml": "application/xml",
            "pdf": "application/pdf",
            "wks": "application/vnd.ms-works",
            "xps": "application/vnd.ms-xpsdocument",
            "md": "text/markdown",
            "odf": "application/vnd.oasis.opendocument.text",
            "odt": "application/vnd.oasis.opendocument.text",
            "ods": "application/vnd.oasis.opendocument.spreadsheet",
            "odp": "application/vnd.oasis.opendocument.presentation",
            "csv": "text/csv",
            "tsv": "text/tab-separated-values",
            "xls": "application/vnd.ms-excel",
            "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            "ppt": "application/vnd.ms-powerpoint",
            "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
            "pages": "application/x-iwork-pages-sffpages",
            "key": "application/x-iwork-keynote-sffkey",
            "numbers": "application/x-iwork-numbers-sffnumbers",
            "show": "application/octet-stream",
            "ce": "application/octet-stream",
    
            // 압축파일
            "zip": "application/zip",
            "gz": "application/gzip",
            "bz2": "application/x-bzip2",
            "rar": "application/x-rar-compressed",
            "7z": "application/x-7z-compressed",
            "lzh": "application/x-lzh",
            "alz": "application/x-alz-compressed"
        };

        return mimeMap[ext] || "application/octet-stream";
    }

    module.exports = MediaSender;
})();