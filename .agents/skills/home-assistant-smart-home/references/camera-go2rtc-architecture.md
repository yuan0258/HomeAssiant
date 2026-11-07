# 小米 C400 2.5K 串流、防黑屏閃爍與總覽靜音架構指南

## 1. 雙攝影機串流架構概覽 (`go2rtc`)
1. **客廳：小米智慧攝影機 C400 (`192.168.31.104`, `camera.chuangmi_039c04_c643_camera_control`)**：
   * 原生輸出 2.5K (2560×1440) H.265 視訊流與 AAC 音訊 (`src=c400_hd`)。
   * 因為不做 H.264 影像轉碼，樹莓派 4 待機 CPU 僅約 `5%~6%`，點擊開啟畫面時毫秒級出圖。
   * `c400` 通道僅在 iPhone / HomePod「家庭」App 請求畫面時按需啟動 `ffmpeg` H.264 轉碼。
2. **書房：Lollipop 嬰兒攝影機 - 樺 (`192.168.31.102`, `camera.lollipop_baby_camera`)**：
   * 主機名稱：`lollipop-basic-162DEC40426A.local`（MAC: `10:D0:7A:B4:A7:D4`）。
   * 區網 RTSP 路徑計算規則：`rtsp://192.168.31.102:554/live/<MD5(cam_setting.objectId)>/ch00_0`（其中 `cam_setting.objectId = RCLpTK33BN`，MD5 為 `eb3b74e75c1d0d61fe3018ddb7853ff7`）。
   * **韌體 RTP / H.264 封包異常與零 CPU 修復 (`-bsf:v filter_units=remove_types=0`)**：
     * Lollipop 原廠 RTSP Server 存在兩項非標準行為：(1) 在每個 RTP 封包開頭直接塞入 Annex-B 起始碼 `00 00 00 01`（導致 RTP demuxer 拆出長度為 0 的 `nal_unit_type = 0` 空 NAL 單元，使得 `go2rtc` 無法辨識 IDR Keyframe Type 5 且 MP4 `avcC` 報錯 `Invalid NAL unit size`）；(2) SDP 標頭寫死假 Baseline SPS (`Z0IAHvQCgC3I`)，但實際影像為 **1280×720 H.264 High Profile + AAC (8000Hz)**。
     * **標準設定 (`go2rtc.yaml`)**：使用 `exec:ffmpeg` 搭配 `-c:v copy -bsf:v filter_units=remove_types=0 -c:a copy`，在不進行任何視訊轉碼（0% CPU 負擔）的前提下，自動剔除 `type=0` 空 NAL 並拆出正確的 `SPS(7)`、`PPS(8)`、`IDR(5)`，使 `api/frame.jpeg?src=lollipop`、HA `/api/camera_proxy/camera.lollipop_baby_camera` 與 Chrome MSE 串流皆可秒開播放。
   * ⚠️ **硬體供電注意**：Lollipop 的 USB 介面僅供電（無 UVC 資料傳輸），請使用獨立 5V 充電器供電，切勿插在樹莓派 4 的 USB 孔以免造成樹莓派 5V 低電壓 (`Undervoltage detected`) 斷線。

---

## 2. 解決彈窗影片閃黑問題 (Anti-Black-Flash Architecture)
過去點擊小米 C400 彈窗時會閃黑 2~3 次才穩定播放，根本原因與修復機制如下：

1. **強制指定 `&mode=mse`**：
   * 預設 `go2rtc` 的 `video-rtc.js` 會同時發起 `mse` 與 `webrtc` 協商。由於 WebRTC 對 H.265 支援不一致，當 MSE 已經開始播放後，約 0.8 秒後 WebRTC 協商結果返回會觸發 `onpcvideo()` 覆寫 `this.video.srcObject` 並關閉 WebSocket，造成畫面閃黑重連。
   * **解法**：所有嵌入網址一律加上 `&mode=mse`，純走 MSE MP4 串流。
2. **DOM 節點保留 (`_updateModalBodyPreservingStream`)**：
   * Home Assistant 每秒鐘都會推送狀態變更 (`set hass(hass)`)。若彈窗每次更新都重設 `bodyEl.innerHTML`，`iframe.modal-c400-stream` 就會被卸載重載。
   * **解法**：
     * 在 `set hass(hass)` 中透過 `_getModalStateSig(devKey)` 比對該彈窗關聯實體的簽章，未變更時絕不重繪。
     * 在 `_updateModalBodyPreservingStream()` 中，只要 `bodyEl.querySelector("iframe.modal-c400-stream")` 已存在，只局部更新 `#c400-event-bar`、`#c400-controls-box`、`#c400-entity-list`，永遠不動 `<iframe>` 節點。

---

## 3. `/home/overview` 總覽頁面強制靜音與多攝影機防護
為避免在 `http://192.168.31.212:8123/home/overview` 總覽頁面自動播放出聲音（以及未來接入多台攝影機時發生多路音訊干擾與回音）：

1. **自訂 `go2rtc/www/stream.html`**：
   * 在 `go2rtc.yaml` 掛載 `http.static_dir: /config/www`。
   * `stream.html` 支援 URL 參數：
     * `media=video`：在 `video.src` 連線前將 `video.media = 'video'`，讓 `video-rtc.js` 的 `codecs()` **完全不請求音訊編碼器**，從網路層直接杜絕音訊軌道傳輸。
     * `muted=1`：強制設定 `video.video.defaultMuted = true`、`video.video.muted = true`、`video.video.volume = 0`。
     * `controls=0`：隱藏瀏覽器原生 `<video controls>` 控制列，保持總覽卡片畫面乾淨。
2. **`ha-camera-stream` 自動判別 (`c400-go2rtc.js`)**：
   * **總覽卡片預覽 (`!this.controls`)**：自動使用 `http://192.168.31.212:1984/stream.html?src=c400_hd&mode=mse&media=video&muted=1&controls=0`（完全靜音、不拉音軌、`pointer-events: none` 讓點擊卡片可開啟 HA 詳細控制視窗）。
   * **點擊進入攝影機 Control 視窗 (`this.controls === true`) 或平面圖 C400 彈窗**：自動載入完整音視訊流 (`video,audio`)、開啟底部 `<video controls>` 控制列，並在畫面右上角提供 **「🔇 點擊開啟現場聲音」** 快捷按鈕，點擊即可立即播放現場聲音 (`volume = 1.0`)。
