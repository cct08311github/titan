# 技術評估：Performance Regression Testing

> Issue #381 — 缺少 performance regression testing

**版本**: v1.0
**最後更新**: 2026-03-25
**狀態**: 評估完成
**Decision**: **APPROVED** — 採用 k6 作為效能測試工具
**結論**: 採用 k6，已有 baseline 腳本，新增 smoke test 用於 CI

---

## 1. 工具比較

### 1.1 k6 vs Artillery

| 特性 | k6 | Artillery |
|------|-----|-----------|
| 語言 | JavaScript (ES6) | YAML + JS |
| 效能 | Go 引擎，極低資源消耗 | Node.js，記憶體較高 |
| 學習曲線 | 低（純 JS） | 低（YAML 宣告式） |
| CI 整合 | 內建 threshold 判定 pass/fail | 需額外設定 |
| 報告 | JSON, CSV, HTML, InfluxDB, Prometheus | JSON, Datadog |
| 進階功能 | 瀏覽器測試、gRPC、WebSocket | 分散式測試 |
| 社群 | Grafana Labs 維護，非常活躍 | 中等 |
| 封閉內網 | 完全離線可用（單一 binary） | 需 npm install |
| 授權 | AGPL-3.0（CLI 免費） | MPL-2.0 |

### 1.2 決定：k6

**理由**：
1. 已有 `tests/load/baseline.js` 腳本（團隊已熟悉）
2. 單一 binary 部署，適合封閉內網
3. 內建 threshold 機制，CI 整合最簡單
4. Grafana 生態系，可整合現有監控

---

## 2. 現有資源

| 檔案 | 說明 |
|------|------|
| `tests/load/baseline.js` | 完整負載基準測試（5 VUs, 3 分鐘） |
| `tests/load/load-test.sh` | 執行腳本 |
| `tests/load/smoke.js` | **新增** — CI 快速煙霧測試（1 VU, 30 秒） |

---

## 3. 測試層級

### 3.1 Smoke Test（CI 必跑）

- **目的**：每次 PR 確認無嚴重效能退化
- **配置**：1 VU, 30 秒, 嚴格 threshold
- **執行時間**：< 1 分鐘
- **觸發**：PR merge / push to main

### 3.2 Baseline Test（週期性）

- **目的**：建立效能基準線，追蹤長期趨勢
- **配置**：5 VUs, 3 分鐘暖機 → 穩態 → 降載
- **執行時間**：~ 3 分鐘
- **觸發**：每週排程 / release 前

### 3.3 Stress Test（手動）

- **目的**：找出系統瓶頸和崩潰點
- **配置**：逐步增加至 20-50 VUs
- **執行時間**：10-15 分鐘
- **觸發**：重大架構變更前

---

## 4. CI 整合（GitHub Actions）

```yaml
# .github/workflows/performance.yml
name: Performance Smoke Test
on:
  pull_request:
    branches: [main]

jobs:
  smoke-test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: titan_test
          POSTGRES_USER: titan
          POSTGRES_PASSWORD: test
        ports: ['5432:5432']
    steps:
      - uses: actions/checkout@v4
      - uses: grafana/setup-k6-action@v1
      - name: Start app
        run: |
          npm ci
          npx prisma migrate deploy
          npm run build
          npm start &
          sleep 5
      - name: Run smoke test
        run: k6 run tests/load/smoke.js
```

---

## 5. Threshold 基準

| 指標 | Smoke | Baseline | 說明 |
|------|-------|----------|------|
| http_req_duration p(95) | < 1500ms | < 2000ms | 95th percentile 回應時間 |
| http_req_failed | < 1% | < 5% | 錯誤率 |
| login_duration p(95) | < 2000ms | < 3000ms | 登入延遲 |

---

## 6. 效能退化偵測

k6 threshold 機制在指標超標時自動 fail（exit code 99），
CI pipeline 可直接判斷 pass/fail，無需額外腳本。

```javascript
export const options = {
  thresholds: {
    http_req_duration: [{ threshold: "p(95)<1500", abortOnFail: true }],
  },
};
```

退化時 CI 阻擋 merge，開發者需調查原因後修復。
