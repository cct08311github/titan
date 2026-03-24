# TITAN — 系統整合測試計畫（SIT）

> T21 | 對應 Issue #32

---

## 1. 測試範圍與目標

### 1.1 目標

驗證 TITAN 平台各子系統（Plane、Outline、Nginx、監控）在整合環境中能正確協同運作，完整覆蓋使用者的端對端操作流程。

### 1.2 測試範圍

| 子系統 | 服務 | 測試重點 |
|--------|------|----------|
| 認證閘道 | Nginx + Plane Auth | 登入、登出、Session 有效期 |
| 任務管理 | Plane | 建立/編輯/刪除任務、看板、Sprint |
| 文件協作 | Outline | 建立/編輯文件、全文搜尋 |
| 監控儀表板 | Prometheus + Grafana | 指標收集、告警觸發 |
| 資料整合 | Plane ↔ Outline | 跨服務連結、通知 |

### 1.3 測試範圍排除

- 效能壓力測試（由 T25 Go-Live 前另行規劃）
- 安全滲透測試（由資安團隊負責）
- 第三方 SSO 整合（Phase F 範疇）

---

## 2. 測試環境

| 項目 | 規格 |
|------|------|
| 環境名稱 | SIT（sit.titan.internal） |
| 部署方式 | Docker Compose（sit profile） |
| 資料庫 | PostgreSQL 15（獨立 SIT 實例） |
| 測試資料 | 預載種子資料（seed.sql） |
| 測試帳號 | 見 2.1 |

### 2.1 測試帳號清單

| 帳號 | 角色 | 用途 |
|------|------|------|
| sit-admin@titan.internal | 管理員 | 系統管理操作 |
| sit-pm@titan.internal | 專案經理 | 任務管理場景 |
| sit-dev@titan.internal | 開發人員 | 文件協作場景 |
| sit-viewer@titan.internal | 唯讀檢視 | 權限驗證場景 |

---

## 3. 端對端測試場景

### TC-001：使用者登入流程

**前提條件：** SIT 環境正常運行，測試帳號已建立

**測試步驟：**
1. 開啟瀏覽器，導航至 `https://sit.titan.internal`
2. 輸入 `sit-admin@titan.internal` 及密碼
3. 點擊「登入」按鈕
4. 驗證是否重定向至首頁 Dashboard
5. 確認 Session Cookie 存在且有效

**預期結果：**
- HTTP 200，重定向至 `/dashboard`
- 頁面顯示使用者姓名
- Cookie `titan_session` 存在，有效期 8 小時

**失敗判定：** HTTP 4xx/5xx、頁面錯誤、無 Cookie

---

### TC-002：任務建立（Plane）

**前提條件：** TC-001 通過，以 sit-pm@titan.internal 登入

**測試步驟：**
1. 進入 Plane 專案首頁
2. 點擊「New Issue」
3. 填入欄位：
   - 標題：`SIT-測試任務-001`
   - 描述：`此為 SIT 自動化測試建立之任務`
   - 優先級：High
   - 指派人：sit-dev@titan.internal
4. 點擊「Save」
5. 驗證任務出現在看板中
6. 驗證指派人收到通知

**預期結果：**
- 任務建立成功，ID 自動生成
- 看板顯示新任務卡片
- 任務狀態為「Todo」
- sit-dev@titan.internal 收到 Email/通知

**失敗判定：** 任務未儲存、看板未更新、通知未送達

---

### TC-003：文件建立與編輯（Outline）

**前提條件：** TC-001 通過，以 sit-dev@titan.internal 登入

**測試步驟：**
1. 切換至 Outline 服務（`https://sit.titan.internal/outline`）
2. 建立新集合：`SIT-測試文件集`
3. 在集合內新增文件：`SIT-功能規格書-001`
4. 輸入內容：至少 200 字的測試文字，包含標題、段落、程式碼區塊
5. 儲存文件
6. 重新整理頁面，確認內容持久化
7. 以 sit-pm@titan.internal 開啟同一文件，確認可見

**預期結果：**
- 文件建立成功，URL 含 slug
- 內容格式正確保留（Markdown 渲染）
- 跨帳號可見（依權限設定）
- 最後更新時間正確顯示

**失敗判定：** 文件未儲存、格式錯誤、跨帳號不可見

---

### TC-004：全文搜尋（Outline）

**前提條件：** TC-003 通過

**測試步驟：**
1. 使用搜尋框輸入 `SIT-功能規格書`
2. 確認搜尋結果顯示 TC-003 建立的文件
3. 輸入文件內容中的關鍵字（至少 3 個字）
4. 確認搜尋結果包含對應文件
5. 輸入不存在的字串，確認顯示「無結果」

**預期結果：**
- 搜尋回應時間 < 2 秒
- 結果正確匹配關鍵字
- 不存在字串回傳空結果（非錯誤）

**失敗判定：** 搜尋超時、結果錯誤、系統錯誤

---

### TC-005：監控儀表板（Grafana）

**前提條件：** SIT 環境運行 30 分鐘以上（有監控資料）

**測試步驟：**
1. 以管理員身份登入 Grafana（`https://sit.titan.internal/grafana`）
2. 進入 TITAN Overview Dashboard
3. 確認以下指標正常顯示：
   - CPU 使用率
   - 記憶體使用率
   - HTTP Request Rate
   - 資料庫連線數
4. 觸發告警：手動停止 Plane 服務 60 秒
5. 確認 Grafana 顯示告警紅色狀態
6. 重啟 Plane 服務，確認告警解除

**預期結果：**
- 所有指標正常顯示，資料延遲 < 30 秒
- 服務停止後 60 秒內觸發告警
- 服務恢復後告警自動解除

**失敗判定：** 指標無資料、告警未觸發、告警未解除

---

### TC-006：跨服務導覽（Plane ↔ Outline）

**前提條件：** TC-002、TC-003 通過

**測試步驟：**
1. 在 Plane 任務 `SIT-測試任務-001` 的描述中貼入 Outline 文件連結
2. 點擊連結，確認正確導覽至 Outline 文件
3. 在 Outline 文件中反向貼入 Plane 任務連結
4. 點擊連結，確認正確導覽至 Plane 任務

**預期結果：**
- 跨服務連結正確解析，不出現 404
- 目標頁面在 3 秒內載入完成
- 使用者 Session 在跨服務間保持（SSO 效果）

**失敗判定：** 連結 404、Session 遺失需重新登入

---

### TC-007：登出與 Session 終止

**前提條件：** TC-001 通過，任一帳號已登入

**測試步驟：**
1. 點擊右上角使用者頭像 → 「登出」
2. 確認重定向至登入頁面
3. 嘗試直接導覽至 `/dashboard`
4. 確認被重定向回登入頁面（Session 已失效）
5. 使用舊 Session Cookie 嘗試 API 呼叫

**預期結果：**
- 登出後 Cookie 清除
- 未登入狀態下所有受保護路由重定向至 `/login`
- 舊 Cookie 的 API 呼叫回傳 HTTP 401

**失敗判定：** Session 未清除、API 仍可存取

---

## 4. 測試執行規劃

### 4.1 執行時程

| 週次 | 活動 | 負責人 |
|------|------|--------|
| W1 Day 1 | SIT 環境驗證、種子資料載入 | DevOps |
| W1 Day 2-3 | TC-001 ~ TC-004 執行 | QA Lead |
| W1 Day 4-5 | TC-005 ~ TC-007 執行 | QA + DevOps |
| W2 Day 1-2 | 缺陷修復後回歸測試 | QA |
| W2 Day 3 | SIT 結果報告 | QA Lead |

### 4.2 入場條件（Entry Criteria）

- [ ] SIT 環境所有服務健康（`docker-compose ps` 全部 running）
- [ ] 種子資料已載入
- [ ] 測試帳號已建立且可登入
- [ ] 煙霧測試腳本（sit-smoke-test.sh）執行通過

### 4.3 出場條件（Exit Criteria）

- [ ] 所有測試案例執行完畢
- [ ] P0 缺陷：0 個未解決
- [ ] P1 缺陷：0 個未解決
- [ ] P2 缺陷：≤ 2 個（有 workaround）
- [ ] 測試報告已簽核

---

## 5. 缺陷管理

| 優先級 | 定義 | 修復時限 |
|--------|------|----------|
| P0 | 系統崩潰、資料遺失、安全漏洞 | 立即（4 小時內） |
| P1 | 核心功能無法使用 | 24 小時內 |
| P2 | 功能異常但有 workaround | 3 個工作日內 |
| P3 | 介面美觀、文字錯誤 | 下次 Sprint |

---

## 6. 測試結果記錄

| 測試案例 | 執行日期 | 執行人 | 結果 | 缺陷 ID |
|----------|----------|--------|------|---------|
| TC-001 | | | | |
| TC-002 | | | | |
| TC-003 | | | | |
| TC-004 | | | | |
| TC-005 | | | | |
| TC-006 | | | | |
| TC-007 | | | | |

**結果說明：** PASS / FAIL / BLOCKED / SKIP

---

## 7. 附件

- `scripts/sit-smoke-test.sh` — 自動化煙霧測試腳本
- `docs/defect-tracking.md` — 缺陷追蹤流程
- `templates/sit-test-report.md` — 測試報告範本
