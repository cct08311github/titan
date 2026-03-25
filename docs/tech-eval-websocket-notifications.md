# Tech Evaluation: WebSocket vs Polling vs SSE for Notifications

> Issue: #406
> Date: 2026-03-25
> Status: Evaluation
> **Decision: DEFERRED** — v1.0 維持 polling，5 人團隊規模不需 WebSocket。SSE 為 Phase 2 首選方案。

## 1. 背景

TITAN 有通知系統（`/api/notifications`），目前通知更新依賴使用者手動重新整理頁面。需要評估即時通知推送的技術選型。

### 現有通知 API
- `GET /api/notifications` — 取得通知列表
- `POST /api/notifications/[id]/read` — 標記已讀
- `POST /api/notifications/read-all` — 全部已讀
- `POST /api/notifications/generate` — 產生通知（內部呼叫）

## 2. 候選方案

### 2.1 短輪詢（Short Polling）

```
Client ──[GET /api/notifications?since=xxx]──> Server
         <── 200 { notifications: [...] } ──
         (sleep 30s)
         repeat
```

| 面向 | 說明 |
|------|------|
| 實作複雜度 | 最低 — 僅需 `setInterval` + fetch |
| 延遲 | 等於輪詢間隔（通常 15-30 秒） |
| Server 負載 | 每個連線用戶每分鐘 2-4 次 API 呼叫（即使無新通知） |
| 基礎設施 | 無需額外設施 |
| 電池/頻寬 | 較耗（持續請求） |
| 離線恢復 | 天然支援（下次輪詢即取回） |
| 銀行防火牆 | 完全相容（標準 HTTP） |

### 2.2 Server-Sent Events (SSE)

```
Client ──[GET /api/notifications/stream]──> Server
         <── event: notification ──
         <── data: {...} ──
         (保持連線，Server 有新事件時推送)
```

| 面向 | 說明 |
|------|------|
| 實作複雜度 | 中 — 需要 streaming response + EventSource API |
| 延遲 | 近即時（Server 推送） |
| Server 負載 | 每個用戶維持一個長連線；無新事件時無流量 |
| 基礎設施 | 需確保 nginx/reverse proxy 不 buffer streaming response |
| 電池/頻寬 | 較低（僅有資料時才傳輸） |
| 離線恢復 | EventSource 自動重連 + `Last-Event-ID` |
| 銀行防火牆 | 相容（標準 HTTP，單向） |
| 限制 | 單向（Server → Client）；每個瀏覽器有 6 個同域連線限制（HTTP/1.1） |

### 2.3 WebSocket

```
Client ──[WS upgrade /ws/notifications]──> Server
         <══ bidirectional ══>
```

| 面向 | 說明 |
|------|------|
| 實作複雜度 | 高 — 需要 WebSocket server（ws/Socket.IO）+ 連線管理 + 認證 |
| 延遲 | 即時（雙向） |
| Server 負載 | 每個用戶維持一個持久連線 + 心跳 |
| 基礎設施 | 需要獨立 WebSocket server 或 Next.js custom server；nginx 需設定 `Upgrade` |
| 電池/頻寬 | 最低（僅有資料時才傳輸 + 心跳） |
| 離線恢復 | 需自行實作重連 + 訊息佇列 |
| 銀行防火牆 | **可能有問題** — 部分企業防火牆/proxy 會攔截 WebSocket upgrade |
| 額外功能 | 雙向通訊（可用於即時協作等） |

### 2.4 Next.js 與 WebSocket 的限制

Next.js App Router **不原生支援 WebSocket**。實現 WebSocket 需要：
1. **Custom Server** — 改用 `server.ts` 啟動，喪失部分 Next.js 最佳化
2. **獨立 WebSocket 服務** — 另起 ws server（如 Socket.IO），前端連到不同 port
3. **第三方服務** — 使用 Pusher/Ably 等 managed WebSocket 服務（不適用銀行內網）

## 3. TITAN 通知場景分析

| 場景 | 頻率 | 即時性需求 |
|------|------|---------|
| 任務指派通知 | 低（每人每天 1-5 次） | 中（分鐘級即可） |
| 任務狀態變更 | 中（每人每天 5-15 次） | 低 |
| KPI 達標通知 | 低（每月數次） | 低 |
| 逾期提醒 | 低（cron 產生） | 低 |
| 系統公告 | 極低 | 低 |

**結論：TITAN 的通知場景頻率低、即時性需求中低。** WebSocket 的即時雙向能力明顯 overengineering。

## 4. 決策矩陣

| 面向 | 短輪詢 | SSE | WebSocket |
|------|--------|-----|-----------|
| 實作成本 | 低（0.5 天） | 中（1-2 天） | 高（3-5 天） |
| 維護成本 | 低 | 低 | 高（連線管理、重連、認證） |
| 延遲 | 15-30 秒 | 近即時 | 即時 |
| 銀行防火牆相容 | 完全 | 完全 | **可能有問題** |
| Next.js 相容 | 完全 | 完全（Route Handler streaming） | 需 custom server |
| Server 負載 | 中（空輪詢） | 低 | 低 |
| 擴展性 | 優（無狀態） | 中（長連線） | 中（持久連線） |

## 5. 建議

**推薦：短輪詢（Phase 1）→ SSE（Phase 2，視需求）**

### Phase 1 — 短輪詢（立即可做）

理由：
1. **實作最簡單** — 在現有 `useApi` hook 基礎上加 interval 即可
2. **銀行防火牆零風險** — 標準 HTTP GET
3. **與 TITAN 需求匹配** — 通知頻率低，30 秒延遲完全可接受
4. **無新基礎設施** — 不需要修改 nginx、Docker、Next.js config
5. **SWR 自動支援** — 如果實施 #392（SWR），`refreshInterval` 一個設定即搞定

```tsx
// 用 SWR 實現通知輪詢（30 秒間隔）
const { data: notifications } = useSWR("/api/notifications?unread=true", fetcher, {
  refreshInterval: 30_000,
  revalidateOnFocus: true,
});
```

或用現有 useApi + setInterval：
```tsx
const { data, refetch } = useApi<Notification[]>("/api/notifications?unread=true");
useEffect(() => {
  const timer = setInterval(refetch, 30_000);
  return () => clearInterval(timer);
}, [refetch]);
```

### Phase 2 — SSE（若短輪詢不足）

如果未來需要近即時通知（如即時協作功能），可升級至 SSE：
1. 新增 `GET /api/notifications/stream` — 使用 Next.js Route Handler 的 streaming response
2. 前端使用 `EventSource` API
3. 不需要額外基礎設施

**不推薦 WebSocket**，因為：
1. TITAN 通知場景不需要雙向通訊
2. 銀行防火牆可能攔截 WebSocket upgrade
3. Next.js App Router 不原生支援，需要 custom server 或獨立服務
4. 維護複雜度遠超收益

## 6. 風險

| 風險 | 緩解 |
|------|------|
| 短輪詢增加 API 負載 | 30 秒間隔 + 20 人 = 每分鐘 40 請求，DB 查詢可加 index + cache |
| 用戶覺得通知不夠即時 | 可減少間隔至 10 秒，或升級至 SSE |
| SSE 連線在 proxy 後超時 | nginx 設定 `proxy_read_timeout 300s` |
