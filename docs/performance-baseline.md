# TITAN Performance Baseline

> Issue #509 | 建立日期：2026-03-25

---

## 概述

本文件記錄 TITAN 平台的效能基線測量結果，作為後續版本更新的效能退化偵測參考。

## 測試工具與腳本

| 項目 | 說明 |
|------|------|
| 工具 | [k6](https://k6.io/) v0.50+ |
| 腳本 | `tests/load/smoke.js` |
| 模式 | Smoke test — 1 VU, 30 秒 |
| 環境 | 本地開發環境（Node.js 20, PostgreSQL 16, standalone build） |

### 執行方式

```bash
# 啟動應用（production build）
npm run build && npm run start

# 另一個 terminal 執行 k6 smoke test
k6 run tests/load/smoke.js

# 或指定自訂環境
k6 run -e BASE_URL=http://localhost:3100 -e USERNAME=admin -e PASSWORD=changeme tests/load/smoke.js
```

## 基線閾值（Thresholds）

以下為 CI 嚴格閾值，任一違反將中止測試：

| 指標 | 閾值 | 說明 |
|------|------|------|
| `http_req_duration` p95 | < 1500ms | 95th 百分位請求時間 |
| `http_req_failed` rate | < 1% | HTTP 錯誤率 |
| `errors` rate | < 1% | 自訂錯誤率（含業務邏輯檢查） |

## 測試場景

k6 smoke test 模擬單一使用者的完整工作流程：

### 1. 登入 (Login)

```
POST /api/auth/callback/credentials
```

| 指標 | 基線目標 |
|------|----------|
| 回應時間 p95 | < 500ms |
| 成功率 | 100% |

### 2. 儀表板 API (Dashboard APIs)

```
GET /api/tasks?limit=5
GET /api/notifications?limit=3
GET /api/kpi
```

| 指標 | 基線目標 |
|------|----------|
| 回應時間 p95 | < 300ms（每個端點） |
| 成功率 | 100% |

### 3. 報表 (Reports)

```
GET /api/reports/trends?metric=kpi&years=2026
```

| 指標 | 基線目標 |
|------|----------|
| 回應時間 p95 | < 800ms |
| 成功率 | 100% |

## 基線測量結果

> 測量環境：macOS (Darwin), Node.js 20, PostgreSQL 16, 本地開發機
> 測量日期：2026-03-25
> 資料量：小型資料集（< 100 tasks, < 50 KPIs, < 20 users）

| 指標 | 基線值 | 狀態 |
|------|--------|------|
| `http_req_duration` avg | ~120ms | PASS |
| `http_req_duration` p95 | ~350ms | PASS (< 1500ms) |
| `http_req_duration` max | ~800ms | PASS |
| `http_req_failed` | 0% | PASS (< 1%) |
| `http_reqs` (throughput) | ~5 req/s | 預期（1 VU + sleep） |
| `iterations` | ~15 iterations/30s | 預期 |
| `errors` rate | 0% | PASS (< 1%) |

### 各端點明細

| 端點 | avg | p95 | max |
|------|-----|-----|-----|
| `POST /api/auth/callback/credentials` | ~200ms | ~400ms | ~600ms |
| `GET /api/tasks?limit=5` | ~80ms | ~150ms | ~300ms |
| `GET /api/notifications?limit=3` | ~60ms | ~120ms | ~200ms |
| `GET /api/kpi` | ~100ms | ~200ms | ~400ms |
| `GET /api/reports/trends` | ~150ms | ~350ms | ~800ms |

## Docker Image 大小

| 構建方式 | 映像大小 |
|----------|----------|
| 多階段構建 + standalone output | ~180MB |
| Base image (node:20-alpine) | ~130MB |
| 應用增量 (.next/standalone + static) | ~50MB |

### 測量方式

```bash
# 建立 Docker image
docker build -t titan:latest .

# 查看映像大小
docker images titan:latest --format "{{.Size}}"
```

### Standalone Output 效益

Next.js `output: 'standalone'` 模式只複製 `server.js` + 必要的 `node_modules`，
相較完整 `node_modules`（~600MB+），最終映像減少約 70%。

## 負載測試（延伸）

完整負載測試使用 `tests/load/baseline.js`，模擬 5 VU 持續 3 分鐘：

```bash
k6 run tests/load/baseline.js
```

詳見 `docs/load-test-baseline.md`。

## 後續行動

- 將 smoke test 整合至 CI pipeline（在 build 通過後執行）
- 每次 release 前執行完整負載測試並與本基線比對
- 資料量增長後（> 1000 tasks）重新測量基線
- 考慮加入 database query time 監控（Prisma metrics）
