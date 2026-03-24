# TITAN — 切換作業手冊（Cutover Runbook）

> T24 | 對應 Issue #35

---

## 1. 概覽

本手冊定義 TITAN 平台從 UAT 環境切換至生產環境的完整操作程序，包含：
- 切換前檢查清單
- 逐步切換程序
- 驗證步驟
- 回滾計畫
- 緊急聯絡人

**預計切換時間窗口：** 週五 22:00 — 週六 02:00（4 小時）
**影響範圍：** 全體使用者
**風險等級：** 高（生產環境部署）

---

## 2. Go/No-Go 檢查清單

> **重要：** 所有項目必須通過，才可進入切換程序。任何 FAIL 須立即停止並上報。

### 2.1 技術準備

| # | 檢查項目 | 負責人 | 狀態 |
|---|----------|--------|------|
| T1 | UAT 所有 P0/P1 缺陷已修復並驗證 | QA Lead | [ ] PASS / [ ] FAIL |
| T2 | 生產環境 Docker Compose 配置已更新 | DevOps | [ ] PASS / [ ] FAIL |
| T3 | 生產環境 SSL 憑證有效（到期日 > 90 天） | DevOps | [ ] PASS / [ ] FAIL |
| T4 | 資料庫備份腳本已測試（含還原驗證） | DBA | [ ] PASS / [ ] FAIL |
| T5 | 監控告警規則已配置並測試 | DevOps | [ ] PASS / [ ] FAIL |
| T6 | 生產環境防火牆規則已確認 | DevOps | [ ] PASS / [ ] FAIL |
| T7 | DNS 記錄預先建立（TTL 降至 60 秒） | DevOps | [ ] PASS / [ ] FAIL |
| T8 | 備份機器/回滾映像已準備就緒 | DevOps | [ ] PASS / [ ] FAIL |

### 2.2 業務準備

| # | 檢查項目 | 負責人 | 狀態 |
|---|----------|--------|------|
| B1 | UAT 業務代表簽核通過 | PM | [ ] PASS / [ ] FAIL |
| B2 | 使用者培訓已完成（≥ 80% 使用者） | PM | [ ] PASS / [ ] FAIL |
| B3 | 使用者帳號已在生產環境建立 | IT Admin | [ ] PASS / [ ] FAIL |
| B4 | 切換通知已發送給所有使用者（>= 48 小時前） | PM | [ ] PASS / [ ] FAIL |
| B5 | 緊急聯絡電話已發布給所有相關人員 | PM | [ ] PASS / [ ] FAIL |

### 2.3 最終確認

| # | 確認項目 | 確認人 | 簽名 |
|---|----------|--------|------|
| C1 | Go/No-Go 決策會議完成 | PM + 技術主管 | ___ |
| C2 | 回滾決策門限已確認（見第 4 節） | 技術主管 | ___ |
| C3 | 值班人員均已確認到位 | DevOps Lead | ___ |

**最終決策：** [ ] GO  /  [ ] NO-GO

**決策時間：** ____________  **決策人：** ____________

---

## 3. 切換程序（逐步執行）

> **執行說明：**
> - 每個步驟完成後，在「完成」欄打勾
> - 若任何步驟失敗，立即呼叫待命人員並評估是否回滾
> - 所有操作均需第二人確認（Four-Eyes Principle）

### Phase 1：切換前準備（T-60 分鐘，21:00）

| 步驟 | 操作 | 執行人 | 完成 |
|------|------|--------|------|
| P1-1 | 發送切換開始通知至相關群組 | PM | [ ] |
| P1-2 | 確認所有值班人員上線 | DevOps Lead | [ ] |
| P1-3 | 執行生產環境完整備份 | DevOps | [ ] |
| P1-4 | 驗證備份完整性（抽樣還原測試） | DevOps | [ ] |
| P1-5 | 凍結 UAT 環境（禁止新變更） | DevOps | [ ] |
| P1-6 | 執行最後一次 UAT 煙霧測試 | QA | [ ] |

```bash
# P1-3：生產環境備份
BACKUP_TAG=$(date +%Y%m%d_%H%M%S)
docker exec titan-postgres pg_dumpall -U postgres \
  > /backup/titan-prod-${BACKUP_TAG}.sql
echo "備份完成：/backup/titan-prod-${BACKUP_TAG}.sql"

# P1-4：備份完整性驗證（抽樣）
wc -l /backup/titan-prod-${BACKUP_TAG}.sql
# 確認行數 > 1000（非空備份）
```

### Phase 2：服務停機（T-30 分鐘，21:30）

| 步驟 | 操作 | 執行人 | 完成 |
|------|------|--------|------|
| P2-1 | 發布維護頁面（Nginx 回傳 503） | DevOps | [ ] |
| P2-2 | 確認所有使用者已登出（等待 5 分鐘） | DevOps | [ ] |
| P2-3 | 停止生產環境應用服務（保留資料庫） | DevOps | [ ] |
| P2-4 | 確認服務已完全停止 | DevOps | [ ] |

```bash
# P2-1：啟用維護頁面
cp /etc/nginx/sites/maintenance.conf /etc/nginx/sites/enabled/
nginx -s reload

# P2-3：停止應用服務（保留 postgres 和 redis）
docker compose stop plane-web plane-api outline nginx

# P2-4：確認狀態
docker compose ps
```

### Phase 3：部署新版本（22:00 正式切換開始）

| 步驟 | 操作 | 執行人 | 完成 |
|------|------|--------|------|
| P3-1 | 拉取最新生產映像 | DevOps | [ ] |
| P3-2 | 執行資料庫 Migration | DBA | [ ] |
| P3-3 | 驗證 Migration 成功（無錯誤） | DBA | [ ] |
| P3-4 | 更新生產 `.env` 配置 | DevOps | [ ] |
| P3-5 | 啟動所有生產服務 | DevOps | [ ] |
| P3-6 | 等待所有服務健康（最多 10 分鐘） | DevOps | [ ] |

```bash
# P3-1：拉取映像
docker compose pull

# P3-2：執行 Migration
docker compose run --rm plane-api python manage.py migrate
docker compose run --rm outline node dist/server.js db:migrate

# P3-5：啟動服務
docker compose up -d

# P3-6：健康檢查
watch -n 5 'docker compose ps'
```

### Phase 4：生產驗證（23:00，目標 30 分鐘完成）

| 步驟 | 操作 | 執行人 | 完成 |
|------|------|--------|------|
| P4-1 | 執行生產環境煙霧測試 | QA | [ ] |
| P4-2 | 驗證管理員可登入 | QA | [ ] |
| P4-3 | 驗證核心功能（建立任務、建立文件） | QA | [ ] |
| P4-4 | 確認監控資料正常收集（Grafana） | DevOps | [ ] |
| P4-5 | 確認 Email 通知正常（發送測試 Email） | DevOps | [ ] |
| P4-6 | DNS 指向更新至生產 IP | DevOps | [ ] |
| P4-7 | 移除維護頁面，開放使用者訪問 | DevOps | [ ] |

```bash
# P4-1：生產環境煙霧測試
./scripts/sit-smoke-test.sh https://titan.your-company.internal

# P4-6：DNS 更新
# （更新 DNS A Record 至生產 IP，TTL = 60）
```

### Phase 5：切換後監控（00:00，持續 2 小時）

| 步驟 | 操作 | 執行人 | 完成 |
|------|------|--------|------|
| P5-1 | 每 15 分鐘執行一次煙霧測試 | DevOps | [ ] |
| P5-2 | 監控錯誤率（Grafana Dashboard） | DevOps | [ ] |
| P5-3 | 監控回應時間（P95 < 3 秒） | DevOps | [ ] |
| P5-4 | 02:00 發送切換完成通知 | PM | [ ] |

---

## 4. 回滾計畫

### 4.1 回滾觸發條件

以下任一條件成立，立即啟動回滾：

| 條件 | 門限 |
|------|------|
| 煙霧測試失敗 | 任何 P0/P1 測試案例 FAIL |
| 服務啟動失敗 | 10 分鐘內未達到健康狀態 |
| 資料庫 Migration 失敗 | 任何 Migration 錯誤 |
| 錯誤率異常 | 5xx 錯誤率 > 5%（持續 5 分鐘） |
| 生產驗證失敗 | P4 階段任何步驟 FAIL |
| 切換時間超限 | 超過 02:30 仍未完成 |

### 4.2 回滾決策流程

```
發現問題
    │
    ▼
技術主管評估（5 分鐘內）
    │
    ├── 可修復（< 30 分鐘） → 就地修復，繼續切換
    │
    └── 無法即時修復 → 啟動回滾
                            │
                            ▼
                       通知 PM（立即）
                            │
                            ▼
                       執行回滾程序
```

### 4.3 回滾步驟

| 步驟 | 操作 | 執行人 | 預計時間 |
|------|------|--------|----------|
| R1 | 啟用維護頁面 | DevOps | 1 分鐘 |
| R2 | 停止所有服務 | DevOps | 2 分鐘 |
| R3 | 還原資料庫備份（若有 Migration） | DBA | 10–20 分鐘 |
| R4 | 切換至前版映像 | DevOps | 5 分鐘 |
| R5 | 啟動舊版服務 | DevOps | 5 分鐘 |
| R6 | 執行煙霧測試（舊版） | QA | 10 分鐘 |
| R7 | 移除維護頁面 | DevOps | 1 分鐘 |
| R8 | 發送回滾通知 | PM | 2 分鐘 |

```bash
# R2：停止服務
docker compose down

# R4：切換至前版映像（已標記 tag: previous）
docker compose -f docker-compose.rollback.yml up -d

# R6：煙霧測試
./scripts/sit-smoke-test.sh https://titan.your-company.internal
```

**回滾完成後：** 安排事後分析會議，找出根因後重新規劃切換日期。

---

## 5. 緊急聯絡人與值班名單

| 角色 | 姓名 | 主要聯絡 | 備用聯絡 | 值班時段 |
|------|------|----------|----------|----------|
| DevOps Lead | ___ | ___ | ___ | 全程 |
| DBA | ___ | ___ | ___ | P3 階段 |
| QA Lead | ___ | ___ | ___ | P4 階段 |
| PM | ___ | ___ | ___ | 全程 |
| 技術主管 | ___ | ___ | ___ | 全程（決策） |
| IT Admin | ___ | ___ | ___ | P4 後 |

**升級順序：** DevOps Lead → 技術主管 → PM → 管理層

---

## 6. 切換記錄

| 欄位 | 記錄 |
|------|------|
| 切換日期 | |
| 切換開始時間 | |
| 服務恢復時間 | |
| 切換結束時間 | |
| 執行人 | |
| Go/No-Go 決策人 | |
| 是否執行回滾 | 是 / 否 |
| 遇到的問題 | |
| 後續行動項目 | |
