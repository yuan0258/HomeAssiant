# 🏡 御美學 (Yu-Aesthetics) · Home Assistant 全屋智慧家庭中控與 Antigravity Skill

本儲存庫完整收錄「御美學」智慧家庭中控系統（運行於 **Raspberry Pi 4**）的：
1. **Antigravity 專屬維運 Skill**：[`.agents/skills/home-assistant-smart-home/SKILL.md`](./.agents/skills/home-assistant-smart-home/SKILL.md)（同時同步於 [`skills/home-assistant-smart-home/`](./skills/home-assistant-smart-home/)）
2. **全屋互動式空間平面圖 ✕ 網路與 IoT 設備拓撲中控台**：[`config/www/c400-go2rtc.js`](./config/www/c400-go2rtc.js) 與 [`config/www/floorplan/floorplan.svg`](./config/www/floorplan/floorplan.svg)
3. **go2rtc 2.5K 零延遲 MSE 串流與總覽靜音播放器**：[`go2rtc/www/stream.html`](./go2rtc/www/stream.html) 與 [`go2rtc/go2rtc.yaml.example`](./go2rtc/go2rtc.yaml.example)
4. **Home Assistant 核心設定與 Xiaomi 路由器 BE3600 (RN06) 設備清冊**：[`config/configuration.yaml`](./config/configuration.yaml)

---

## 🖧 全屋雙層 NAT 網路與 Tailscale 穿透拓撲

```text
[ 🌐 中華電信 HiNet WAN (61.230.62.23) ]       [ 📱 iPhone 外出遠端連線 (Tailscale: 100.78.218.46) ]
                  │                                                ┆
                  ▼ (光纖 / 電話線)                                 ┆ (Tailscale WireGuard P2P 加密穿透)
[ 📠 第一層：中華電信路由器 / 數據機 (小烏龜) ]                     ┆
   • 網段：192.168.1.1 / 24 (負責撥號與第一層 NAT)                  ┆
                  │                                                ┆
                  ▼ (實體網路線接入 WAN 口)                        ┆
[ 🛜 第二層：Xiaomi 路由器 BE3600 (Model: RN06 / 孝親房) ]          ┆
   • 主網段：192.168.31.1 / 24 (miwifi.com)                        ┆
   • MAC：44:F7:70:70:27:24 | SN：60388/K4Y100066                  ┆
   • SSID：MissH (預設 SSID: m06_minet_2724)                       ┆
                  │                                                ┆
                  ├─── 2.4GHz / 5GHz Wi-Fi 7 區網互聯 ─────────────┤
                  ▼                                                ▼
[ 🍓 智慧家庭中樞：樹莓派 4 (Raspberry Pi 4 Model B) ] ◄───────────┘
   • 區網 IP：192.168.31.212 | Tailscale IP：100.113.142.12
   • 核心服務：
     - Home Assistant (Port 8123)
     - go2rtc 2.5K 串流伺服器 (Port 1984 / RTSP 8554)
     - ttyd 一鍵 WebSSH 終端機 (Port 7681)
     - Apple HomeKit Bridges (Port 21063 / 21064)
     - Bluetooth Passive BLE Gateway (hci0)
```

---

## 🏷️ 主力路由器硬體規格紀錄：Xiaomi 路由器 BE3600 (`RN06`)

| 項目 | 規格 / 識別碼 |
| :--- | :--- |
| **產品名稱** | Xiaomi 路由器 BE3600 (`Xiaomi Router BE3600`) |
| **產品型號 (Model)** | `RN06` (`xiaomi.router.rn06`) |
| **預設網路名稱 (Wi-Fi / SSID)** | `m06_minet_2724` (目前運作 SSID：`MissH`) |
| **管理頁面 (Management Interface)** | `http://miwifi.com` 或 `http://192.168.31.1` |
| **輸入電源 (Input)** | `12V ⎓ 1.5A` |
| **SN (序號)** | `60388/K4Y100066` |
| **MAC 位址** | `44:F7:70:70:27:24` |
| **製造號碼 (SKU)** | `DVB4494US` |
| **製造年份** | `2024年` |
| **NCC 認證編號** | `CCAH24LP1190T2` |
| **BSMI 認證** | `D39245 (RoHS)` |
| **FCC ID** | `2AIMRRN06` |

---

## 📦 全屋智慧家庭設備一覽

| 空間 | 設備名稱 | IP / 識別碼 | 連線方式 | 核心實體 (`entity_id`) |
| :--- | :--- | :--- | :--- | :--- |
| **孝親房** | 🍓 樹莓派 4 智慧中樞 | `192.168.31.212` (`TS: 100.113.142.12`) | Wi-Fi + Tailscale | `sensor.system_monitor_processor_temperature` |
| **孝親房** | 🛜 Xiaomi 路由器 BE3600 (`RN06`) | `192.168.31.1` (`44:F7:70:70:27:24`) | WAN / LAN 閘道 | `sensor.xiaomi_rn06_2724_connected_device_number` |
| **客廳** | 📹 小米智慧攝影機 C400 | `192.168.31.104` | go2rtc 2.5K RTSP 直連 | `camera.chuangmi_039c04_c643_camera_control` |
| **客廳** | 🌡️ 小米電子溫濕度時鐘 | `BLE: A4:C1:38:9D:F5:76` | 藍牙 BLE 連 Pi 4 (`hci0`) | `sensor.miaomiaoce_o2_f576_temperature` |
| **客廳** | 📺 Sony 55吋 4K 智慧電視 (`55X85K`) | `192.168.31.15` | 區網直連 (Android TV) | `media_player.55x85k` |
| **小孩房** | 🔊 Apple HomePod Mini | `192.168.31.229` | HomeKit 中樞 | `media_player.wo_shi` |
| **小孩房** | 💡 米家床頭燈 2 | `192.168.31.143` | 區網直連 + 藍牙網關 | `light.yeelink_bslamp2_2a87_light` |
| **書房** | 🖥️ Samsung M7 32吋智慧螢幕 | `192.168.31.97` | 區網直連 (Tizen / DLNA) | `media_player.monitor_samsung_m7_32` |
| **書房** | 🍼 Lollipop 嬰兒攝影機 (樺) | `192.168.31.102` (`10:D0:7A:B4:A7:D4`) | go2rtc RTSP 直連 (`554`) | `camera.lollipop_baby_camera` |
| **儲藏室** | 🤖 米家掃地機器人 (1代) | `192.168.31.240` | Xiaomi Miot Cloud Bridge | `vacuum.rockrobo_v1_6536_robot_cleaner` |

---

## 🛠️ Antigravity Skill 結構與使用方式

本專案內建符合 Antigravity Customization System 規範的 Skill：

```text
.agents/skills/home-assistant-smart-home/
├── SKILL.md                                  # 主技能說明與標準作業程序 (SOP)
├── references/
│   ├── network-and-iot-inventory.md          # 全屋網路拓撲、Xiaomi BE3600 (RN06) 規格與設備清冊
│   ├── camera-go2rtc-architecture.md         # C400 2.5K 零 CPU 串流、防黑屏閃爍與 /home/overview 靜音架構
│   └── webssh-ttyd-setup.md                  # 樹莓派 4 一鍵 WebSSH (ttyd 7681) 架構與管理指南
└── scripts/
    └── deploy_dashboard.py                   # 自動更新 Lovelace 快取版本 (?v=N) 並重載設定之腳本
```

### 安裝至全域 Antigravity Skills
```bash
cp -r .agents/skills/home-assistant-smart-home ~/.gemini/config/skills/
```
