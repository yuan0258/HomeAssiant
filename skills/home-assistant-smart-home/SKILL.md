---
name: home-assistant-smart-home
description: >-
  Comprehensive deployment, maintenance, and troubleshooting guide for the
  Yu-Aesthetics (御美學) Home Assistant Smart Home system on Raspberry Pi 4
  (192.168.31.212 / Tailscale 100.113.142.12). Use this skill whenever the user
  asks to inspect, modify, debug, or extend Home Assistant configurations,
  interactive floorplan & network topology dashboards (c400-go2rtc.js /
  floorplan.svg), Xiaomi C400 2.5K go2rtc video streaming, Xiaomi Router BE3600
  (RN06) network topology, BLE sensors, HomeKit bridges, or One-Click WebSSH
  (ttyd).
---

# 御美學 (Yu-Aesthetics) Home Assistant 智慧家庭中控部署與維運 Skill

本 Skill 記錄並封裝了「御美學」全屋智慧家庭系統（基於 Raspberry Pi 4 + Docker Home Assistant + go2rtc + Tailscale + ttyd WebSSH）的完整架構、設備清冊、前端中控台開發規範與自動化部署流程。

---

## 1. 核心環境與連線資訊 (Quick Access)

| 項目 | 位址 / 路徑 | 說明 |
| :--- | :--- | :--- |
| **核心主機 (Raspberry Pi 4)** | `yuan@192.168.31.212` (Tailscale: `100.113.142.12`) | 免密碼 SSH Key 登入，運行 Docker 容器與 systemd 服務 |
| **Home Assistant 網頁介面** | `http://192.168.31.212:8123` | 預設總覽：`/home/overview`；全屋平面圖與拓撲中控台：`/dashboard-floorplan/floorplan` |
| **go2rtc 串流伺服器** | `http://192.168.31.212:1984` (RTSP: `8554`) | 提供小米 C400 2.5K (`c400_hd`) MSE 零 CPU 直通串流與靜態網頁 (`/config/www`) |
| **一鍵 WebSSH 終端機 (`ttyd`)** | `http://192.168.31.212:7681` | User systemd 服務 (`~/.config/systemd/user/ttyd.service`)，自動開啟 `bash -l` |
| **第二層主力路由器 (Wi-Fi 7)** | `http://192.168.31.1` (`miwifi.com`) | **Xiaomi 路由器 BE3600 (Model: RN06)**，管理 `192.168.31.0/24` 網段 |
| **第一層數據機 (中華電信)** | `http://192.168.1.1` | 中華電信 HiNet 數據機（小烏龜），負責 WAN 撥號與第一層 NAT |

### 樹莓派 4 關鍵檔案路徑
* **HA 設定目錄**：`/home/yuan/homeassistant/config/`
  * 主設定檔：`/home/yuan/homeassistant/config/configuration.yaml`
  * 全屋中控台與串流補丁：`/home/yuan/homeassistant/config/www/c400-go2rtc.js`
  * 全屋互動式平面圖 SVG：`/home/yuan/homeassistant/config/www/floorplan/floorplan.svg`
* **go2rtc 設定目錄**：`/home/yuan/homeassistant/go2rtc/`
  * 串流設定：`/home/yuan/homeassistant/go2rtc/go2rtc.yaml`
  * 自訂播放器頁面：`/home/yuan/homeassistant/go2rtc/www/stream.html`

---

## 2. 進階參考文件 (Progressive Disclosure References)

執行特定領域的修改或除錯時，請先閱讀對應的詳細參考指南：

1. **全屋網路拓撲與硬體設備清冊 (含 Xiaomi BE3600 RN06 完整規格與認證)**：
   👉 閱讀 [references/network-and-iot-inventory.md](./references/network-and-iot-inventory.md)
2. **小米 C400 2.5K 零延遲串流、防黑屏閃爍與 `/home/overview` 靜音架構**：
   👉 閱讀 [references/camera-go2rtc-architecture.md](./references/camera-go2rtc-architecture.md)
3. **樹莓派 4 一鍵 WebSSH (`ttyd`) 與系統健康監控配置**：
   👉 閱讀 [references/webssh-ttyd-setup.md](./references/webssh-ttyd-setup.md)

---

## 3. 標準部署與更新流程 (Standard Operating Procedures)

### 流程 A：更新前端中控台 (`c400-go2rtc.js` 或 `floorplan.svg`)
當修改了平面圖、網路拓撲、設備彈窗或攝影機播放器邏輯時，**必須同時更新 Lovelace Resource 的版本號 (`?v=N`)** 以強制瀏覽器與 Home Assistant 前端更新快取：

1. 將修改後的 `c400-go2rtc.js` 上傳至樹莓派：
   ```bash
   scp config/www/c400-go2rtc.js yuan@192.168.31.212:/home/yuan/homeassistant/config/www/c400-go2rtc.js
   ```
2. 執行部署腳本 [scripts/deploy_dashboard.py](./scripts/deploy_dashboard.py)（或透過 HA WebSocket 更新 `lovelace/resources` 與 `configuration.yaml` 的 `extra_module_url` 版本號，並呼叫 `homeassistant.reload_core_config`）。
3. 驗證方式：
   * 檢查 `configuration.yaml` 中的 `extra_module_url` 是否為最新 `?v=N`。
   * 開啟 `/dashboard-floorplan/floorplan` 與 `/home/overview` 確認畫面無設定錯誤且互動彈窗正常。

### 流程 B：新增或修改全屋設備資訊 (`DEVICE_CATALOG`)
1. 在 `config/www/c400-go2rtc.js` 的 `DEVICE_CATALOG` 中新增或更新設備物件（包含 `id`, `icon`, `name`, `room`, `ip`, `connType`, `model`, `deviceId`, `primaryEntity`, `description`, `entities`）。
2. 若設備有原廠銘牌資訊（如序號 SN、MAC、BSMI/NCC/FCC 認證），請同步寫入：
   * `configuration.yaml` 的 `homeassistant.customize` 區塊（附加於該設備的主實體上）。
   * `c400-go2rtc.js` 的 `_renderModalContent()` 專屬設備卡片區塊。
   * Home Assistant 的 `config/device_registry/update` WebSocket API（更新 `name_by_user` 與 `area_id`）。

### 流程 C：多攝影機與 `/home/overview` 靜音保護原則（點擊進入 Control 視窗可開啟聲音）
* **卡片預覽強制靜音 (`!this.controls`)**：在 `/home/overview` 總覽頁面的小卡片預覽模式下，攝影機串流 URL 自動附加 `media=video&muted=1&controls=0`（即 `http://192.168.31.212:1984/stream.html?src=c400_hd&mode=mse&media=video&muted=1&controls=0`），避免多台攝影機在總覽頁面產生聲音衝突。
* **點擊進入 Control 詳細視窗 (`this.controls === true`) 支援完整控制與聲音**：
  * 當使用者在 `/home/overview` 點擊攝影機卡片開啟詳細控制彈窗（或於平面圖開啟 C400 彈窗）時，播放器自動切換為包含音軌與控制列的 `stream.html?src=c400_hd&mode=mse&muted=1`。
  * 畫面同時提供底部原生 `<video controls>` 控制列與右上角 **「🔇 點擊開啟現場聲音 / 🔊 聲音已開啟」** 一鍵切換按鈕，點選即可立即收聽現場聲音。
