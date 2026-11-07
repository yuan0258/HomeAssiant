const TARGET_ENTITY = "camera.chuangmi_039c04_c643_camera_control";
const LOLLIPOP_ENTITY = "camera.lollipop_baby_camera";
const CAMERA_STREAM_MAP = {
  [TARGET_ENTITY]: "c400_hd",
  [LOLLIPOP_ENTITY]: "lollipop",
};

function getStreamUrl(opts = {}) {
  const host = window.location.hostname || "192.168.31.212";
  const params = new URLSearchParams({
    src: opts.src || "c400_hd",
    mode: "mse",
  });
  if (opts.videoOnly) {
    params.set("media", "video");
    params.set("muted", "1");
  } else if (opts.muted) {
    params.set("muted", "1");
  }
  if (opts.controls === false) {
    params.set("controls", "0");
  }
  return `http://${host}:1984/stream.html?${params.toString()}`;
}

// 1. Force hui-picture-entity-card & hui-image for C400 & Lollipop to always use camera_view: "live"
customElements.whenDefined("hui-picture-entity-card").then((CardClass) => {
  const origSetConfig = CardClass.prototype.setConfig;
  CardClass.prototype.setConfig = function (config) {
    const ent = config && (config.entity || config.camera_image);
    if (ent && CAMERA_STREAM_MAP[ent]) {
      config = {
        ...config,
        camera_view: "live",
        aspect_ratio: config.aspect_ratio || "16:9",
        grid_options: config.grid_options || { columns: 6, rows: 3 },
      };
    }
    return origSetConfig.call(this, config);
  };
});

customElements.whenDefined("hui-image").then((ImageClass) => {
  const origUpdated = ImageClass.prototype.updated;
  ImageClass.prototype.updated = function (changedProps) {
    const ent = this.cameraImage || this.entity;
    if (ent && CAMERA_STREAM_MAP[ent] && this.cameraView !== "live") {
      this.cameraView = "live";
    }
    if (origUpdated) {
      return origUpdated.call(this, changedProps);
    }
  };
});

// 2. Patch ha-camera-stream to directly embed go2rtc stream.html for C400 & Lollipop
customElements.whenDefined("ha-camera-stream").then((StreamClass) => {
  const origGetCapabilities = StreamClass.prototype._getCapabilities;
  StreamClass.prototype._getCapabilities = async function () {
    const ent = this.stateObj && this.stateObj.entity_id;
    if (ent && CAMERA_STREAM_MAP[ent]) {
      this._capabilities = { frontend_stream_types: [] };
      return;
    }
    return origGetCapabilities.apply(this, arguments);
  };

  const origGetPosterUrl = StreamClass.prototype._getPosterUrl;
  StreamClass.prototype._getPosterUrl = async function () {
    const ent = this.stateObj && this.stateObj.entity_id;
    if (ent && CAMERA_STREAM_MAP[ent]) {
      return;
    }
    return origGetPosterUrl ? origGetPosterUrl.apply(this, arguments) : undefined;
  };

  const origUpdated = StreamClass.prototype.updated;
  StreamClass.prototype.updated = function (changedProps) {
    if (origUpdated) {
      origUpdated.call(this, changedProps);
    }
    const ent = this.stateObj && this.stateObj.entity_id;
    const streamName = ent && CAMERA_STREAM_MAP[ent];
    if (!streamName) {
      return;
    }
    const root = this.shadowRoot || this.renderRoot;
    if (!root) return;

    this.style.display = "block";
    this.style.width = "100%";
    this.style.height = "100%";
    this.style.aspectRatio = "16 / 9";

    const parent = this.parentElement;
    if (parent && parent.classList && parent.classList.contains("ratio")) {
      this.style.position = "absolute";
      this.style.top = "0";
      this.style.left = "0";
    }

    Array.from(root.children).forEach((el) => {
      if (el.tagName !== "STYLE" && (!el.classList || !el.classList.contains("go2rtc-c400-iframe"))) {
        el.style.display = "none";
      }
    });

    let iframe = root.querySelector("iframe.go2rtc-c400-iframe");
    // Only mute & strip audio on the card preview (!this.controls).
    // When user clicks into the camera control dialog (this.controls === true), enable full controls & audio!
    const isCardPreview = !this.controls;
    const targetSrc = getStreamUrl({
      src: streamName,
      videoOnly: isCardPreview,
      muted: true,
      controls: !isCardPreview,
    });
    if (!iframe) {
      iframe = document.createElement("iframe");
      iframe.className = "go2rtc-c400-iframe";
      iframe.src = targetSrc;
      iframe.allow = isCardPreview ? "fullscreen" : "autoplay; fullscreen";
      iframe.style.cssText =
        "width:100%;height:100%;min-height:200px;border:0;display:block;background:#000;" +
        (this.controls ? "pointer-events:auto;" : "pointer-events:none;");
      iframe.addEventListener("load", () => {
        this.dispatchEvent(new Event("load"));
      });
      root.appendChild(iframe);
    } else {
      if (iframe.src !== targetSrc) {
        iframe.src = targetSrc;
      }
      iframe.style.pointerEvents = this.controls ? "auto" : "none";
    }
  };
});

// ============================================================================
// 3. Unified Floorplan + Network & IoT Topology Interactive Dashboard Card
// ============================================================================

const DEVICE_CATALOG = {
  wan_internet: {
    id: "wan_internet",
    icon: "🌐",
    name: "網際網路 (Internet / 5G)",
    room: "外部廣域網路 (WAN)",
    ip: "61.230.62.23 (HiNet)",
    connType: "光纖/電話線 (WAN) + Tailscale",
    model: "Chunghwa Telecom HiNet",
    primaryEntity: "sensor.system_monitor_ipv4_address_tailscale0",
    description: "中華電信 HiNet 外網連線，透過第一層數據機撥號上網，並搭配 Tailscale WireGuard P2P 加密隧道提供外網無縫穿透直連。",
    entities: [
      "sensor.system_monitor_ipv4_address_tailscale0",
      "sensor.system_monitor_ipv4_address_wlan0",
      "device_tracker.iphone"
    ]
  },
  iphone_tailscale: {
    id: "iphone_tailscale",
    icon: "📱",
    name: "iPhone (外出遠端連線)",
    room: "行動端 / 遠端穿透",
    ip: "Tailscale: 100.78.218.46",
    connType: "Tailscale P2P 加密隧道",
    model: "Apple iPhone (iPhone19,7)",
    deviceId: "ee70e807b3a7618c010ee3e520d13f46",
    primaryEntity: "device_tracker.iphone",
    description: "透過 Tailscale WireGuard P2P 加密隧道直接穿透兩層 NAT，在外網 5G 環境下仍可直連家中樹莓派 4 (100.113.142.12)。",
    entities: ["device_tracker.iphone", "person.wo_de_zhu_bei_jia"]
  },
  cht_modem: {
    id: "cht_modem",
    icon: "📠",
    name: "第一層：中華電信路由器 / 數據機 (小烏龜)",
    room: "弱電箱 (第一層 NAT)",
    ip: "192.168.1.1 / 24",
    connType: "Hop 2: 192.168.1.1",
    model: "CHT VDSL2 / GPON HGW",
    primaryEntity: "sensor.system_monitor_ipv4_address_wlan0",
    description: "負責中華電信 PPPoE/DHCP 撥號上網與第一層 NAT (192.168.1.x)，下方透過實體網路線接入小米 WiFi 7 路由器 WAN 口。",
    entities: [
      "sensor.system_monitor_ipv4_address_wlan0",
      "sensor.system_monitor_ipv4_address_tailscale0"
    ]
  },
  xiaomi_router: {
    id: "xiaomi_router",
    icon: "🛜",
    name: "第二層：Xiaomi 路由器 BE3600 (RN06 / Xiaomi_wifi7)",
    room: "孝親房 (次臥)",
    ip: "192.168.31.1 / 24 (MAC: 44:F7:70:70:27:24)",
    connType: "Hop 1: 192.168.31.1 • 預設 SSID: m06_minet_2724",
    model: "RN06 (xiaomi.router.rn06) • SN: 60388/K4Y100066",
    deviceId: "a84133e5750822defd8167475a9d7c8c",
    primaryEntity: "sensor.xiaomi_rn06_2724_connected_device_number",
    description: "Xiaomi 路由器 BE3600 (型號 RN06，製造號碼 DVB4494US，2024年製，電源 12V⎓1.5A)。全屋主力 2.4GHz / 5GHz Wi-Fi 7 區網路由器，管理 192.168.31.0/24 網段內所有智慧家庭裝置與樹莓派中樞。",
    entities: [
      "sensor.xiaomi_rn06_2724_connected_device_number",
      "sensor.system_monitor_ipv4_address_wlan0"
    ]
  },
  pi4_hub: {
    id: "pi4_hub",
    icon: "🍓",
    name: "智慧家庭中樞：樹莓派 4 (Raspberry Pi 4)",
    room: "孝親房 / 核心中控",
    ip: "192.168.31.212 • TS: 100.113.142.12",
    connType: "核心中控伺服器",
    model: "Raspberry Pi 4 Model B",
    deviceId: "d477379a0f476cc653d901db9fd87102",
    primaryEntity: "sensor.system_monitor_processor_temperature",
    description: "運行 Home Assistant (8123)、go2rtc 2.5K 串流引擎 (1984/8554)、HomeKit Bridge (21063/21064/21065) 與藍牙 BLE 閘道 (hci0)。",
    entities: [
      "sensor.system_monitor_processor_temperature",
      "sensor.system_monitor_processor_use",
      "sensor.system_monitor_memory_usage",
      "sensor.system_monitor_memory_free",
      "sensor.system_monitor_disk_usage",
      "sensor.system_monitor_disk_free",
      "sensor.system_monitor_load_1_min",
      "sensor.system_monitor_ipv4_address_wlan0",
      "sensor.system_monitor_ipv4_address_tailscale0",
      "sensor.system_monitor_uptime"
    ]
  },
  c400_camera: {
    id: "c400_camera",
    icon: "📹",
    name: "小米攝影機 C400 (客廳)",
    room: "客廳 Living",
    ip: "192.168.31.104",
    connType: "go2rtc 直連 (2.5K HD)",
    model: "chuangmi.camera.039c04",
    deviceId: "6cccc6e672072b618af719a2f64ad7f9",
    primaryEntity: "camera.chuangmi_039c04_c643_camera_control",
    description: "客廳主視角 2.5K 超清智慧攝影機，已整合 go2rtc 低延遲串流直連，支援鏡頭休眠遮蔽、移動偵測、微光全彩與夜視控制。",
    entities: [
      "camera.chuangmi_039c04_c643_camera_control",
      "switch.chuangmi_039c04_c643_switch_status",
      "switch.chuangmi_039c04_c643_motion_detection",
      "switch.chuangmi_039c04_c643_glimmer_full_color",
      "switch.chuangmi_039c04_c643_wide_dynamic_range_mode",
      "switch.chuangmi_039c04_c643_time_watermark",
      "light.chuangmi_039c04_c643_indicator_light",
      "select.chuangmi_039c04_c643_night_shot",
      "select.chuangmi_039c04_c643_detection_sensitivity",
      "select.chuangmi_039c04_c643_recording_mode",
      "sensor.chuangmi_039c04_c643_status",
      "sensor.chuangmi_039c04_c643_storage_free_space",
      "sensor.mi_6253308962_message"
    ]
  },
  homepod_mini: {
    id: "homepod_mini",
    icon: "🔊",
    name: "HomePod Mini (小孩房)",
    room: "小孩房",
    ip: "192.168.31.229",
    connType: "HomeKit 中樞",
    model: "Apple HomePod Mini",
    deviceId: "644f76d707573bd40f743ce5ece7a71f",
    primaryEntity: "media_player.wo_shi_wo_shi",
    description: "小孩房智慧音箱暨 Apple HomeKit 家庭中樞，支援音樂播放、音量控制、Siri 語音與全屋廣播。",
    entities: ["media_player.wo_shi_wo_shi", "remote.wo_shi_wo_shi"]
  },
  bedside_lamp: {
    id: "bedside_lamp",
    icon: "💡",
    name: "米家床頭燈 2 (小孩房)",
    room: "小孩房",
    ip: "192.168.31.143",
    connType: "區網直連 + 藍牙網關",
    model: "yeelink.light.bslamp2",
    deviceId: "9545a1bc3603b71eac9d249f758baac6",
    primaryEntity: "light.yeelink_bslamp2_2a87_light",
    description: "小孩房智慧全彩床頭燈，支援無段亮度調節、冷暖色溫切換與 RGB 全彩情境燈光，並已開啟內建 ESP32 小米藍牙網關功能。",
    entities: [
      "light.yeelink_bslamp2_2a87_light",
      "button.yeelink_bslamp2_2a87_toggle"
    ]
  },
  samsung_m7: {
    id: "samsung_m7",
    icon: "🖥️",
    name: "Samsung M7 螢幕 (書房)",
    room: "書房 Study",
    ip: "192.168.31.97",
    connType: "區網直連",
    model: "Samsung M7 32\" (LS32AM700UCXZW)",
    deviceId: "0827c5f834211437310ecb523520b4cb",
    primaryEntity: "media_player.monitor_samsung_m7_32",
    description: "書房 32 吋 4K 智慧聯網螢幕，支援遠端電源開關、音量調整與媒體投放控制（同房間另有 Lollipop 嬰兒攝影機 192.168.31.102 駐點守護）。",
    entities: [
      "media_player.monitor_samsung_m7_32_ls32am700ucxzw",
      "media_player.monitor_samsung_m7_32",
      "remote.monitor_samsung_m7_32_ls32am700ucxzw",
      "camera.lollipop_baby_camera"
    ]
  },
  lollipop_camera: {
    id: "lollipop_camera",
    icon: "🍼",
    name: "Lollipop 嬰兒攝影機 (書房 - 樺)",
    room: "書房 Study",
    ip: "192.168.31.102 (MAC: 10:D0:7A:B4:A7:D4)",
    connType: "go2rtc 直連 + Apple HomeKit (Port 21065)",
    model: "lollipop-basic-162DEC40426A • ID: m3YYPO7gda",
    deviceId: "27b3754f9afed55222e60056f214d214",
    primaryEntity: "camera.lollipop_baby_camera",
    description: "書房智慧嬰兒監視器（寶寶：樺，生日 2025-04-12）。透過 go2rtc 直接拉取區網 192.168.31.102:554 原生 H.264 視訊與 AAC 音訊串流，並已接入 Apple HomeKit (Port 21065 零 CPU 轉碼)，具備哭聲偵測與環境噪音監測 (閾值 80dB)。",
    entities: [
      "camera.lollipop_baby_camera"
    ]
  },
  ble_clock: {
    id: "ble_clock",
    icon: "🌡️",
    name: "小米溫濕度時鐘 (客廳)",
    room: "客廳 Living",
    ip: "BLE: A4:C1:38:9D:F5:76",
    connType: "藍牙連 Pi4 (MiBeacon 解密直連)",
    model: "LYWSD02MMC / miaomiaoce.sensor_ht.o2",
    deviceId: "a938111f9f4127c32a6f233c0214d881",
    primaryEntity: "sensor.miaomiaoce_o2_f576_temperature",
    description: "客廳電子墨水溫濕度時鐘，已透過 32 位元 MiBeacon Bindkey 本地解密廣播與 GATT 特徵值，由樹莓派 4 藍牙即時接收溫度、濕度、電池電量與訊號強度。",
    entities: [
      "sensor.miaomiaoce_o2_f576_temperature",
      "sensor.miaomiaoce_o2_f576_relative_humidity",
      "sensor.miaomiaoce_o2_f576_battery_level",
      "sensor.miaomiaoce_o2_f576_signal_strength"
    ]
  },
  sony_tv: {
    id: "sony_tv",
    icon: "📺",
    name: "Sony 55X85K 電視 (客廳)",
    room: "客廳 Living",
    ip: "192.168.31.15",
    connType: "BRAVIA 區網直連 (Cast + Android TV)",
    model: "SONY KM-55X85K (4K VH21)",
    deviceId: "077f8e09daf4b36e2257bc16089a2194",
    primaryEntity: "media_player.sony_km_55x85k_2",
    description: "客廳 55 吋 4K 120Hz Google TV 智慧電視 (192.168.31.15)，支援電源控制、播放狀態同步、音量控制與遙控器操作。",
    entities: [
      "media_player.sony_km_55x85k_2",
      "media_player.sony_km_55x85k",
      "media_player.sony_km_55x85k_3",
      "remote.sony_km_55x85k"
    ]
  },
  roborock_vacuum: {
    id: "roborock_vacuum",
    icon: "🤖",
    name: "米家掃地機器人 1代 (儲藏室)",
    room: "儲藏室 Storage",
    ip: "TP-Link_609C (192.168.0.111)",
    connType: "雲端橋接",
    model: "rockrobo.vacuum.v1",
    deviceId: "790059e23c7ab0a1ab980cc5dc6e6585",
    primaryEntity: "vacuum.rockrobo_v1_6536_robot_cleaner",
    description: "跨網段連線於 TP-Link_609C (192.168.0.111)，透過小米雲端與樹莓派同步，支援遠端開始清掃、暫停、返回充電與語音定位。",
    entities: [
      "vacuum.rockrobo_v1_6536_robot_cleaner",
      "sensor.rockrobo_v1_6536_status",
      "sensor.rockrobo_v1_6536_battery_level",
      "sensor.rockrobo_v1_6536_charging_state",
      "button.rockrobo_v1_6536_start_sweep",
      "button.rockrobo_v1_6536_stop_sweeping",
      "button.rockrobo_v1_6536_start_charge",
      "button.rockrobo_v1_6536_identify"
    ]
  },
  // Architectural Rooms & Legend Modals
  room_master: {
    id: "room_master",
    icon: "🛏️",
    name: "主臥室 (Master Bedroom)",
    room: "右上主臥區",
    ip: "床鋪尺寸: 180 × 188 cm",
    connType: "空間與水電配置",
    model: "成馨空間設計 · 御美學",
    primaryEntity: "sensor.miaomiaoce_o2_f576_temperature",
    description: "主臥室配置雙人加大床位 (180×188cm)、整排系統衣櫃與床頭 110V 電源插座組，鄰接主衛浴與客廳區。",
    entities: [
      "sensor.miaomiaoce_o2_f576_temperature",
      "sensor.miaomiaoce_o2_f576_relative_humidity"
    ]
  },
  room_kitchen: {
    id: "room_kitchen",
    icon: "🍳",
    name: "廚房區 (Kitchen)",
    room: "左中下廚具區",
    ip: "配置專用迴路插座",
    connType: "空間與水電配置",
    model: "成馨空間設計 · 御美學",
    primaryEntity: "vacuum.rockrobo_v1_6536_robot_cleaner",
    description: "廚房與家電櫃區域，配置電器櫃專用插座與流理台動線，鄰接餐廳與儲藏室（掃地機器人駐點）。",
    entities: [
      "vacuum.rockrobo_v1_6536_robot_cleaner",
      "sensor.rockrobo_v1_6536_battery_level"
    ]
  },
  room_bath_guest: {
    id: "room_bath_guest",
    icon: "🚿",
    name: "客用衛浴 (Guest Bathroom)",
    room: "中上左衛浴區",
    ip: "乾濕分離配置",
    connType: "空間與水電配置",
    model: "成馨空間設計 · 御美學",
    primaryEntity: "sensor.miaomiaoce_o2_f576_relative_humidity",
    description: "客用衛浴空間，位於小孩房與主衛浴之間，配置防水插座與排風迴路。",
    entities: [
      "sensor.miaomiaoce_o2_f576_relative_humidity",
      "sensor.miaomiaoce_o2_f576_temperature"
    ]
  },
  room_bath_master: {
    id: "room_bath_master",
    icon: "🛁",
    name: "主臥衛浴 (Master Bathroom)",
    room: "中上右衛浴區",
    ip: "主臥專屬衛浴",
    connType: "空間與水電配置",
    model: "成馨空間設計 · 御美學",
    primaryEntity: "sensor.miaomiaoce_o2_f576_relative_humidity",
    description: "主臥室附屬衛浴與更衣動線區，配備獨立換氣與防水電源迴路。",
    entities: [
      "sensor.miaomiaoce_o2_f576_relative_humidity",
      "sensor.miaomiaoce_o2_f576_temperature"
    ]
  },
  room_hallway: {
    id: "room_hallway",
    icon: "🚪",
    name: "玄關與中央走廊 (Entrance & Hallway)",
    room: "中央動線軸",
    ip: "全屋動線核心",
    connType: "空間與水電配置",
    model: "成馨空間設計 · 御美學",
    primaryEntity: "camera.chuangmi_039c04_c643_camera_control",
    description: "大門入口玄關與中央走廊，串聯小孩房、孝親房、書房與客餐廳，受客廳 C400 智慧攝影機移動偵測守護。",
    entities: [
      "camera.chuangmi_039c04_c643_camera_control",
      "switch.chuangmi_039c04_c643_motion_detection",
      "sensor.mi_6253308962_message"
    ]
  },
  legend_outlets: {
    id: "legend_outlets",
    icon: "⚡",
    name: "全屋水電 ✕ 弱電圖例說明",
    room: "建築工程圖例",
    ip: "110V / 220V / CAT.6 / TV",
    connType: "成馨空間設計圖號",
    model: "Electrical & Weak-Current Legend",
    primaryEntity: "sensor.xiaomi_rn06_2724_connected_device_number",
    description: "平面圖上標示之水電與弱電工程圖號：🔵 C 為電腦網路插座 (CAT.6)、🟠 Φ 為 110V/220V 電源插座、🟣 TV 為電視同軸插座、🟢 TEL 為電話弱電插座。",
    entities: [
      "sensor.xiaomi_rn06_2724_connected_device_number",
      "sensor.system_monitor_ipv4_address_wlan0"
    ]
  }
};

class IotFloorplanTopologyCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = null;
    this._config = {};
    this._selectedDevice = null;
    this._hoveredDevice = null;
    this._viewMode = "split";
    this._initialized = false;
    this._lastModalStateSig = "";
    this._webSshOpen = false;
  }

  _getModalStateSig(devKey) {
    const dev = (window.__IOT_DEVICE_CATALOG || DEVICE_CATALOG)[devKey];
    if (!dev || !this._hass || !this._hass.states) return "";
    return dev.entities
      .map((eid) => {
        const s = this._hass.states[eid];
        if (!s) return `${eid}:null`;
        const bri = s.attributes?.brightness || "";
        return `${eid}:${s.state}:${bri}`;
      })
      .join("|");
  }

  setConfig(config) {
    this._config = config || {};
    if (!this._initialized) {
      this._renderSkeleton();
      this._loadFloorplanSvg();
      this._initialized = true;
    }
  }

  set hass(hass) {
    this._hass = hass;
    if (!this._initialized) {
      this._renderSkeleton();
      this._loadFloorplanSvg();
      this._initialized = true;
    }
    this._updateFloorplanStates();
    this._updateTopologyBadges();
    if (this._selectedDevice) {
      const sig = this._getModalStateSig(this._selectedDevice);
      if (sig !== this._lastModalStateSig) {
        this._lastModalStateSig = sig;
        this._renderModalContent(this._selectedDevice);
      }
    }
  }

  getCardSize() {
    return 12;
  }

  _fireMoreInfo(entityId) {
    if (!entityId) return;
    const ev = new CustomEvent("hass-more-info", {
      detail: { entityId },
      bubbles: true,
      composed: true,
    });
    const haRoot = document.querySelector("home-assistant");
    if (haRoot) {
      haRoot.dispatchEvent(ev);
    } else {
      this.dispatchEvent(ev);
    }
  }

  _callService(domain, service, data) {
    if (!this._hass) return;
    this._hass.callService(domain, service, data);
  }

  _getState(entityId, fallback = "--") {
    if (!this._hass || !this._hass.states || !this._hass.states[entityId]) {
      return fallback;
    }
    return this._hass.states[entityId].state;
  }

  _getAttr(entityId, attr, fallback = "") {
    if (!this._hass || !this._hass.states || !this._hass.states[entityId]) {
      return fallback;
    }
    const val = this._hass.states[entityId].attributes?.[attr];
    return val !== undefined ? val : fallback;
  }

  _formatEntityValue(eid, st, unit) {
    if (eid.startsWith("button.")) {
      return "🔘 點擊觸發";
    }
    if (eid === "sensor.chuangmi_039c04_c643_storage_free_space") {
      const kb = parseFloat(st);
      if (!isNaN(kb)) {
        return kb >= 1048576
          ? `${(kb / 1048576).toFixed(2)} GB`
          : `${(kb / 1024).toFixed(1)} MB`;
      }
    }
    if (eid === "sensor.system_monitor_uptime" && st && st.includes("T")) {
      try {
        const bootDate = new Date(st);
        const diffSec = Math.max(0, Math.floor((Date.now() - bootDate.getTime()) / 1000));
        const days = Math.floor(diffSec / 86400);
        const hrs = Math.floor((diffSec % 86400) / 3600);
        const mins = Math.floor((diffSec % 3600) / 60);
        return `已連續運作 ${days > 0 ? days + "天 " : ""}${hrs}小時 ${mins}分`;
      } catch (e) {
        return st;
      }
    }
    const stateLabels = {
      on: "開啟 (on)",
      off: "關閉 (off)",
      playing: "播放中 (playing)",
      paused: "已暫停 (paused)",
      idle: "待機 (idle)",
      standby: "待命 (standby)",
      streaming: "串流中 (streaming)",
      docked: "充電座待命 (docked)",
      charging: "充電中 (charging)",
      cleaning: "清掃中 (cleaning)",
      returning: "回充中 (returning)",
      home: "在家 (home)",
      not_home: "外出中 (not_home)",
      normal: "正常 (normal)",
      unavailable: "離線 (unavailable)",
      unknown: "待命"
    };
    if (stateLabels[st]) {
      return stateLabels[st];
    }
    return `${st}${unit ? " " + unit : ""}`;
  }

  async _loadFloorplanSvg() {
    try {
      const [svgRes, cssRes] = await Promise.all([
        fetch("/local/floorplan/floorplan.svg?v=20", { cache: "no-cache" }),
        fetch("/local/floorplan/floorplan.css?v=20", { cache: "no-cache" }),
      ]);
      const svgText = await svgRes.text();
      const cssText = await cssRes.text();

      const styleEl = this.shadowRoot.getElementById("fp-dynamic-css");
      if (styleEl) styleEl.textContent = cssText;

      const fpContainer = this.shadowRoot.getElementById("fp-svg-container");
      if (fpContainer) {
        fpContainer.innerHTML = svgText;
        this._bindFloorplanEvents(fpContainer);
        this._updateFloorplanStates();
      }
    } catch (e) {
      console.error("Failed to load floorplan SVG/CSS:", e);
    }
  }

  _bindFloorplanEvents(fpContainer) {
    const svg = fpContainer.querySelector("svg");
    if (!svg) return;

    const interactiveEls = svg.querySelectorAll("[data-device]");
    interactiveEls.forEach((el) => {
      const devKey = el.getAttribute("data-device");
      el.style.cursor = "pointer";

      el.addEventListener("mouseenter", () => {
        this._setHoverDevice(devKey);
      });
      el.addEventListener("mouseleave", () => {
        this._setHoverDevice(null);
      });
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._openDeviceModal(devKey);
      });
    });
  }

  _setHoverDevice(devKey) {
    this._hoveredDevice = devKey;
    const fpContainer = this.shadowRoot.getElementById("fp-svg-container");
    if (fpContainer) {
      fpContainer.querySelectorAll(".topology-highlight-room").forEach((el) =>
        el.classList.remove("topology-highlight-room")
      );
      fpContainer.querySelectorAll(".topology-highlight-entity").forEach((el) =>
        el.classList.remove("topology-highlight-entity")
      );
      if (devKey) {
        const roomMap = {
          bedside_lamp: "area.bedroom_northwest",
          homepod_mini: "area.bedroom_northwest",
          xiaomi_router: "area.bedroom_southwest",
          pi4_hub: "area.bedroom_southwest",
          c400_camera: "area.living_dining",
          ble_clock: "area.living_dining",
          sony_tv: "area.living_dining",
          samsung_m7: "area.study_room",
          lollipop_camera: "area.study_room",
          roborock_vacuum: "area.storage",
          room_master: "area.bedroom_master",
          room_kitchen: "area.kitchen",
          room_bath_guest: "area.bathroom_guest",
          room_bath_master: "area.bathroom_master",
          room_hallway: "area.hallway",
        };
        const roomId = roomMap[devKey];
        if (roomId) {
          const roomEl = fpContainer.querySelector(`[id="${roomId}"]`);
          if (roomEl) roomEl.classList.add("topology-highlight-room");
        }
        fpContainer.querySelectorAll(`[data-device="${devKey}"]`).forEach((el) => {
          if (!el.classList.contains("ha-room")) {
            el.classList.add("topology-highlight-entity");
          }
        });
      }
    }

    this.shadowRoot.querySelectorAll(".topo-node[data-device]").forEach((node) => {
      if (devKey && node.getAttribute("data-device") === devKey) {
        node.classList.add("topo-node-active");
      } else {
        node.classList.remove("topo-node-active");
      }
    });
  }

  _updateFloorplanStates() {
    if (!this._hass) return;
    const fpContainer = this.shadowRoot.getElementById("fp-svg-container");
    if (!fpContainer) return;
    const svg = fpContainer.querySelector("svg");
    if (!svg) return;

    const setElClass = (id, clsList, removePrefix = []) => {
      const el = svg.getElementById(id);
      if (!el) return;
      removePrefix.forEach((p) => {
        Array.from(el.classList).forEach((c) => {
          if (c.startsWith(p)) el.classList.remove(c);
        });
      });
      if (clsList) el.classList.add(clsList);
    };

    const setElText = (id, text) => {
      const el = svg.getElementById(id);
      if (el) el.textContent = text;
    };

    // 1. Bedside lamp (light.yeelink_bslamp2_2a87_light)
    const lampState = this._getState("light.yeelink_bslamp2_2a87_light", "off");
    setElClass(
      "light.yeelink_bslamp2_2a87_light",
      lampState === "on" ? "light-icon-on" : "light-icon-off",
      ["light-icon-"]
    );
    setElClass(
      "area.bedroom_northwest",
      lampState === "on" ? "room-light-on" : "room-light-off",
      ["room-light-"]
    );

    // 2. Temperature & Humidity
    const tempStr = this._getState("sensor.miaomiaoce_o2_f576_temperature", "NaN");
    const tempRaw = parseFloat(tempStr);
    if (!isNaN(tempRaw)) {
      setElText("sensor.miaomiaoce_o2_f576_temperature", `${tempRaw.toFixed(1)}°C`);
      const tCls =
        tempRaw < 21 ? "temp-cold" : tempRaw <= 25.5 ? "temp-comfortable" : tempRaw <= 28 ? "temp-warm" : "temp-hot";
      setElClass("sensor.miaomiaoce_o2_f576_temperature", tCls, ["temp-"]);
      const roomTempCls =
        tempRaw < 21 ? "room-temp-cold" : tempRaw <= 25.5 ? "room-temp-comfortable" : tempRaw <= 28 ? "room-temp-warm" : "room-temp-hot";
      setElClass("area.living_dining", roomTempCls, ["room-temp-"]);
    } else {
      setElText("sensor.miaomiaoce_o2_f576_temperature", "待機");
    }

    const humiStr = this._getState("sensor.miaomiaoce_o2_f576_relative_humidity", "NaN");
    const humiRaw = parseFloat(humiStr);
    if (!isNaN(humiRaw)) {
      setElText("sensor.miaomiaoce_o2_f576_relative_humidity", `${Math.round(humiRaw)}%`);
    } else {
      setElText("sensor.miaomiaoce_o2_f576_relative_humidity", "BLE");
    }

    // 2b. Router & Pi4 live status on SVG
    const devCount = this._getState("sensor.xiaomi_rn06_2724_connected_device_number", "9");
    setElText("svg-router-status", `31.1 • ${devCount}台`);

    const cpuTemp = this._getState("sensor.system_monitor_processor_temperature", "--");
    const cpuUse = this._getState("sensor.system_monitor_processor_use", "--");
    if (cpuTemp !== "--") {
      setElText("svg-pi4-status", `${Math.round(parseFloat(cpuTemp) || 0)}°C • ${cpuUse}%`);
    }

    // 3. C400 Camera & Motion
    const camSwitch = this._getState("switch.chuangmi_039c04_c643_switch_status", "on");
    setElClass(
      "camera.chuangmi_039c04_c643_camera_control",
      camSwitch === "on" ? "camera-on" : "camera-off",
      ["camera-"]
    );
    const fovEl = svg.getElementById("camera-fov-cone");
    if (fovEl) fovEl.style.opacity = camSwitch === "on" ? "1" : "0.15";

    const motionState = this._getState("switch.chuangmi_039c04_c643_motion_detection", "off");
    setElClass(
      "switch.chuangmi_039c04_c643_motion_detection",
      motionState === "on" ? "cam-motion-on" : "cam-motion-off",
      ["cam-motion-"]
    );

    // 4. Vacuum
    const vacState = this._getState("vacuum.rockrobo_v1_6536_robot_cleaner", "docked");
    const vacClsMap = {
      cleaning: "vacuum-cleaning",
      returning: "vacuum-returning",
      docked: "vacuum-docked",
      error: "vacuum-error"
    };
    setElClass("vacuum.rockrobo_v1_6536_robot_cleaner", vacClsMap[vacState] || "vacuum-docked", ["vacuum-"]);
    setElClass("area.storage", vacState === "cleaning" ? "room-vacuum-active" : "", ["room-vacuum-"]);

    const batRaw = parseFloat(this._getState("sensor.rockrobo_v1_6536_battery_level", "NaN"));
    setElText("sensor.rockrobo_v1_6536_battery_level", `🔋${isNaN(batRaw) ? "--" : Math.round(batRaw)}%`);

    // 5. Samsung M7
    const m7State1 = this._getState("media_player.monitor_samsung_m7_32", "off");
    const m7State2 = this._getState("media_player.monitor_samsung_m7_32_ls32am700ucxzw", "off");
    const m7Active = !["off", "standby", "unavailable", "unknown"].includes(m7State1) || m7State2 === "on";
    setElClass("media_player.monitor_samsung_m7_32", m7Active ? "media-on" : "media-off", ["media-"]);
    setElClass("area.study_room", m7Active ? "room-media-on" : "", ["room-media-"]);

    // 6. Sony 55X85K TV
    const tvState1 = this._getState("media_player.sony_km_55x85k_2", "off");
    const tvState2 = this._getState("media_player.sony_km_55x85k", "off");
    const tvActive = !["off", "standby", "unavailable", "unknown"].includes(tvState1) || tvState2 === "on";
    setElClass("media_player.sony_km_55x85k_2", tvActive ? "media-on" : "media-off", ["media-"]);

    // 7. HomePod Mini
    const hpState = this._getState("media_player.wo_shi_wo_shi", "off");
    const hpActive = !["off", "standby", "unavailable", "unknown"].includes(hpState);
    setElClass("media_player.wo_shi_wo_shi", hpActive ? "media-on" : "media-off", ["media-"]);

    // 8. Lollipop Baby Camera (Study)
    setElClass("camera.lollipop_baby_camera", "camera-on", ["camera-"]);
  }

  _updateTopologyBadges() {
    if (!this._hass) return;
    const setBadge = (id, html, cls = "") => {
      const el = this.shadowRoot.getElementById(id);
      if (!el) return;
      el.innerHTML = html;
      if (cls) el.className = `status-pill ${cls}`;
    };

    const devCount = this._getState("sensor.xiaomi_rn06_2724_connected_device_number", "9");
    setBadge("badge-xiaomi-router", `Hop 1: 192.168.31.1 • 連線 ${devCount} 台`, "pill-blue");

    const cpuTemp = this._getState("sensor.system_monitor_processor_temperature", "--");
    const cpuUse = this._getState("sensor.system_monitor_processor_use", "--");
    const memUse = this._getState("sensor.system_monitor_memory_usage", "--");
    setBadge("badge-pi4", `CPU ${cpuUse}% • ${cpuTemp}°C • RAM ${memUse}%`, "pill-emerald");

    const c400Power = this._getState("switch.chuangmi_039c04_c643_switch_status", "on");
    setBadge(
      "badge-c400",
      c400Power === "on" ? "🟢 go2rtc 直連 (串流中)" : "⚪ 鏡頭休眠中",
      c400Power === "on" ? "pill-emerald" : "pill-muted"
    );

    const hpState = this._getState("media_player.wo_shi_wo_shi", "off");
    setBadge(
      "badge-homepod",
      hpState === "playing" ? "🎵 播放中 • HomeKit 中樞" : "🟢 HomeKit 中樞",
      "pill-emerald"
    );

    const lampState = this._getState("light.yeelink_bslamp2_2a87_light", "off");
    setBadge(
      "badge-lamp",
      lampState === "on" ? "🟡 已開啟 (點擊調光)" : "⚪ 已關閉 (區網直連)",
      lampState === "on" ? "pill-amber" : "pill-emerald"
    );

    const m7State = this._getState("media_player.monitor_samsung_m7_32_ls32am700ucxzw", "off");
    setBadge(
      "badge-m7",
      m7State === "on" ? "🟢 螢幕開啟 • 區網直連" : "⚪ 待機 • 區網直連",
      m7State === "on" ? "pill-emerald" : "pill-muted"
    );

    const t = this._getState("sensor.miaomiaoce_o2_f576_temperature", "unavailable");
    const h = this._getState("sensor.miaomiaoce_o2_f576_relative_humidity", "unavailable");
    const b = this._getState("sensor.miaomiaoce_o2_f576_battery_level", "100");
    const bleText =
      t !== "unavailable" && t !== "unknown"
        ? `🌡️ ${t}°C • 💧 ${h}% • 🔋${b}%`
        : "藍牙連 Pi4 (廣播休眠)";
    setBadge("badge-ble", bleText, "pill-emerald");

    const tvState2 = this._getState("media_player.sony_km_55x85k_2", "off");
    const tvState1 = this._getState("media_player.sony_km_55x85k", "off");
    const tvOn = tvState2 === "playing" || tvState2 === "on" || tvState1 === "on";
    setBadge(
      "badge-sony-tv",
      tvOn ? `🟢 電視開啟 (${tvState2 === "playing" ? "播放中" : "已連線"})` : "⚪ 電視待機中",
      tvOn ? "pill-emerald" : "pill-amber"
    );

    setBadge("badge-lollipop", "🟢 go2rtc 直連 (串流中)", "pill-emerald");

    const vacBat = this._getState("sensor.rockrobo_v1_6536_battery_level", "100");
    const vacStatus = this._getState("vacuum.rockrobo_v1_6536_robot_cleaner", "docked");
    const vacMap = { cleaning: "清掃中", docked: "充電待命", returning: "回充中", idle: "待機", paused: "已暫停" };
    setBadge(
      "badge-vacuum",
      `🔋${Math.round(parseFloat(vacBat) || 100)}% • ${vacMap[vacStatus] || vacStatus} (雲端橋接)`,
      vacStatus === "cleaning" ? "pill-emerald" : "pill-blue"
    );
  }

  _openDeviceModal(devKey, autoOpenSsh = false) {
    const dev = (window.__IOT_DEVICE_CATALOG || DEVICE_CATALOG)[devKey];
    if (!dev) return;
    if (this._selectedDevice !== devKey) {
      this._webSshOpen = false;
    }
    if (autoOpenSsh) {
      this._webSshOpen = true;
    }
    this._selectedDevice = devKey;
    this._lastModalStateSig = this._getModalStateSig(devKey);
    const backdrop = this.shadowRoot.getElementById("device-modal-backdrop");
    if (backdrop) {
      backdrop.classList.add("open");
      this._renderModalContent(devKey);
    }
  }

  _closeDeviceModal() {
    this._selectedDevice = null;
    this._lastModalStateSig = "";
    this._webSshOpen = false;
    const backdrop = this.shadowRoot.getElementById("device-modal-backdrop");
    if (backdrop) {
      backdrop.classList.remove("open");
    }
    const bodyEl = this.shadowRoot.getElementById("modal-dynamic-body");
    if (bodyEl) {
      bodyEl.innerHTML = "";
    }
  }

  _renderModalContent(devKey) {
    const dev = (window.__IOT_DEVICE_CATALOG || DEVICE_CATALOG)[devKey];
    if (!dev) return;

    const titleEl = this.shadowRoot.getElementById("modal-title");
    const subEl = this.shadowRoot.getElementById("modal-subtitle");
    const bodyEl = this.shadowRoot.getElementById("modal-dynamic-body");
    if (!titleEl || !subEl || !bodyEl) return;

    titleEl.innerHTML = `<span style="font-size:22px">${dev.icon}</span> <span>${dev.name}</span>`;
    subEl.innerHTML = `
      <span class="meta-tag">📍 ${dev.room}</span>
      <span class="meta-tag mono">🌐 ${dev.ip}</span>
      <span class="meta-tag">🔗 ${dev.connType}</span>
      <span class="meta-tag">🏷️ ${dev.model}</span>
    `;

    let controlsHtml = "";

    if (devKey === "c400_camera") {
      const camPower = this._getState("switch.chuangmi_039c04_c643_switch_status", "on") === "on";
      const motion = this._getState("switch.chuangmi_039c04_c643_motion_detection", "on") === "on";
      const wdr = this._getState("switch.chuangmi_039c04_c643_wide_dynamic_range_mode", "off") === "on";
      const fullColor = this._getState("switch.chuangmi_039c04_c643_glimmer_full_color", "on") === "on";
      const watermark = this._getState("switch.chuangmi_039c04_c643_time_watermark", "on") === "on";
      const led = this._getState("light.chuangmi_039c04_c643_indicator_light", "off") === "on";
      const nightShot = this._getState("select.chuangmi_039c04_c643_night_shot", "Auto");
      const sdFreeKb = parseFloat(this._getState("sensor.chuangmi_039c04_c643_storage_free_space", "0"));
      const sdUsedKb = parseFloat(this._getState("sensor.chuangmi_039c04_c643_storage_used_space", "0"));
      const sdFreeText = !isNaN(sdFreeKb) && sdFreeKb > 0
        ? `${(sdFreeKb / 1024).toFixed(1)} MB (已用 ${(sdUsedKb / 1048576).toFixed(2)} GB)`
        : "--";
      const lastMsg = this._getState("sensor.mi_6253308962_message", "無近期事件");

      const eventBarHtml = `
        <span>🔔 最新事件：${lastMsg}</span>
        <span>💾 記憶卡剩餘：${sdFreeText}</span>
      `;
      const c400ControlsInner = `
        <div class="section-title">🎛️ 攝影機即時控制</div>
        <div class="control-grid">
          <button class="ctrl-btn ${camPower ? "active-emerald" : ""}" data-action="toggle-switch" data-entity="switch.chuangmi_039c04_c643_switch_status">
            <span>${camPower ? "👁️ 鏡頭運作中" : "🙈 鏡頭休眠遮蔽"}</span>
            <small>點擊切換電源</small>
          </button>
          <button class="ctrl-btn ${motion ? "active-amber" : ""}" data-action="toggle-switch" data-entity="switch.chuangmi_039c04_c643_motion_detection">
            <span>🚨 移動偵測：${motion ? "開啟" : "關閉"}</span>
            <small>畫面變動推播警報</small>
          </button>
          <button class="ctrl-btn ${fullColor ? "active-blue" : ""}" data-action="toggle-switch" data-entity="switch.chuangmi_039c04_c643_glimmer_full_color">
            <span>🌈 微光全彩：${fullColor ? "開啟" : "關閉"}</span>
            <small>低光源彩色畫面</small>
          </button>
          <button class="ctrl-btn ${wdr ? "active-blue" : ""}" data-action="toggle-switch" data-entity="switch.chuangmi_039c04_c643_wide_dynamic_range_mode">
            <span>☀️ WDR 寬動態：${wdr ? "開啟" : "關閉"}</span>
            <small>逆光清晰度增強</small>
          </button>
          <button class="ctrl-btn ${watermark ? "active-emerald" : ""}" data-action="toggle-switch" data-entity="switch.chuangmi_039c04_c643_time_watermark">
            <span>🕒 時間浮水印：${watermark ? "開啟" : "關閉"}</span>
            <small>畫面右上角時間戳</small>
          </button>
          <button class="ctrl-btn ${led ? "active-blue" : ""}" data-action="toggle-light" data-entity="light.chuangmi_039c04_c643_indicator_light">
            <span>💡 狀態指示燈：${led ? "開啟" : "關閉"}</span>
            <small>機身藍燈顯示</small>
          </button>
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <span style="font-size:12px;color:#cbd5e1;">🌙 夜視模式 (${nightShot})：</span>
          <button class="mini-pill-btn" data-action="select-option" data-entity="select.chuangmi_039c04_c643_night_shot" data-option="Auto">自動 (Auto)</button>
          <button class="mini-pill-btn" data-action="select-option" data-entity="select.chuangmi_039c04_c643_night_shot" data-option="On">常開 (On)</button>
          <button class="mini-pill-btn" data-action="select-option" data-entity="select.chuangmi_039c04_c643_night_shot" data-option="Off">關閉 (Off)</button>
        </div>
      `;

      this._updateModalBodyPreservingStream(bodyEl, eventBarHtml, c400ControlsInner, dev);
      return;
    }

    if (devKey === "pi4_hub") {
      const host = window.location.hostname || "192.168.31.212";
      const webSshUrl = `http://${host}:7681`;
      const nativeSshUri = `ssh://yuan@${host}`;
      const sshCmd = `ssh yuan@${host}`;
      const go2rtcUrl = `http://${host}:1984`;

      const existingSshWrap = bodyEl.querySelector("#pi4-ssh-wrap");
      const entityRowsHtml = dev.entities
        .map((eid) => {
          const st = this._getState(eid, "未連線");
          const fname = this._getAttr(eid, "friendly_name", eid);
          const unit = this._getAttr(eid, "unit_of_measurement", "");
          const formattedVal = this._formatEntityValue(eid, st, unit);
          const rowAction = eid.startsWith("button.") ? "press-btn" : "more-info";
          return `
            <div class="entity-row" data-action="${rowAction}" data-entity="${eid}">
              <div>
                <div class="ent-name">${fname}</div>
                <div class="ent-id">${eid}</div>
              </div>
              <div class="ent-val">
                <span>${formattedVal}</span>
                <span class="ent-arrow">↗</span>
              </div>
            </div>
          `;
        })
        .join("");

      if (existingSshWrap) {
        if (this._webSshOpen && existingSshWrap.style.display === "none") {
          existingSshWrap.style.display = "block";
          existingSshWrap.style.marginTop = "12px";
          const iframe = bodyEl.querySelector("#pi4-webssh-iframe");
          if (iframe && (iframe.src === "about:blank" || !iframe.src.includes(":7681"))) {
            iframe.src = webSshUrl;
          }
          const btnSpan = bodyEl.querySelector("#btn-toggle-webssh span");
          if (btnSpan) btnSpan.textContent = "🔽 收合網頁內嵌 SSH 終端機";
        }
        const entBox = bodyEl.querySelector("#pi4-entity-list");
        if (entBox) {
          entBox.innerHTML = entityRowsHtml;
          this._bindModalActions(entBox);
        }
        return;
      }

      bodyEl.innerHTML = `
        <div class="modal-desc">${dev.description}</div>
        <div id="pi4-ssh-controls" class="modal-section">
          <div class="section-title">💻 樹莓派 4 遠端維運與一鍵 SSH 終端機</div>
          <div class="control-grid">
            <button id="btn-toggle-webssh" class="ctrl-btn active-emerald" data-action="toggle-webssh">
              <span>${this._webSshOpen ? "🔽 收合網頁內嵌 SSH 終端機" : "💻 一鍵展開 Web SSH 終端機"}</span>
              <small>免安裝軟體 • 瀏覽器內直接輸入指令</small>
            </button>
            <a class="ctrl-btn active-blue" href="${webSshUrl}" target="_blank" style="text-decoration:none;">
              <span>🖥️ 全螢幕獨立視窗 Web SSH</span>
              <small class="mono">${webSshUrl}</small>
            </a>
            <a class="ctrl-btn active-amber" href="${nativeSshUri}" style="text-decoration:none;">
              <span>🚀 喚起電腦本機 SSH 程式</span>
              <small class="mono">${nativeSshUri}</small>
            </a>
            <button class="ctrl-btn" data-action="copy-ssh" data-cmd="${sshCmd}">
              <span id="copy-ssh-label">📋 複製 SSH 連線指令</span>
              <small class="mono">${sshCmd}</small>
            </button>
          </div>
          <div id="pi4-ssh-wrap" style="margin-top:${this._webSshOpen ? "12px" : "0"};display:${this._webSshOpen ? "block" : "none"};">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;font-size:12px;color:#34d399;">
              <span>🟢 已連線至 yuan@${host} (bash -l)</span>
              <a href="${webSshUrl}" target="_blank" style="color:#38bdf8;text-decoration:none;">↗ 在新分頁全螢幕開啟</a>
            </div>
            <iframe id="pi4-webssh-iframe" src="${this._webSshOpen ? webSshUrl : "about:blank"}" style="width:100%;height:340px;border:1px solid rgba(16,185,129,0.45);border-radius:10px;background:#0f172a;display:block;"></iframe>
          </div>
        </div>
        <div class="modal-section">
          <div class="section-title">📊 關聯實體即時狀態 (點擊任一項目開啟 HA 原生詳細控制與歷史圖表)</div>
          <div id="pi4-entity-list" class="entity-list">
            ${entityRowsHtml}
          </div>
        </div>
        <div id="pi4-footer-actions" style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px;flex-wrap:wrap;">
          <a class="action-link-btn" href="${go2rtcUrl}" target="_blank">🎬 go2rtc 串流後台 (:1984)</a>
          <a class="action-link-btn" href="/config/devices/device/${dev.deviceId}" target="_top">⚙️ 前往 HA 設備管理頁面</a>
          <button class="action-primary-btn" data-action="more-info" data-entity="${dev.primaryEntity}">
            🎛️ 開啟 HA 原生詳細控制視窗
          </button>
        </div>
      `;

      this._bindModalActions(bodyEl);
      return;
    }

    if (devKey === "ble_clock") {
      const temp = this._getState("sensor.miaomiaoce_o2_f576_temperature", "--");
      const humi = this._getState("sensor.miaomiaoce_o2_f576_relative_humidity", "--");
      const bat = this._getState("sensor.miaomiaoce_o2_f576_battery_level", "100");
      const rssi = this._getState("sensor.miaomiaoce_o2_f576_signal_strength", "-31");
      const tempNum = parseFloat(temp);
      const comfortText = isNaN(tempNum)
        ? "讀取中"
        : tempNum < 21
        ? "❄️ 微涼偏冷"
        : tempNum <= 26.5
        ? "🌿 舒適宜人"
        : "☀️ 溫暖偏熱";

      controlsHtml = `
        <div class="modal-section">
          <div class="section-title">🌡️ 客廳即時環境監測看板 (MiBeacon 藍牙直連)</div>
          <div class="control-grid">
            <div class="ctrl-btn active-amber" data-action="more-info" data-entity="sensor.miaomiaoce_o2_f576_temperature">
              <span>🌡️ 客廳溫度：${temp} °C</span>
              <small>體感狀態：${comfortText} (點擊看曲線)</small>
            </div>
            <div class="ctrl-btn active-blue" data-action="more-info" data-entity="sensor.miaomiaoce_o2_f576_relative_humidity">
              <span>💧 客廳濕度：${humi} %</span>
              <small>相對濕度即時廣播 (點擊看曲線)</small>
            </div>
            <div class="ctrl-btn active-emerald" data-action="more-info" data-entity="sensor.miaomiaoce_o2_f576_battery_level">
              <span>🔋 電池電量：${bat} %</span>
              <small>CR2032 雙電池 (2.962V 滿電)</small>
            </div>
            <div class="ctrl-btn" data-action="more-info" data-entity="sensor.miaomiaoce_o2_f576_signal_strength">
              <span>📶 藍牙訊號：${rssi} dBm</span>
              <small>Pi 4 (hci0) + 床頭燈藍牙網關</small>
            </div>
          </div>
        </div>
      `;
    } else if (devKey === "xiaomi_router") {
      const devCount = this._getState("sensor.xiaomi_rn06_2724_connected_device_number", "9");
      controlsHtml = `
        <div class="modal-section">
          <div class="section-title" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
            <span>🏷️ Xiaomi 路由器 BE3600 (RN06) 原廠硬體規格與認證資訊</span>
            <a class="mini-pill-btn" href="http://192.168.31.1" target="_blank" style="text-decoration:none;border-color:rgba(56,189,248,0.5);color:#38bdf8;">🌐 開啟路由器管理後台 (192.168.31.1 / miwifi.com) ↗</a>
          </div>
          <div class="control-grid" style="grid-template-columns:repeat(auto-fit,minmax(210px,1fr));margin-bottom:10px;">
            <div class="ctrl-btn active-blue" style="cursor:default;">
              <span>📦 產品名稱 / 型號</span>
              <small class="mono">Xiaomi 路由器 BE3600 (Model: RN06)</small>
            </div>
            <div class="ctrl-btn active-emerald" style="cursor:default;">
              <span>📶 網路名稱 (SSID)</span>
              <small class="mono">預設: m06_minet_2724 • 現用: MissH</small>
            </div>
            <div class="ctrl-btn" style="cursor:default;">
              <span>🔢 SN 序號 / 製造號碼</span>
              <small class="mono">SN: 60388/K4Y100066 • SKU: DVB4494US</small>
            </div>
            <div class="ctrl-btn" style="cursor:default;">
              <span>🖧 MAC 位址 / 電源規格</span>
              <small class="mono">MAC: 44:F7:70:70:27:24 • 12V ⎓ 1.5A</small>
            </div>
            <div class="ctrl-btn" style="cursor:default;">
              <span>📅 製造年份 / 管理位址</span>
              <small class="mono">2024年 • 192.168.31.1 (miwifi.com)</small>
            </div>
            <div class="ctrl-btn" style="cursor:default;">
              <span>🛡️ 安規與無線電認證</span>
              <small class="mono">NCC: CCAH24LP1190T2 • BSMI: D39245 • FCC: 2AIMRRN06</small>
            </div>
          </div>
        </div>
        <div class="modal-section">
          <div class="section-title">🛜 小米 WiFi 7 路由器 (192.168.31.1) 區網連線設備一覽 (目前 ${devCount} 台在線)</div>
          <div class="control-grid">
            <div class="ctrl-btn active-emerald" data-action="open-dev" data-target="pi4_hub">
              <span>🍓 樹莓派 4 中樞</span>
              <small class="mono">192.168.31.212 • 孝親房</small>
            </div>
            <div class="ctrl-btn active-blue" data-action="open-dev" data-target="c400_camera">
              <span>📹 小米攝影機 C400</span>
              <small class="mono">192.168.31.104 • 客廳</small>
            </div>
            <div class="ctrl-btn active-blue" data-action="open-dev" data-target="sony_tv">
              <span>📺 Sony 55X85K 電視</span>
              <small class="mono">192.168.31.15 • 客廳</small>
            </div>
            <div class="ctrl-btn active-amber" data-action="open-dev" data-target="bedside_lamp">
              <span>💡 米家床頭燈 2</span>
              <small class="mono">192.168.31.143 • 小孩房</small>
            </div>
            <div class="ctrl-btn active-emerald" data-action="open-dev" data-target="homepod_mini">
              <span>🔊 HomePod Mini</span>
              <small class="mono">192.168.31.229 • 小孩房</small>
            </div>
            <div class="ctrl-btn active-blue" data-action="open-dev" data-target="samsung_m7">
              <span>🖥️ Samsung M7 螢幕</span>
              <small class="mono">192.168.31.97 • 書房</small>
            </div>
            <div class="ctrl-btn active-emerald" data-action="open-dev" data-target="lollipop_camera">
              <span>🍼 Lollipop 嬰兒攝影機</span>
              <small class="mono">192.168.31.102 • 書房 (樺)</small>
            </div>
          </div>
        </div>
      `;
    } else if (devKey === "lollipop_camera") {
      const lollipopStreamUrl = getStreamUrl({ src: "lollipop", muted: true, controls: true });
      const entityRowsHtml = dev.entities
        .map((eid) => {
          const st = this._getState(eid, "未連線");
          const fname = this._getAttr(eid, "friendly_name", eid);
          const unit = this._getAttr(eid, "unit_of_measurement", "");
          const formattedVal = this._formatEntityValue(eid, st, unit);
          const rowAction = eid.startsWith("button.") ? "press-btn" : "more-info";
          return `
            <div class="entity-row" data-action="${rowAction}" data-entity="${eid}">
              <div>
                <div class="ent-name">${fname}</div>
                <div class="ent-id">${eid}</div>
              </div>
              <div class="ent-val">
                <span>${formattedVal}</span>
                <span class="ent-arrow">↗</span>
              </div>
            </div>
          `;
        })
        .join("");

      const existingLollipopIframe = bodyEl.querySelector("iframe.modal-lollipop-stream");
      if (existingLollipopIframe) {
        const entBox = bodyEl.querySelector("#lollipop-entity-list");
        if (entBox) {
          entBox.innerHTML = entityRowsHtml;
          this._bindModalActions(entBox);
        }
        return;
      }
      bodyEl.innerHTML = `
        <div class="modal-desc">${dev.description}</div>
        <div class="modal-section">
          <div class="section-title">🍼 Lollipop 720p HD 即時監控畫面 (go2rtc H.264 + AAC 零延遲直連 • 點擊右上角可開聲音)</div>
          <div id="modal-lollipop-stream-holder" class="stream-box">
            <iframe class="modal-lollipop-stream" src="${lollipopStreamUrl}" allow="autoplay; fullscreen" style="width:100%;aspect-ratio:16/9;border:0;border-radius:10px;background:#000;display:block;"></iframe>
          </div>
        </div>
        <div class="modal-section">
          <div class="section-title">👶 嬰兒守護與感測設定摘要 (Lollipop Smart Baby Monitor)</div>
          <div class="control-grid">
            <div class="ctrl-btn active-emerald" style="cursor:default;">
              <span>👶 守護寶寶資訊</span>
              <small>小名：樺 • 生日：2025-04-12</small>
            </div>
            <div class="ctrl-btn active-blue" style="cursor:default;">
              <span>😭 哭聲偵測 (Cry Detection)</span>
              <small>已啟用 • 靈敏度：中 (Level 1)</small>
            </div>
            <div class="ctrl-btn active-amber" style="cursor:default;">
              <span>🔊 環境噪音警報 (Noise Alert)</span>
              <small>已啟用 • 觸發閾值：80 dB</small>
            </div>
            <div class="ctrl-btn active-blue" data-action="open-dev" data-target="samsung_m7">
              <span>🖥️ 同房間設備：Samsung M7</span>
              <small>點擊切換至書房 32" 智慧螢幕控制</small>
            </div>
          </div>
        </div>
        <div class="modal-section">
          <div class="section-title">📊 關聯實體即時狀態 (點擊任一項目開啟 HA 原生詳細控制與歷史圖表)</div>
          <div id="lollipop-entity-list" class="entity-list">
            ${entityRowsHtml}
          </div>
        </div>
        <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px;flex-wrap:wrap;">
          <a class="action-link-btn" href="${getStreamUrl({ src: "lollipop" })}" target="_blank">🔗 全螢幕獨立開啟 Lollipop 串流</a>
          <a class="action-link-btn" href="/config/devices/device/${dev.deviceId}" target="_top">⚙️ 設備設定</a>
          <button class="action-primary-btn" data-action="more-info" data-entity="${dev.primaryEntity}">
            🎛️ HA 原生控制視窗
          </button>
        </div>
      `;
      this._bindModalActions(bodyEl);
      return;
    } else if (devKey === "wan_internet" || devKey === "cht_modem") {
      const tsIp = this._getState("sensor.system_monitor_ipv4_address_tailscale0", "100.113.142.12");
      const lanIp = this._getState("sensor.system_monitor_ipv4_address_wlan0", "192.168.31.212");
      controlsHtml = `
        <div class="modal-section">
          <div class="section-title">🖧 全屋雙層 NAT 路由與 Tailscale P2P 穿透架構</div>
          <div class="control-grid">
            <div class="ctrl-btn active-blue">
              <span>🌐 中華電信 HiNet 外網</span>
              <small class="mono">WAN IP: 61.230.62.23</small>
            </div>
            <div class="ctrl-btn active-amber">
              <span>📠 第一層：中華電信小烏龜</span>
              <small class="mono">Hop 2: 192.168.1.1 / 24</small>
            </div>
            <div class="ctrl-btn active-blue" data-action="open-dev" data-target="xiaomi_router">
              <span>🛜 第二層：小米 WiFi 7</span>
              <small class="mono">Hop 1: 192.168.31.1 / 24</small>
            </div>
            <div class="ctrl-btn active-emerald" data-action="open-dev" data-target="pi4_hub">
              <span>🍓 樹莓派 4 雙網卡中樞</span>
              <small class="mono">LAN: ${lanIp} / TS: ${tsIp}</small>
            </div>
          </div>
        </div>
      `;
    } else if (devKey === "bedside_lamp") {
      const isOn = this._getState("light.yeelink_bslamp2_2a87_light", "off") === "on";
      const briRaw = this._getAttr("light.yeelink_bslamp2_2a87_light", "brightness", 180);
      const briPct = Math.round(((parseFloat(briRaw) || 180) / 255) * 100);
      controlsHtml = `
        <div class="modal-section">
          <div class="section-title">💡 米家床頭燈 2 燈光與情境控制</div>
          <div class="control-grid">
            <button class="ctrl-btn ${isOn ? "active-amber" : ""}" data-action="toggle-light" data-entity="light.yeelink_bslamp2_2a87_light">
              <span>${isOn ? "💡 燈光已開啟 (點擊關閉)" : "🌑 燈光已關閉 (點擊開啟)"}</span>
              <small>目前亮度：${isOn ? briPct + "%" : "0%"}</small>
            </button>
            <button class="ctrl-btn" data-action="more-info" data-entity="light.yeelink_bslamp2_2a87_light">
              <span>🎨 開啟全彩調色盤</span>
              <small>調整 RGB 色彩與進階色溫</small>
            </button>
          </div>
          <div style="margin-top:12px;">
            <label style="font-size:12px;color:#cbd5e1;display:block;margin-bottom:6px;">🔆 亮度快速切換：</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="mini-pill-btn" data-action="light-bri" data-entity="light.yeelink_bslamp2_2a87_light" data-bri="15">🌙 夜燈 15%</button>
              <button class="mini-pill-btn" data-action="light-bri" data-entity="light.yeelink_bslamp2_2a87_light" data-bri="40">🛋️ 柔和 40%</button>
              <button class="mini-pill-btn" data-action="light-bri" data-entity="light.yeelink_bslamp2_2a87_light" data-bri="75">📖 閱讀 75%</button>
              <button class="mini-pill-btn" data-action="light-bri" data-entity="light.yeelink_bslamp2_2a87_light" data-bri="100">☀️ 全亮 100%</button>
            </div>
          </div>
          <div style="margin-top:12px;">
            <label style="font-size:12px;color:#cbd5e1;display:block;margin-bottom:6px;">🌈 情境色彩快捷：</label>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              <button class="mini-pill-btn" data-action="light-rgb" data-entity="light.yeelink_bslamp2_2a87_light" data-rgb="255,180,107">🕯️ 溫馨暖橘</button>
              <button class="mini-pill-btn" data-action="light-rgb" data-entity="light.yeelink_bslamp2_2a87_light" data-rgb="255,244,229">🤍 舒適暖白</button>
              <button class="mini-pill-btn" data-action="light-rgb" data-entity="light.yeelink_bslamp2_2a87_light" data-rgb="56,189,248">🌊 海洋冰藍</button>
              <button class="mini-pill-btn" data-action="light-rgb" data-entity="light.yeelink_bslamp2_2a87_light" data-rgb="192,132,252">💜 薰衣草紫</button>
            </div>
          </div>
        </div>
      `;
    } else if (devKey === "roborock_vacuum") {
      const vacState = this._getState("vacuum.rockrobo_v1_6536_robot_cleaner", "docked");
      const vacBat = this._getState("sensor.rockrobo_v1_6536_battery_level", "100");
      const vacCharge = this._getState("sensor.rockrobo_v1_6536_charging_state", "charging");
      controlsHtml = `
        <div class="modal-section">
          <div class="section-title">🤖 米家掃地機器人 遠端操控面板</div>
          <div style="display:flex;gap:10px;margin-bottom:12px;flex-wrap:wrap;">
            <span class="meta-tag">狀態：<b>${this._formatEntityValue("vacuum.rockrobo_v1_6536_robot_cleaner", vacState, "")}</b></span>
            <span class="meta-tag">電量：<b>🔋 ${Math.round(parseFloat(vacBat) || 100)}%</b></span>
            <span class="meta-tag">充電狀態：<b>${this._formatEntityValue("", vacCharge, "")}</b></span>
          </div>
          <div class="control-grid">
            <button class="ctrl-btn active-emerald" data-action="press-btn" data-entity="button.rockrobo_v1_6536_start_sweep" data-vac-cmd="start">
              <span>▶️ 開始清掃</span>
              <small>啟動全屋自動清掃</small>
            </button>
            <button class="ctrl-btn active-amber" data-action="press-btn" data-entity="button.rockrobo_v1_6536_stop_sweeping" data-vac-cmd="stop">
              <span>⏹️ 停止清掃</span>
              <small>暫停目前清掃任務</small>
            </button>
            <button class="ctrl-btn active-blue" data-action="press-btn" data-entity="button.rockrobo_v1_6536_start_charge" data-vac-cmd="return_to_base">
              <span>⚡ 返回充電座</span>
              <small>結束清掃並回充</small>
            </button>
            <button class="ctrl-btn" data-action="press-btn" data-entity="button.rockrobo_v1_6536_identify" data-vac-cmd="locate">
              <span>🔊 尋找機器人</span>
              <small>發出語音定位提示</small>
            </button>
          </div>
        </div>
      `;
    } else if (devKey === "sony_tv" || devKey === "samsung_m7" || devKey === "homepod_mini") {
      const mainEntity = dev.primaryEntity;
      const altEntity = devKey === "sony_tv" ? "media_player.sony_km_55x85k" : (devKey === "samsung_m7" ? "media_player.monitor_samsung_m7_32_ls32am700ucxzw" : mainEntity);
      const st = this._getState(mainEntity, "off");
      const stAlt = this._getState(altEntity, "off");
      controlsHtml = `
        <div class="modal-section">
          <div class="section-title">🎛️ 媒體播放與電源遙控 (${st} / ${stAlt})</div>
          <div class="control-grid">
            <button class="ctrl-btn active-blue" data-action="media-cmd" data-entity="${altEntity}" data-cmd="toggle">
              <span>⏻ 電源開關切換</span>
              <small>${this._getAttr(altEntity, "friendly_name", altEntity)}</small>
            </button>
            <button class="ctrl-btn active-emerald" data-action="media-cmd" data-entity="${mainEntity}" data-cmd="media_play_pause">
              <span>⏯️ 播放 / 暫停</span>
              <small>切換媒體播放狀態</small>
            </button>
            <button class="ctrl-btn" data-action="media-cmd" data-entity="${mainEntity}" data-cmd="volume_down">
              <span>🔉 音量調小 (-)</span>
              <small>Volume Down</small>
            </button>
            <button class="ctrl-btn" data-action="media-cmd" data-entity="${mainEntity}" data-cmd="volume_up">
              <span>🔊 音量調大 (+)</span>
              <small>Volume Up</small>
            </button>
            ${
              devKey === "samsung_m7"
                ? `<button class="ctrl-btn active-emerald" data-action="open-dev" data-target="lollipop_camera">
                    <span>🍼 書房 Lollipop 嬰兒攝影機</span>
                    <small>點擊開啟寶寶 (樺) 即時監控畫面</small>
                  </button>`
                : ""
            }
          </div>
        </div>
      `;
    }

    bodyEl.innerHTML = `
      <div class="modal-desc">${dev.description}</div>
      ${controlsHtml}
      <div class="modal-section">
        <div class="section-title">📊 關聯實體即時狀態 (點擊任一項目開啟 HA 原生詳細控制與歷史圖表)</div>
        <div class="entity-list">
          ${dev.entities
            .map((eid) => {
              const st = this._getState(eid, "未連線");
              const fname = this._getAttr(eid, "friendly_name", eid);
              const unit = this._getAttr(eid, "unit_of_measurement", "");
              const formattedVal = this._formatEntityValue(eid, st, unit);
              const rowAction = eid.startsWith("button.") ? "press-btn" : "more-info";
              return `
                <div class="entity-row" data-action="${rowAction}" data-entity="${eid}">
                  <div>
                    <div class="ent-name">${fname}</div>
                    <div class="ent-id">${eid}</div>
                  </div>
                  <div class="ent-val">
                    <span>${formattedVal}</span>
                    <span class="ent-arrow">↗</span>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px;">
        ${
          dev.deviceId
            ? `<a class="action-link-btn" href="/config/devices/device/${dev.deviceId}" target="_top">⚙️ 前往 HA 設備管理頁面</a>`
            : ""
        }
        <button class="action-primary-btn" data-action="more-info" data-entity="${dev.primaryEntity}">
          🎛️ 開啟 HA 原生詳細控制視窗
        </button>
      </div>
    `;

    this._bindModalActions(bodyEl);
  }

  _updateModalBodyPreservingStream(bodyEl, eventBarHtml, c400ControlsInner, dev) {
    const entityRowsHtml = dev.entities
      .map((eid) => {
        const st = this._getState(eid, "未連線");
        const fname = this._getAttr(eid, "friendly_name", eid);
        const unit = this._getAttr(eid, "unit_of_measurement", "");
        const formattedVal = this._formatEntityValue(eid, st, unit);
        const rowAction = eid.startsWith("button.") ? "press-btn" : "more-info";
        return `
          <div class="entity-row" data-action="${rowAction}" data-entity="${eid}">
            <div>
              <div class="ent-name">${fname}</div>
              <div class="ent-id">${eid}</div>
            </div>
            <div class="ent-val">
              <span>${formattedVal}</span>
              <span class="ent-arrow">↗</span>
            </div>
          </div>
        `;
      })
      .join("");

    // If the stream iframe is already mounted in the DOM, update ONLY the non-stream sections in-place
    // so the browser NEVER detaches or reloads the iframe!
    const existingIframe = bodyEl.querySelector("iframe.modal-c400-stream");
    if (existingIframe) {
      const evBar = bodyEl.querySelector("#c400-event-bar");
      const ctrlBox = bodyEl.querySelector("#c400-controls-box");
      const entBox = bodyEl.querySelector("#c400-entity-list");
      if (evBar) evBar.innerHTML = eventBarHtml;
      if (ctrlBox) {
        ctrlBox.innerHTML = c400ControlsInner;
        this._bindModalActions(ctrlBox);
      }
      if (entBox) {
        entBox.innerHTML = entityRowsHtml;
        this._bindModalActions(entBox);
      }
      return;
    }

    bodyEl.innerHTML = `
      <div class="modal-desc">${dev.description}</div>
      <div class="modal-section">
        <div class="section-title">📹 2.5K HD 即時監控畫面 (go2rtc MSE 低延遲直連)</div>
        <div id="modal-stream-holder" class="stream-box">
          <iframe class="modal-c400-stream" src="${getStreamUrl()}" allow="autoplay; fullscreen" style="width:100%;aspect-ratio:16/9;border:0;border-radius:10px;background:#000;display:block;"></iframe>
        </div>
        <div id="c400-event-bar" style="margin-top:8px;font-size:12px;color:#94a3b8;display:flex;justify-content:space-between;flex-wrap:wrap;gap:6px;">
          ${eventBarHtml}
        </div>
      </div>
      <div id="c400-controls-box" class="modal-section">
        ${c400ControlsInner}
      </div>
      <div class="modal-section">
        <div class="section-title">📊 關聯實體即時狀態 (點擊任一項目開啟 HA 原生詳細控制與歷史圖表)</div>
        <div id="c400-entity-list" class="entity-list">
          ${entityRowsHtml}
        </div>
      </div>
      <div id="c400-footer-actions" style="display:flex;justify-content:flex-end;gap:10px;margin-top:14px;">
        <a class="action-link-btn" href="${getStreamUrl()}" target="_blank">🔗 全螢幕獨立開啟 2.5K 串流</a>
        <a class="action-link-btn" href="/config/devices/device/${dev.deviceId}" target="_top">⚙️ 設備設定</a>
        <button class="action-primary-btn" data-action="more-info" data-entity="${dev.primaryEntity}">
          🎛️ HA 原生控制視窗
        </button>
      </div>
    `;

    const ctrlBox = bodyEl.querySelector("#c400-controls-box");
    const entBox = bodyEl.querySelector("#c400-entity-list");
    const footerBox = bodyEl.querySelector("#c400-footer-actions");
    if (ctrlBox) this._bindModalActions(ctrlBox);
    if (entBox) this._bindModalActions(entBox);
    if (footerBox) this._bindModalActions(footerBox);
  }

  _bindModalActions(container) {
    container.querySelectorAll("[data-action]").forEach((el) => {
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        const action = el.getAttribute("data-action");
        const entity = el.getAttribute("data-entity");

        if (action === "more-info") {
          this._fireMoreInfo(entity);
        } else if (action === "open-dev") {
          const targetDev = el.getAttribute("data-target");
          if (targetDev) this._openDeviceModal(targetDev);
        } else if (action === "toggle-webssh") {
          this._webSshOpen = !this._webSshOpen;
          const host = window.location.hostname || "192.168.31.212";
          const webSshUrl = `http://${host}:7681`;
          const wrap = this.shadowRoot.getElementById("pi4-ssh-wrap");
          const iframe = this.shadowRoot.getElementById("pi4-webssh-iframe");
          const btnSpan = el.querySelector("span");
          if (wrap && iframe) {
            if (this._webSshOpen) {
              wrap.style.display = "block";
              wrap.style.marginTop = "12px";
              if (iframe.src === "about:blank" || !iframe.src.includes(":7681")) {
                iframe.src = webSshUrl;
              }
              if (btnSpan) btnSpan.textContent = "🔽 收合網頁內嵌 SSH 終端機";
            } else {
              wrap.style.display = "none";
              wrap.style.marginTop = "0";
              if (btnSpan) btnSpan.textContent = "💻 一鍵展開 Web SSH 終端機";
            }
          }
        } else if (action === "copy-ssh") {
          const cmd = el.getAttribute("data-cmd") || "ssh yuan@192.168.31.212";
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(cmd);
          } else {
            const ta = document.createElement("textarea");
            ta.value = cmd;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
          }
          const lbl = el.querySelector("#copy-ssh-label") || el.querySelector("span");
          if (lbl) {
            const orig = lbl.textContent;
            lbl.textContent = "✅ 已複製 SSH 指令！";
            setTimeout(() => {
              lbl.textContent = orig;
            }, 2000);
          }
        } else if (action === "toggle-switch") {
          this._callService("switch", "toggle", { entity_id: entity });
        } else if (action === "toggle-light") {
          this._callService("light", "toggle", { entity_id: entity });
        } else if (action === "select-option") {
          const option = el.getAttribute("data-option");
          this._callService("select", "select_option", { entity_id: entity, option });
        } else if (action === "light-bri") {
          const bri = parseInt(el.getAttribute("data-bri"), 10);
          this._callService("light", "turn_on", { entity_id: entity, brightness_pct: bri });
        } else if (action === "light-rgb") {
          const rgb = el
            .getAttribute("data-rgb")
            .split(",")
            .map((n) => parseInt(n, 10));
          this._callService("light", "turn_on", { entity_id: entity, rgb_color: rgb });
        } else if (action === "press-btn") {
          this._callService("button", "press", { entity_id: entity });
          const vacCmd = el.getAttribute("data-vac-cmd");
          if (vacCmd) {
            this._callService("vacuum", vacCmd, { entity_id: "vacuum.rockrobo_v1_6536_robot_cleaner" });
          }
        } else if (action === "media-cmd") {
          const cmd = el.getAttribute("data-cmd");
          this._callService("media_player", cmd, { entity_id: entity });
        }
      });
    });
  }

  _setViewMode(mode) {
    this._viewMode = mode;
    const grid = this.shadowRoot.getElementById("main-split-grid");
    if (grid) {
      grid.setAttribute("data-mode", mode);
    }
    this.shadowRoot.querySelectorAll(".mode-btn[data-mode]").forEach((btn) => {
      btn.classList.toggle("active", btn.getAttribute("data-mode") === mode);
    });
  }

  _renderSkeleton() {
    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          box-sizing: border-box;
          width: 100%;
          min-height: calc(100vh - 56px);
          background: #090d16;
          color: #f8fafc;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans TC", sans-serif;
          padding: 14px 18px 24px;
        }
        * { box-sizing: border-box; }

        .top-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          background: linear-gradient(135deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.92));
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 16px;
          padding: 12px 18px;
          margin-bottom: 14px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.35);
        }
        .brand-title {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .brand-title h1 {
          margin: 0;
          font-size: 17px;
          font-weight: 700;
          letter-spacing: 0.3px;
          color: #f8fafc;
        }
        .brand-title p {
          margin: 2px 0 0;
          font-size: 12px;
          color: #94a3b8;
        }
        .toolbar-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .mode-btn {
          background: rgba(15, 23, 42, 0.8);
          color: #cbd5e1;
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 10px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .mode-btn:hover {
          border-color: #38bdf8;
          color: #fff;
        }
        .mode-btn.active {
          background: rgba(56, 189, 248, 0.18);
          border-color: #38bdf8;
          color: #38bdf8;
        }

        .split-grid {
          display: grid;
          grid-template-columns: minmax(420px, 1.12fr) minmax(420px, 1fr);
          gap: 16px;
          align-items: start;
        }
        .split-grid[data-mode="floorplan"] {
          grid-template-columns: 1fr;
        }
        .split-grid[data-mode="floorplan"] .topology-panel {
          display: none;
        }
        .split-grid[data-mode="topology"] {
          grid-template-columns: 1fr;
          max-width: 920px;
          margin: 0 auto;
        }
        .split-grid[data-mode="topology"] .floorplan-panel {
          display: none;
        }
        @media (max-width: 1100px) {
          .split-grid {
            grid-template-columns: 1fr;
          }
        }

        .panel-card {
          background: #111827;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 18px;
          padding: 16px;
          box-shadow: 0 12px 32px rgba(0, 0, 0, 0.4);
        }
        .panel-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 12px;
          margin-bottom: 12px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.14);
        }
        .panel-header h2 {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #f8fafc;
        }
        .panel-header p {
          margin: 3px 0 0;
          font-size: 11.5px;
          color: #94a3b8;
        }
        .badge-tag {
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 11.5px;
          font-weight: 600;
          background: rgba(59, 130, 246, 0.16);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.3);
          white-space: nowrap;
        }

        #fp-svg-container {
          width: 100%;
          display: flex;
          justify-content: center;
          align-items: center;
          background: #0f172a;
          border-radius: 14px;
          overflow: hidden;
          border: 1px solid rgba(148, 163, 184, 0.12);
        }
        #fp-svg-container svg {
          width: 100%;
          height: auto;
          max-height: calc(100vh - 185px);
          display: block;
        }

        .topo-stack {
          display: flex;
          flex-direction: column;
          gap: 10px;
          font-size: 12.5px;
        }
        .topo-row-2col {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        @media (max-width: 600px) {
          .topo-row-2col {
            grid-template-columns: 1fr;
          }
        }
        .topo-connector {
          display: flex;
          justify-content: space-around;
          align-items: center;
          color: #94a3b8;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          font-size: 11.5px;
          padding: 1px 0;
        }
        .topo-node {
          position: relative;
          padding: 11px 14px;
          border-radius: 13px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: rgba(15, 23, 42, 0.85);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          cursor: pointer;
          transition: transform 0.18s ease, border-color 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
        }
        .topo-node:hover, .topo-node.topo-node-active {
          transform: translateY(-2px);
          border-color: #38bdf8 !important;
          box-shadow: 0 6px 20px rgba(56, 189, 248, 0.22);
          background: rgba(30, 41, 59, 0.95);
        }
        .topo-node-left {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .topo-icon {
          font-size: 20px;
          line-height: 1;
          flex-shrink: 0;
        }
        .topo-title {
          font-weight: 600;
          color: #f8fafc;
          font-size: 13px;
          line-height: 1.3;
        }
        .topo-sub {
          color: #94a3b8;
          font-size: 11.5px;
          line-height: 1.35;
          margin-top: 2px;
        }
        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        }

        .node-purple {
          border-color: rgba(168, 85, 247, 0.45);
          background: rgba(168, 85, 247, 0.1);
        }
        .node-purple .topo-title { color: #c084fc; }

        .node-amber {
          border-color: rgba(245, 158, 11, 0.42);
          background: rgba(245, 158, 11, 0.06);
        }
        .node-amber .topo-title { color: #fbbf24; }

        .node-blue {
          border: 2px solid rgba(59, 130, 246, 0.55);
          background: rgba(59, 130, 246, 0.1);
        }
        .node-blue .topo-title { color: #60a5fa; }

        .node-emerald {
          border: 2px solid rgba(16, 185, 129, 0.55);
          background: rgba(16, 185, 129, 0.1);
        }
        .node-emerald .topo-title { color: #34d399; }

        .node-dashed {
          border-style: dashed;
          border-color: rgba(148, 163, 184, 0.35);
        }

        .status-pill {
          padding: 3px 8px;
          border-radius: 7px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          flex-shrink: 0;
        }
        .pill-amber {
          background: rgba(245, 158, 11, 0.18);
          color: #fbbf24;
        }
        .pill-blue {
          background: rgba(59, 130, 246, 0.2);
          color: #60a5fa;
        }
        .pill-emerald {
          background: rgba(16, 185, 129, 0.18);
          color: #34d399;
        }
        .pill-muted {
          background: rgba(148, 163, 184, 0.15);
          color: #94a3b8;
        }

        .modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(2, 6, 23, 0.78);
          backdrop-filter: blur(6px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.22s ease;
        }
        .modal-backdrop.open {
          opacity: 1;
          pointer-events: auto;
        }
        .modal-card {
          width: 100%;
          max-width: 680px;
          max-height: 90vh;
          overflow-y: auto;
          background: #0f172a;
          border: 1px solid rgba(56, 189, 248, 0.35);
          border-radius: 20px;
          padding: 20px 22px;
          box-shadow: 0 24px 60px rgba(0, 0, 0, 0.65);
          color: #f8fafc;
        }
        .modal-top {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 12px;
          padding-bottom: 12px;
          border-bottom: 1px solid rgba(148, 163, 184, 0.16);
        }
        .modal-title {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 18px;
          font-weight: 700;
        }
        .modal-subtitle {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 8px;
        }
        .meta-tag {
          font-size: 11.5px;
          padding: 3px 8px;
          border-radius: 6px;
          background: rgba(30, 41, 59, 0.9);
          border: 1px solid rgba(148, 163, 184, 0.2);
          color: #cbd5e1;
        }
        .close-btn {
          background: rgba(30, 41, 59, 0.9);
          border: 1px solid rgba(148, 163, 184, 0.25);
          color: #cbd5e1;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          font-size: 16px;
          cursor: pointer;
          flex-shrink: 0;
        }
        .close-btn:hover {
          background: rgba(239, 68, 68, 0.2);
          border-color: #ef4444;
          color: #fca5a5;
        }
        .modal-desc {
          margin: 12px 0;
          font-size: 13px;
          color: #94a3b8;
          line-height: 1.5;
        }
        .modal-section {
          background: rgba(17, 24, 39, 0.9);
          border: 1px solid rgba(148, 163, 184, 0.15);
          border-radius: 14px;
          padding: 14px;
          margin-top: 12px;
        }
        .section-title {
          font-size: 13px;
          font-weight: 700;
          color: #38bdf8;
          margin-bottom: 10px;
        }
        .control-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(185px, 1fr));
          gap: 8px;
        }
        .ctrl-btn {
          background: rgba(30, 41, 59, 0.85);
          border: 1px solid rgba(148, 163, 184, 0.22);
          border-radius: 10px;
          padding: 10px 12px;
          color: #f8fafc;
          text-align: left;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 3px;
          transition: all 0.18s ease;
        }
        .ctrl-btn span {
          font-size: 13px;
          font-weight: 600;
        }
        .ctrl-btn small {
          font-size: 11px;
          color: #94a3b8;
        }
        .ctrl-btn:hover {
          border-color: #38bdf8;
          transform: translateY(-1px);
        }
        .ctrl-btn.active-emerald {
          background: rgba(16, 185, 129, 0.16);
          border-color: rgba(16, 185, 129, 0.55);
        }
        .ctrl-btn.active-amber {
          background: rgba(245, 158, 11, 0.18);
          border-color: rgba(245, 158, 11, 0.6);
        }
        .ctrl-btn.active-blue {
          background: rgba(59, 130, 246, 0.18);
          border-color: rgba(59, 130, 246, 0.55);
        }
        .mini-pill-btn {
          background: rgba(30, 41, 59, 0.9);
          border: 1px solid rgba(148, 163, 184, 0.3);
          color: #e2e8f0;
          padding: 5px 10px;
          border-radius: 8px;
          font-size: 12px;
          cursor: pointer;
        }
        .mini-pill-btn:hover {
          border-color: #38bdf8;
          color: #38bdf8;
        }
        .entity-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .entity-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 11px;
          border-radius: 9px;
          background: rgba(30, 41, 59, 0.55);
          border: 1px solid rgba(148, 163, 184, 0.12);
          cursor: pointer;
          transition: background 0.15s ease, border-color 0.15s ease;
        }
        .entity-row:hover {
          background: rgba(56, 189, 248, 0.12);
          border-color: rgba(56, 189, 248, 0.4);
        }
        .ent-name {
          font-size: 12.5px;
          font-weight: 600;
          color: #e2e8f0;
        }
        .ent-id {
          font-size: 11px;
          color: #64748b;
          font-family: monospace;
        }
        .ent-val {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 12.5px;
          font-weight: 600;
          color: #38bdf8;
          font-family: monospace;
        }
        .ent-arrow {
          color: #94a3b8;
          font-size: 13px;
        }
        .action-primary-btn {
          background: #0284c7;
          color: #fff;
          border: 0;
          border-radius: 10px;
          padding: 9px 15px;
          font-size: 12.5px;
          font-weight: 600;
          cursor: pointer;
        }
        .action-primary-btn:hover {
          background: #0369a1;
        }
        .action-link-btn {
          background: rgba(30, 41, 59, 0.9);
          color: #cbd5e1;
          border: 1px solid rgba(148, 163, 184, 0.25);
          border-radius: 10px;
          padding: 8px 13px;
          font-size: 12.5px;
          text-decoration: none;
          font-weight: 600;
        }
        .action-link-btn:hover {
          border-color: #38bdf8;
          color: #fff;
        }
      </style>
      <style id="fp-dynamic-css"></style>

      <!-- Top Navigation & Quick Switcher -->
      <div class="top-bar">
        <div class="brand-title">
          <span style="font-size:24px">🏡</span>
          <div>
            <h1>御美學 · 全屋空間平面圖 ✕ 網路與 IoT 設備拓撲中控台</h1>
            <p>滑鼠移過設備可雙向定位房間位置 • 點擊平面圖或拓撲圖任一設備與房間即可查看資訊並直接控制</p>
          </div>
        </div>
        <div class="toolbar-actions">
          <button class="mode-btn active" data-mode="split">📐 並排雙視圖 (平面圖 + 拓撲圖)</button>
          <button class="mode-btn" data-mode="floorplan">🗺️ 放大平面圖</button>
          <button class="mode-btn" data-mode="topology">🖧 放大網路拓撲</button>
          <button id="top-btn-pi4-ssh" class="mode-btn" style="border-color:rgba(16,185,129,0.5);color:#34d399;background:rgba(16,185,129,0.12);">💻 一鍵 SSH 樹莓派 4</button>
        </div>
      </div>

      <!-- Main Split Layout -->
      <div id="main-split-grid" class="split-grid" data-mode="split">

        <!-- Left Column: Interactive Architectural Floorplan -->
        <div class="panel-card floorplan-panel">
          <div class="panel-header">
            <div>
              <h2>🗺️ 全屋互動式空間平面圖 (Interactive Floorplan)</h2>
              <p>點擊房內燈具、攝影機、電視、螢幕、音箱、路由器、掃地機或任一房間即可開啟控制面板</p>
            </div>
            <span class="badge-tag">即時狀態連動</span>
          </div>
          <div id="fp-svg-container">
            <div style="padding:60px;color:#64748b;font-size:13px;">載入平面圖中...</div>
          </div>
        </div>

        <!-- Right Column: Whole-Home Network Architecture & IoT Device Topology -->
        <div class="panel-card topology-panel">
          <div class="panel-header">
            <div>
              <h2>🏠 全屋網路架構與 IoT 設備拓撲圖</h2>
              <p>中華電信數據機 (192.168.1.1) ➔ 小米 WiFi 7 路由器 (192.168.31.1)</p>
            </div>
            <span class="badge-tag">Double NAT + Tailscale 穿透</span>
          </div>

          <div class="topo-stack">
            <!-- Tier 1: WAN / Internet & Tailscale -->
            <div class="topo-row-2col">
              <div class="topo-node" data-device="wan_internet">
                <div class="topo-node-left">
                  <span class="topo-icon">🌐</span>
                  <div>
                    <div class="topo-title">網際網路 (Internet / 5G)</div>
                    <div class="topo-sub">外網 IP: <span class="mono">61.230.62.23</span> (HiNet)</div>
                  </div>
                </div>
              </div>

              <div class="topo-node node-purple" data-device="iphone_tailscale">
                <div class="topo-node-left">
                  <span class="topo-icon">📱</span>
                  <div>
                    <div class="topo-title">iPhone (外出遠端連線)</div>
                    <div class="topo-sub">Tailscale: <span class="mono">100.78.218.46</span> (直通 Pi4)</div>
                  </div>
                </div>
              </div>
            </div>

            <div class="topo-connector">
              <span>│ 光纖/電話線 (WAN)</span>
              <span style="color:#c084fc">┆ Tailscale P2P 加密隧道 (穿過兩層 NAT)</span>
            </div>

            <!-- Tier 2: CHT Router -->
            <div class="topo-node node-amber" data-device="cht_modem">
              <div class="topo-node-left">
                <span class="topo-icon">📠</span>
                <div>
                  <div class="topo-title">第一層：中華電信路由器 / 數據機 (小烏龜)</div>
                  <div class="topo-sub">網段：<span class="mono">192.168.1.1 / 24</span> • 負責撥號上網與第一層 NAT</div>
                </div>
              </div>
              <span class="status-pill pill-amber mono">Hop 2: 192.168.1.1</span>
            </div>

            <div class="topo-connector">
              <span>↓ 實體網路線 (WAN 口接入)</span>
            </div>

            <!-- Tier 3: Xiaomi WiFi 7 Router -->
            <div class="topo-node node-blue" data-device="xiaomi_router">
              <div class="topo-node-left">
                <span class="topo-icon">🛜</span>
                <div>
                  <div class="topo-title">第二層：Xiaomi 路由器 BE3600 (RN06 / 孝親房)</div>
                  <div class="topo-sub">主網段：<span class="mono">192.168.31.1 / 24</span> • MAC: <span class="mono">44:F7:70:70:27:24</span> • SN: <span class="mono">60388/K4Y100066</span></div>
                </div>
              </div>
              <span id="badge-xiaomi-router" class="status-pill pill-blue mono">Hop 1: 192.168.31.1</span>
            </div>

            <div class="topo-connector">
              <span>├─── 2.4GHz / 5GHz Wi-Fi 區網互聯 (192.168.31.x) ───┐</span>
            </div>

            <!-- Tier 4: Core Hub Pi 4 -->
            <div class="topo-node node-emerald" data-device="pi4_hub">
              <div class="topo-node-left">
                <span class="topo-icon">🍓</span>
                <div>
                  <div class="topo-title">智慧家庭中樞：樹莓派 4 (Raspberry Pi 4)</div>
                  <div class="topo-sub">
                    區網 IP: <span class="mono">192.168.31.212</span> • Tailscale: <span class="mono">100.113.142.12</span><br>
                    服務：Home Assistant (8123) + go2rtc (8554) + WebSSH (7681) + 藍牙 (hci0)
                  </div>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-shrink:0;">
                <button id="topo-quick-ssh-btn" class="status-pill pill-blue" style="border:1px solid rgba(56,189,248,0.45);cursor:pointer;" title="點擊直接開啟 Web SSH 終端機">💻 一鍵 SSH</button>
                <span id="badge-pi4" class="status-pill pill-emerald">核心中控</span>
              </div>
            </div>

            <!-- Tier 5: 6 Smart Devices Grid -->
            <div class="topo-row-2col">
              <!-- C400 -->
              <div class="topo-node" data-device="c400_camera">
                <div class="topo-node-left">
                  <span class="topo-icon">📹</span>
                  <div>
                    <div class="topo-title">小米攝影機 C400 (客廳)</div>
                    <div class="topo-sub mono">192.168.31.104</div>
                  </div>
                </div>
                <span id="badge-c400" class="status-pill pill-emerald">go2rtc 直連</span>
              </div>

              <!-- HomePod Mini -->
              <div class="topo-node" data-device="homepod_mini">
                <div class="topo-node-left">
                  <span class="topo-icon">🔊</span>
                  <div>
                    <div class="topo-title">HomePod Mini (小孩房)</div>
                    <div class="topo-sub mono">192.168.31.229</div>
                  </div>
                </div>
                <span id="badge-homepod" class="status-pill pill-emerald">HomeKit 中樞</span>
              </div>

              <!-- Bedside Lamp 2 -->
              <div class="topo-node" data-device="bedside_lamp">
                <div class="topo-node-left">
                  <span class="topo-icon">💡</span>
                  <div>
                    <div class="topo-title">米家床頭燈 2 (小孩房)</div>
                    <div class="topo-sub mono">192.168.31.143</div>
                  </div>
                </div>
                <span id="badge-lamp" class="status-pill pill-emerald">區網直連</span>
              </div>

              <!-- Samsung M7 -->
              <div class="topo-node" data-device="samsung_m7">
                <div class="topo-node-left">
                  <span class="topo-icon">🖥️</span>
                  <div>
                    <div class="topo-title">Samsung M7 螢幕 (書房)</div>
                    <div class="topo-sub mono">192.168.31.97</div>
                  </div>
                </div>
                <span id="badge-m7" class="status-pill pill-emerald">區網直連</span>
              </div>

              <!-- BLE Clock -->
              <div class="topo-node" data-device="ble_clock">
                <div class="topo-node-left">
                  <span class="topo-icon">🌡️</span>
                  <div>
                    <div class="topo-title">小米溫濕度時鐘 (客廳)</div>
                    <div class="topo-sub mono">BLE: A4:C1:38:9D:F5:76</div>
                  </div>
                </div>
                <span id="badge-ble" class="status-pill pill-blue">藍牙連 Pi4</span>
              </div>

              <!-- Sony 55X85K TV -->
              <div class="topo-node" data-device="sony_tv">
                <div class="topo-node-left">
                  <span class="topo-icon">📺</span>
                  <div>
                    <div class="topo-title">Sony 55X85K 電視 (客廳)</div>
                    <div class="topo-sub mono">192.168.31.15 (BRAVIA 4K)</div>
                  </div>
                </div>
                <span id="badge-sony-tv" class="status-pill pill-emerald">已連動</span>
              </div>

              <!-- Lollipop Baby Camera -->
              <div class="topo-node" data-device="lollipop_camera">
                <div class="topo-node-left">
                  <span class="topo-icon">🍼</span>
                  <div>
                    <div class="topo-title">Lollipop 嬰兒攝影機 (書房 - 樺)</div>
                    <div class="topo-sub mono">192.168.31.102 (Port 554 RTSP)</div>
                  </div>
                </div>
                <span id="badge-lollipop" class="status-pill pill-emerald">go2rtc 直連</span>
              </div>
            </div>

            <!-- Separate Subnet: Vacuum -->
            <div class="topo-node node-dashed" data-device="roborock_vacuum">
              <div class="topo-node-left">
                <span class="topo-icon">🤖</span>
                <div>
                  <div class="topo-title">外部/跨網段設備：米家掃地機器人 1代 (儲藏室)</div>
                  <div class="topo-sub">連線於 <span class="mono">TP-Link_609C (192.168.0.111)</span> • 透過小米雲端與樹莓派同步</div>
                </div>
              </div>
              <span id="badge-vacuum" class="status-pill pill-blue">雲端橋接</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Unified Device Info & Control Modal -->
      <div id="device-modal-backdrop" class="modal-backdrop">
        <div class="modal-card" id="device-modal-card">
          <div class="modal-top">
            <div>
              <div id="modal-title" class="modal-title"></div>
              <div id="modal-subtitle" class="modal-subtitle"></div>
            </div>
            <button id="modal-close-btn" class="close-btn" title="關閉">✕</button>
          </div>
          <div id="modal-dynamic-body"></div>
        </div>
      </div>
    `;

    this.shadowRoot.querySelectorAll(".mode-btn[data-mode]").forEach((btn) => {
      btn.addEventListener("click", () => {
        this._setViewMode(btn.getAttribute("data-mode"));
      });
    });

    const topSshBtn = this.shadowRoot.getElementById("top-btn-pi4-ssh");
    if (topSshBtn) {
      topSshBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._openDeviceModal("pi4_hub", true);
      });
    }

    const topoQuickSshBtn = this.shadowRoot.getElementById("topo-quick-ssh-btn");
    if (topoQuickSshBtn) {
      topoQuickSshBtn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        this._openDeviceModal("pi4_hub", true);
      });
    }

    this.shadowRoot.querySelectorAll(".topo-node[data-device]").forEach((node) => {
      const devKey = node.getAttribute("data-device");
      node.addEventListener("mouseenter", () => this._setHoverDevice(devKey));
      node.addEventListener("mouseleave", () => this._setHoverDevice(null));
      node.addEventListener("click", () => this._openDeviceModal(devKey));
    });

    const backdrop = this.shadowRoot.getElementById("device-modal-backdrop");
    const closeBtn = this.shadowRoot.getElementById("modal-close-btn");
    const modalCard = this.shadowRoot.getElementById("device-modal-card");
    if (closeBtn) closeBtn.addEventListener("click", () => this._closeDeviceModal());
    if (backdrop) {
      backdrop.addEventListener("click", (ev) => {
        if (ev.target === backdrop) this._closeDeviceModal();
      });
    }
    if (modalCard) {
      modalCard.addEventListener("click", (ev) => ev.stopPropagation());
    }
  }
}

window.__IOT_DEVICE_CATALOG = DEVICE_CATALOG;

if (!customElements.get("iot-floorplan-topology-card")) {
  customElements.define("iot-floorplan-topology-card", IotFloorplanTopologyCard);
} else {
  const ExistingClass = customElements.get("iot-floorplan-topology-card");
  Object.getOwnPropertyNames(IotFloorplanTopologyCard.prototype).forEach((name) => {
    if (name !== "constructor") {
      ExistingClass.prototype[name] = IotFloorplanTopologyCard.prototype[name];
    }
  });
}
