# 小米 C400 2.5K 串流、防黑屏閃爍與總覽靜音架構指南

## 1. 串流架構概覽 (`go2rtc`)
小米智慧攝影機 C400 (`192.168.31.104`) 原生輸出 2.5K (2560×1440) H.265 視訊流與 PCM/AAC 音訊。
在樹莓派 4 上透過 `go2rtc` (`192.168.31.212:1984` / RTSP `8554`) 分為兩條串流通道：

1. **`c400_hd` (網頁端 2.5K 原生直通，零 CPU 負載)**：
   * 直接拉取 C400 RTSP H.265 主碼流並轉換音訊為 AAC，設定 `preload: c400_hd: ""` 保持 RTSP 長連線。
   * 因為不做 H.264 影像轉碼，樹莓派 4 待機 CPU 僅約 `5%~6%`，點擊開啟畫面時毫秒級出圖。
2. **`c400` (Apple HomeKit 按需 H.264 轉碼)**：
   * 僅當 iPhone / HomePod「家庭」App 請求畫面時，才按需啟動 `ffmpeg` H.264 轉碼（**切勿在 `go2rtc.yaml` 對 `c400` 啟用 `preload`，否則會導致樹莓派 4 24 小時消耗 25%+ CPU 並升溫至 72°C 以上**）。

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
