# Docker Socket 隔離策略

> Issue #183 — 安全強化：移除 Docker socket 直接掛載

**版本**: v1.0
**最後更新**: 2026-03-25
**適用範圍**: docker-compose.yml 中使用 Docker API 的服務

---

## 1. 背景

Homepage 與 Uptime Kuma 需要讀取 Docker 容器狀態以顯示儀表板資訊。
原方案直接掛載 `/var/run/docker.sock`，等同賦予容器完整的 Docker daemon 控制權，
一旦容器被入侵，攻擊者可藉由 Docker API 執行任意容器、讀取 volume 資料甚至逃逸至主機。

## 2. 解決方案：Docker Socket Proxy

採用 [tecnativa/docker-socket-proxy](https://github.com/Tecnativa/docker-socket-proxy) 作為中介：

```
Homepage / Uptime Kuma
        │
        ▼  (TCP :2375, 僅允許 GET)
docker-socket-proxy
        │
        ▼  (Unix socket)
/var/run/docker.sock
```

### 2.1 服務定義（docker-compose.yml）

```yaml
docker-socket-proxy:
  image: tecnativa/docker-socket-proxy:0.2
  container_name: titan-docker-proxy
  restart: unless-stopped
  environment:
    CONTAINERS: 1      # 允許查詢容器清單
    IMAGES: 0          # 禁止映像操作
    VOLUMES: 0         # 禁止 volume 操作
    NETWORKS: 0        # 禁止網路操作
    EXEC: 0            # 禁止 exec 操作
    POST: 0            # 禁止所有寫入（POST/PUT/DELETE）
  volumes:
    - /var/run/docker.sock:/var/run/docker.sock:ro
  networks:
    - titan-internal
```

### 2.2 客戶端設定

使用 Docker Socket Proxy 的服務需設定 `DOCKER_HOST`：

```yaml
homepage:
  environment:
    DOCKER_HOST: tcp://docker-socket-proxy:2375

uptime-kuma:
  environment:
    DOCKER_HOST: tcp://docker-socket-proxy:2375
```

原先的 `/var/run/docker.sock` 掛載已移除。

## 3. 安全效果

| 項目 | 修復前 | 修復後 |
|------|--------|--------|
| Docker API 存取 | 完整讀寫 | 僅 GET /containers |
| 容器逃逸風險 | 高（可建立特權容器） | 極低（無寫入能力） |
| 最小權限原則 | 不符合 | 符合 |

## 4. 驗證方式

```bash
# 確認 proxy 僅允許 GET
docker exec titan-docker-proxy wget -qO- http://localhost:2375/containers/json | head
# → 應回傳容器清單 JSON

# 確認寫入被拒絕
docker exec titan-docker-proxy wget -qO- --post-data='{}' http://localhost:2375/containers/create
# → 應回傳 403 Forbidden
```

## 5. 參考

- Issue #183
- [OWASP Docker Security — Socket Exposure](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
