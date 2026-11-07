# 全屋網路拓撲與硬體設備清冊 (Network & IoT Inventory)

## 1. 全屋雙層 NAT 網路與 Tailscale 穿透架構

```text
[ 🌐 網際網路 HiNet WAN (61.230.62.23) ]       [ 📱 iPhone 外出行動端 (Tailscale: 100.78.218.46) ]
                  │                                                ┆
                  ▼ (光纖 / 電話線)                                 ┆ (Tailscale WireGuard P2P 穿透)
[ 📠 第一層：中華電信數據機 (小烏龜) ]                             ┆
   • LAN IP: 192.168.1.1 / 24                                      ┆
                  │                                                ┆
                  ▼ (實體網路線接入 WAN 口)                        ┆
[ 🛜 第二層：Xiaomi 路由器 BE3600 (Model: RN06) ]                  ┆
   • 位置：孝親房 (次臥)                                           ┆
   • LAN IP: 192.168.31.1 / 24 (miwifi.com)                        ┆
   • MAC: 44:F7:70:70:27:24 | SN: 60388/K4Y100066                  ┆
                  │                                                ┆
                  ├─── 2.4GHz / 5GHz Wi-Fi 7 (SSID: MissH / 預設: m06_minet_2724)
                  ▼                                                ▼
[ 🍓 智慧家庭中樞：樹莓派 4 (Raspberry Pi 4 Model B) ] ◄───────────┘
   • 位置：孝親房
   • LAN IP: 192.168.31.212 | Tailscale IP: 100.113.142.12
   • 服務：HA (8123) / go2rtc (1984, 8554) / WebSSH ttyd (7681) / HomeKit (21063, 21064) / BLE (hci0)
```

---

## 2. 主力路由器詳細規格：Xiaomi 路由器 BE3600 (RN06)

| 欄位項目 | 記錄數值 |
| :--- | :--- |
| **產品名稱** | Xiaomi 路由器 BE3600 (`Xiaomi Router BE3600`) |
| **產品型號 (Model)** | `RN06` (HA 識別碼：`xiaomi.router.rn06`) |
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
| **HA Device ID** | `a84133e5750822defd8167475a9d7c8c` |
| **HA 主實體** | `sensor.xiaomi_rn06_2724_connected_device_number` |

---

## 3. 全屋智慧設備清冊 (IoT Device Catalog)

| 設備代號 (`devKey`) | 設備名稱 | 空間區域 (`area_id`) | IP / 連線識別 | 型號 (`model`) | HA Device ID | 核心實體 (`primaryEntity`) |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `pi4_hub` | 樹莓派 4 智慧中樞 | 孝親房 (`xiao_qin_fang`) | `192.168.31.212` / TS `100.113.142.12` | Raspberry Pi 4 Model B | `d477379a0f476cc653d901db9fd87102` | `sensor.system_monitor_processor_temperature` |
| `xiaomi_router` | Xiaomi 路由器 BE3600 | 孝親房 (`xiao_qin_fang`) | `192.168.31.1` (`44:F7:70:70:27:24`) | `RN06` (`xiaomi.router.rn06`) | `a84133e5750822defd8167475a9d7c8c` | `sensor.xiaomi_rn06_2724_connected_device_number` |
| `c400_camera` | 小米智慧攝影機 C400 | 客廳 (`ke_ting`) | `192.168.31.104` | `chuangmi.camera.039c04` | `6cccc6e672072b618af719a2f64ad7f9` | `camera.chuangmi_039c04_c643_camera_control` |
| `ble_clock` | 小米電子溫濕度時鐘 | 客廳 (`ke_ting`) | BLE `A4:C1:38:9D:F5:76` | `miaomiaoce.sensor_ht.o2` (LYWSD02MMC) | `a938111f9f4127c32a6f233c0214d881` | `sensor.miaomiaoce_o2_f576_temperature` |
| `sony_tv` | Sony 55吋 4K 智慧電視 | 客廳 (`ke_ting`) | `192.168.31.15` | `KM-55X85K` (BRAVIA 4K VH21) | `637e8839ca280a4b6982071bf17d77cf` | `media_player.55x85k` |
| `homepod_mini` | Apple HomePod Mini | 小孩房 (`xiao_hai_fang`) | `192.168.31.229` | HomePod Mini | `644f76d707573bd40f743ce5ece7a71f` | `media_player.wo_shi` |
| `bedside_lamp` | 米家床頭燈 2 | 小孩房 (`xiao_hai_fang`) | `192.168.31.143` | `yeelink.light.bslamp2` | `9545a1bc3603b71eac9d249f758baac6` | `light.yeelink_bslamp2_2a87_light` |
| `samsung_m7` | Samsung M7 32吋智慧螢幕 | 書房 (`shu_fang`) | `192.168.31.97` | `LS32AM700UCXZW` | `0827c5f834211437310ecb523520b4cb` | `media_player.monitor_samsung_m7_32` |
| `roborock_vacuum` | 米家掃地機器人 (1代) | 儲藏室 (`chu_cang_shi`) | `192.168.31.240` (Cloud Bridge) | `rockrobo.vacuum.v1` | `790059e23c7ab0a1ab980cc5dc6e6585` | `vacuum.rockrobo_v1_6536_robot_cleaner` |
| `iphone_tailscale` | iPhone 遠端連線 | 行動端 | Tailscale `100.78.218.46` | `iPhone19,7` | `ee70e807b3a7618c010ee3e520d13f46` | `device_tracker.iphone` |
