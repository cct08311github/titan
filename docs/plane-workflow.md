# Plane 工作流程設定指南

> 任務：T15 — Plane 工作流程建置
> 適用版本：Plane v0.23.x+
> 最後更新：2026-03-23

---

## 目錄

1. [工作流程概覽](#1-工作流程概覽)
2. [任務狀態（States）設定](#2-任務狀態states設定)
3. [標籤（Labels）設定](#3-標籤labels設定)
4. [優先順序（Priorities）說明](#4-優先順序priorities說明)
5. [Issue 範本（Templates）](#5-issue-範本templates)
6. [權限架構（Permissions）](#6-權限架構permissions)
7. [工作流程操作 SOP](#7-工作流程操作-sop)
8. [設定步驟（管理員操作）](#8-設定步驟管理員操作)

---

## 1. 工作流程概覽

TITAN 採用以下標準工作流程，適用於 IT 部門的需求開發、變更管理與問題追蹤：

```
Backlog → Todo → In Progress → Review → Done
                     ↕
                  On Hold（可中斷後回到 In Progress）
                     ↓
                 Cancelled（終止）
```

| 狀態          | 意義                              | 負責角色       |
|---------------|-----------------------------------|----------------|
| Backlog       | 已記錄但尚未排入計畫              | PM / 團隊      |
| Todo          | 已排入本次 Sprint，待認領         | PM             |
| In Progress   | 正在執行                          | 執行者         |
| Review        | 開發完成，待審查（PR / 測試）     | Reviewer       |
| Done          | 完全完成，符合 Definition of Done | PM 確認        |
| On Hold       | 暫停（等待外部相依或資源）        | PM             |
| Cancelled     | 取消執行                          | PM 確認        |

---

## 2. 任務狀態（States）設定

### 各狀態詳細定義

#### 2.1 Backlog

- **顏色代碼**：`#64748b`（灰）
- **進入條件**：任何新建立的 Issue 預設進入此狀態
- **離開條件**：PM 排入 Sprint 後移至 Todo
- **注意事項**：Backlog 中 Issue 應每兩週 Grooming 一次

#### 2.2 Todo

- **顏色代碼**：`#3b82f6`（藍）
- **進入條件**：Issue 已排入 Sprint，且有明確的 Assignee 與 Due Date
- **離開條件**：執行者開始作業時移至 In Progress
- **注意事項**：Todo 中 Issue 不得超過 Sprint 容量的 120%

#### 2.3 In Progress

- **顏色代碼**：`#f59e0b`（橙黃）
- **進入條件**：執行者確認認領並開始工作
- **離開條件**：
  - 完成開發 / 處置 → 移至 Review
  - 遇到阻礙 → 移至 On Hold
- **注意事項**：每個人同時處於 In Progress 的 Issue 不超過 3 個

#### 2.4 Review

- **顏色代碼**：`#8b5cf6`（紫）
- **進入條件**：執行者完成工作，PR 已開或變更已部署至測試環境
- **離開條件**：
  - 審查通過 → 移至 Done
  - 需要修改 → 退回 In Progress
- **注意事項**：Reviewer 應在 2 個工作日內完成審查

#### 2.5 Done

- **顏色代碼**：`#22c55e`（綠）
- **進入條件**：Review 通過，且已符合 Definition of Done（見下方）
- **Definition of Done 檢查清單**：
  - [ ] 功能完整實作或變更已部署
  - [ ] 相關測試通過
  - [ ] 文件已更新（Outline / docs/）
  - [ ] PR 已合併或 CR 已關閉
  - [ ] 相關人員已知會

#### 2.6 On Hold

- **顏色代碼**：`#94a3b8`（淺灰）
- **進入條件**：執行者無法繼續（等待第三方、資源不足、需求變更）
- **離開條件**：阻礙解除後回到 In Progress
- **注意事項**：On Hold 超過 5 個工作日須由 PM 重新評估

#### 2.7 Cancelled

- **顏色代碼**：`#ef4444`（紅）
- **進入條件**：需求取消或決定不執行
- **注意事項**：取消前需在 Issue 中留下取消原因

---

## 3. 標籤（Labels）設定

### 類型標籤（Type Labels）

| 標籤            | 顏色代碼   | 用途                          |
|-----------------|------------|-------------------------------|
| `type:feature`  | `#4a6cf7`  | 新功能開發                    |
| `type:bug`      | `#ef4444`  | 錯誤修復                      |
| `type:chore`    | `#94a3b8`  | 維護、重構、非功能性工作       |
| `type:docs`     | `#22c55e`  | 文件撰寫或更新                |
| `type:security` | `#f59e0b`  | 資安相關任務                  |
| `type:infra`    | `#8b5cf6`  | 基礎設施變更                  |

### 優先類標籤（Priority Labels）— 補充用

| 標籤            | 顏色代碼   | 用途                          |
|-----------------|------------|-------------------------------|
| `p0:critical`   | `#dc2626`  | 緊急事故，需立即處理           |
| `p1:high`       | `#f97316`  | 高優先，本 Sprint 內完成       |
| `p2:medium`     | `#eab308`  | 中優先，本季內完成             |
| `p3:low`        | `#84cc16`  | 低優先，可延後                |

### 元件標籤（Component Labels）

| 標籤              | 說明                 |
|-------------------|----------------------|
| `comp:plane`      | Plane 任務管理系統   |
| `comp:outline`    | Outline 知識庫       |
| `comp:gitea`      | Gitea 版本控制       |
| `comp:harbor`     | Harbor 映像倉庫      |
| `comp:keycloak`   | Keycloak 身份驗證    |
| `comp:monitoring` | 監控告警系統         |
| `comp:db`         | 資料庫層             |
| `comp:infra`      | 基礎設施（網路、DNS）|

### Sprint 標籤

| 標籤            | 說明               |
|-----------------|--------------------|
| `sprint:current`| 本期 Sprint        |
| `sprint:next`   | 下期 Sprint        |
| `blocked`       | 被外部因素阻擋     |
| `needs-review`  | 需要特定人員審查   |

---

## 4. 優先順序（Priorities）說明

Plane 內建優先順序，TITAN 使用定義如下：

| 優先順序 | 對應 SLA       | 處理方式                         |
|----------|---------------|----------------------------------|
| Urgent   | 4 小時內      | 立即中斷現有工作，P0 事故適用    |
| High     | 1 個工作日    | 本 Sprint 優先排入               |
| Medium   | 1 週          | 正常 Sprint 計畫排程             |
| Low      | 1 個月        | Backlog Grooming 時評估          |
| None     | 未定義        | 僅用於 Backlog 中待評估 Issue    |

---

## 5. Issue 範本（Templates）

範本檔案存放於 `templates/plane/`，在 Plane 中透過 **Project Settings → Templates** 匯入。

### 5.1 功能需求範本（feature-request.md）

```markdown
## 需求描述
（清楚說明需要新增的功能）

## 使用情境
（Who / When / Why）

## 驗收標準（Acceptance Criteria）
- [ ] AC1:
- [ ] AC2:
- [ ] AC3:

## 相關文件
（Outline 連結、設計稿、API 規格等）

## 技術備註
（架構影響、相依套件、注意事項）
```

### 5.2 錯誤回報範本（bug-report.md）

```markdown
## 問題描述
（一句話說明問題）

## 重現步驟
1.
2.
3.

## 預期行為

## 實際行為

## 環境資訊
- 環境：Production / Staging / Development
- 版本：
- 瀏覽器 / 客戶端：

## 截圖 / 日誌
（附上錯誤訊息、log 或截圖）

## 嚴重程度
- [ ] P0 — 服務中斷
- [ ] P1 — 功能無法使用
- [ ] P2 — 功能部分受損
- [ ] P3 — 外觀或輕微問題
```

### 5.3 變更請求範本（change-request.md）

```markdown
## 變更摘要

## 變更原因

## 影響範圍
- 影響服務：
- 影響使用者：
- 預計停機時間：

## 執行計畫
1.
2.
3.

## 回滾計畫

## 風險評估
- 風險等級：低 / 中 / 高
- 風險說明：

## 審核者
- [ ] 技術審核：@
- [ ] 主管核准：@
```

---

## 6. 權限架構（Permissions）

### 角色定義

| 角色      | Plane 對應角色 | 可執行操作                                |
|-----------|---------------|-------------------------------------------|
| 管理員    | Admin         | 所有操作，包括刪除 Project、管理成員       |
| PM        | Member        | 建立 / 修改 / 關閉 Issue，管理 Sprint      |
| 開發工程師| Member        | 建立 Issue，更新自己負責的 Issue 狀態      |
| 唯讀人員  | Viewer        | 檢視所有 Issue，新增留言，無法修改         |
| 外部協作  | Guest         | 僅限被指派的 Issue                        |

### 專案層級權限設定原則

1. **最小權限原則**：預設新成員為 Viewer，由 PM 提升
2. **敏感資訊隔離**：安全相關 Project 設為私有（Private），僅授予需要知道的成員
3. **Workspace 管理員**：僅 IT 主管與 DevOps 負責人擁有

### Workspace 設定建議

```
Workspace 名稱: TITAN
成員邀請方式:   僅限管理員邀請（Invite Only）
外部分享:       停用（Air-Gapped 環境）
匿名存取:       停用
SSO 整合:       啟用（Keycloak OIDC）
```

---

## 7. 工作流程操作 SOP

### Sprint 規劃流程

1. **Sprint 開始前 2 天（Sprint Planning）**
   - PM 從 Backlog 選取 Issue 移至 Todo
   - 設定 Due Date 與 Assignee
   - 確認每個 Issue 已有適當標籤與優先順序

2. **每日站立（Daily Standup）**
   - 各成員更新 Issue 狀態
   - On Hold 的 Issue 說明阻礙

3. **Sprint Review**
   - Done 的 Issue 由 PM 確認符合 DoD
   - 未完成的 Issue 移回 Backlog 或 Todo

4. **Sprint Retrospective**
   - 統計本 Sprint 完工率、平均 Cycle Time
   - 記錄於 Outline 的 Meeting Notes 空間

### 緊急事故（P0 Incident）流程

1. 立即建立 Issue，標籤 `p0:critical`、`type:bug`
2. 優先順序設為 Urgent
3. 指派 On-Call 工程師
4. 狀態直接設為 In Progress（跳過 Todo）
5. 解決後補填 Root Cause Analysis（RCA）

---

## 8. 設定步驟（管理員操作）

完整的設定參數請參考 `config/plane/workflow-config.yaml`。

### 快速設定清單

- [ ] 建立 Workspace：TITAN
- [ ] 啟用 Keycloak OIDC 整合
- [ ] 依 `workflow-config.yaml` 建立 States（7 個）
- [ ] 依 `workflow-config.yaml` 建立 Labels（Type + Priority + Component + Sprint = 20+ 個）
- [ ] 匯入 Templates（`templates/plane/` 中的 3 個範本）
- [ ] 設定成員角色
- [ ] 建立第一個 Sprint（Cycle）
- [ ] 設定 Webhook 至監控告警系統（可選）

---

## 參考資源

- [Plane 官方文件](https://docs.plane.so/)
- [Plane API 文件](https://developers.plane.so/)
- TITAN Plane 部署指南：`docs/plane-setup.md`
- 工作流程設定檔：`config/plane/workflow-config.yaml`
- Issue 範本：`templates/plane/`
