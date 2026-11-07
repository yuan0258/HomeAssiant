#!/usr/bin/env python3
"""
Helper script to bump the Lovelace resource cache version (?v=N) for c400-go2rtc.js
and reload Home Assistant core configuration via WebSocket API.
Run inside the homeassistant container:
  docker exec homeassistant python3 /config/deploy_dashboard.py <version_number>
"""
import asyncio
import json
import re
import sys
from datetime import datetime, timedelta, timezone
import jwt
import websockets

VERSION = sys.argv[1] if len(sys.argv) > 1 else "17"
TARGET_URL = f"/local/c400-go2rtc.js?v={VERSION}"

def update_config_yaml():
    path = "/config/configuration.yaml"
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    updated = re.sub(
        r"/local/c400-go2rtc\.js\?v=\d+",
        TARGET_URL,
        content,
    )
    with open(path, "w", encoding="utf-8") as f:
        f.write(updated)
    print(f"[OK] Updated {path} -> {TARGET_URL}")

def get_jwt_token():
    with open("/config/.storage/auth", "r", encoding="utf-8") as f:
        auth = json.load(f)
    for rt in auth["data"]["refresh_tokens"]:
        if rt.get("token_type") == "normal":
            now = datetime.now(timezone.utc)
            payload = {
                "iss": rt["id"],
                "iat": int(now.timestamp()),
                "exp": int((now + timedelta(minutes=10)).timestamp()),
            }
            return jwt.encode(payload, rt["jwt_key"], algorithm="HS256")
    raise RuntimeError("No valid refresh token found in /config/.storage/auth")

async def update_ha_ws():
    token = get_jwt_token()
    async with websockets.connect("ws://127.0.0.1:8123/api/websocket") as ws:
        await ws.recv()
        await ws.send(json.dumps({"type": "auth", "access_token": token}))
        res = json.loads(await ws.recv())
        assert res.get("type") == "auth_ok", f"Auth failed: {res}"

        await ws.send(json.dumps({"id": 1, "type": "lovelace/resources"}))
        r1 = json.loads(await ws.recv())
        for item in r1.get("result", []):
            if "c400-go2rtc.js" in item.get("url", ""):
                await ws.send(json.dumps({
                    "id": 2,
                    "type": "lovelace/resources/update",
                    "resource_id": item["id"],
                    "res_type": "module",
                    "url": TARGET_URL,
                }))
                print("[OK] Updated lovelace resource:", await ws.recv())

        await ws.send(json.dumps({
            "id": 3,
            "type": "call_service",
            "domain": "homeassistant",
            "service": "reload_core_config",
        }))
        print("[OK] Reloaded core config:", await ws.recv())

if __name__ == "__main__":
    update_config_yaml()
    asyncio.run(update_ha_ws())
