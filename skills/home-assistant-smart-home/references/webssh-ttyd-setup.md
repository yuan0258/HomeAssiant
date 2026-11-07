# 樹莓派 4 一鍵 WebSSH (`ttyd`) 與系統維護指南

## 1. WebSSH (`ttyd`) 架構與服務設定
為了讓使用者在 Home Assistant 儀表板中無須安裝終端機軟體即可一鍵進入樹莓派 4 命令列，系統部署了 `ttyd` (`1.7.7` `aarch64`)：

* **執行檔路徑**：`/home/yuan/.local/bin/ttyd`
* **Systemd User Service**：`/home/yuan/.config/systemd/user/ttyd.service`
* **常駐設定**：已啟用 `sudo loginctl enable-linger yuan`，開機自動於背景啟動。
* **監聽埠號**：`7681` (`http://192.168.31.212:7681` 或 Tailscale `http://100.113.142.12:7681`)

### `ttyd.service` 設定內容
```ini
[Unit]
Description=ttyd WebSSH Terminal for Raspberry Pi 4
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/yuan
ExecStart=/home/yuan/.local/bin/ttyd -p 7681 -W -t fontSize=14 -t titleFixed="Pi4-SmartHome-SSH" /bin/bash -l
Restart=always
RestartSec=3

[Install]
WantedBy=default.target
```

### 常用管理指令
```bash
# 檢查 WebSSH 服務狀態
systemctl --user status ttyd.service

# 重啟 WebSSH 服務
systemctl --user restart ttyd.service
```

---

## 2. 前端「💻 一鍵 SSH」三大觸發入口 (`c400-go2rtc.js`)
1. **頂部導覽列快捷鍵**：右上角綠色按鈕 `💻 一鍵 SSH 樹莓派 4`（點擊直接開啟樹莓派 4 彈窗並自動展開內嵌 WebSSH 終端機）。
2. **網路拓撲圖節點按鈕**：樹莓派 4 拓撲卡片右側 `💻 一鍵 SSH` 膠囊按鈕。
3. **樹莓派 4 詳情彈窗 (`pi4_hub`)**：
   * **⚡ 網頁內嵌一鍵 SSH**：在彈窗內直接載入 `http://${host}:7681` 互動式終端機。
   * **🚀 獨立全螢幕 WebSSH**：新分頁全螢幕開啟 `http://${host}:7681`。
   * **🖥️ 喚起本機終端機 (`ssh://`)**：透過 `ssh://yuan@${host}` 喚起 Windows Terminal / macOS Terminal。
   * **📋 複製 SSH 指令**：一鍵複製 `ssh yuan@192.168.31.212`。
