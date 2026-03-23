# TITAN — 缺陷追蹤與修復流程

> T22 | 對應 Issue #33

---

## 1. 缺陷分類（Priority Matrix）

### 1.1 優先級定義

| 優先級 | 名稱 | 定義 | 修復時限 | 升級條件 |
|--------|------|------|----------|----------|
| **P0** | 緊急 | 系統崩潰、服務完全不可用、資料遺失、安全漏洞（RCE/SQLi/資料外洩） | **4 小時內** | 立即通知 PM + 技術主管 |
| **P1** | 高 | 核心功能無法使用（無 workaround）：無法登入、無法建立任務、文件無法儲存 | **24 小時內** | 超過 8 小時未解決通知 PM |
| **P2** | 中 | 功能異常但有 workaround，影響效率但不阻礙工作 | **3 個工作日內** | Sprint 結束前未解決提至下輪 |
| **P3** | 低 | 介面美觀問題、文字錯誤、非關鍵功能異常 | **下次 Sprint 內** | 三個 Sprint 未解決關閉為 WontFix |

### 1.2 嚴重度（Severity）vs 優先級（Priority）矩陣

```
                    影響範圍
                ┌──────────┬──────────┐
                │  廣（多人）│  窄（單人） │
  ────────────  ├──────────┼──────────┤
  高（系統崩潰） │    P0    │    P1    │
  ────────────  ├──────────┼──────────┤
  中（功能異常） │    P1    │    P2    │
  ────────────  ├──────────┼──────────┤
  低（介面問題） │    P2    │    P3    │
                └──────────┴──────────┘
```

---

## 2. 缺陷生命週期

```
發現缺陷
    │
    ▼
[NEW] 登錄 GitHub Issue
    │
    ▼
[TRIAGED] 分類與指派（QA Lead，1 小時內）
    │
    ├─── P0/P1 → [IN PROGRESS] 立即開始修復
    │
    └─── P2/P3 → [BACKLOG] 排入 Sprint
                        │
                        ▼
               [IN PROGRESS] 開始修復
    │
    ▼
[IN REVIEW] 程式碼審查（PR）
    │
    ▼
[FIXED] 合併至分支，等待驗證
    │
    ▼
[VERIFIED] QA 驗證通過
    │
    ├─── 通過 → [CLOSED] 關閉 Issue
    │
    └─── 未通過 → [REOPENED] 重新開啟
```

### 2.1 GitHub Issue 標籤規範

| 標籤 | 說明 |
|------|------|
| `bug` | 所有缺陷必須標記 |
| `priority:p0` / `p1` / `p2` / `p3` | 優先級 |
| `component:plane` / `outline` / `nginx` / `monitoring` | 影響元件 |
| `env:sit` / `uat` / `prod` | 發現環境 |
| `status:in-progress` | 修復進行中 |
| `regression` | 回歸測試缺陷 |

---

## 3. 缺陷登錄範本

```markdown
## 缺陷描述

**發現日期：** YYYY-MM-DD
**發現環境：** SIT / UAT / PROD
**發現人：**
**優先級：** P0 / P1 / P2 / P3
**影響元件：** Plane / Outline / Nginx / Monitoring

## 重現步驟

1. （步驟一）
2. （步驟二）
3. （步驟三）

## 預期行為

（描述正確應有的行為）

## 實際行為

（描述實際發生的異常）

## 截圖 / 日誌

（附上截圖或錯誤日誌）

## 環境資訊

- OS：
- 瀏覽器：
- TITAN 版本：
- Docker 映像版本：

## Workaround

（如有臨時解法，描述於此；無則填「無」）
```

---

## 4. 修復工作流程

### 4.1 P0 緊急修復流程

```bash
# 1. 建立緊急修復分支（從 main）
git checkout main && git pull origin main
git checkout -b hotfix/P0-<issue-number>-<brief-description>

# 2. 實作修復
# ... 修改程式碼 ...

# 3. 執行快速回歸測試
./scripts/sit-smoke-test.sh

# 4. 提交並推送
git add <changed-files>
git commit -m "fix(<component>): P0 <brief description>

Fixes #<issue-number>"
git push origin hotfix/P0-<issue-number>-<brief-description>

# 5. 立即建立 PR，指定緊急 Reviewer
gh pr create \
  --title "hotfix: P0 <description>" \
  --body "Fixes #<issue-number>

## 緊急說明
<影響範圍與修復說明>

## 測試結果
- [ ] 煙霧測試通過
- [ ] 缺陷已驗證修復" \
  --label "priority:p0,hotfix"
```

### 4.2 P1/P2 標準修復流程

```bash
# 1. 建立修復分支
git checkout main && git pull origin main
git checkout -b fix/<issue-number>-<brief-description>

# 2. 實作修復並撰寫回歸測試

# 3. 執行相關測試套件
./scripts/sit-smoke-test.sh

# 4. 提交
git add <changed-files>
git commit -m "fix(<component>): <brief description>

Fixes #<issue-number>"
git push origin fix/<issue-number>-<brief-description>

# 5. 建立 PR
gh pr create \
  --title "fix(<component>): <description>" \
  --body "Fixes #<issue-number>"
```

---

## 5. 回歸測試流程

### 5.1 回歸測試觸發條件

| 情境 | 回歸範圍 |
|------|----------|
| P0 修復後 | 全量煙霧測試 + 影響元件 SIT 測試案例 |
| P1 修復後 | 影響元件 SIT 測試案例 + 相關 TC |
| P2/P3 修復後 | 影響 TC（至少 3 個相關案例） |
| Sprint 結束前 | 全量 SIT 測試案例 |

### 5.2 回歸測試步驟

```
1. 確認修復已部署至 SIT 環境
   └── git log --oneline -5（確認版本）

2. 執行煙霧測試
   └── ./scripts/sit-smoke-test.sh

3. 執行對應 SIT 測試案例
   └── 依 tests/sit-test-plan.md 中的測試步驟手動執行
   └── 記錄結果於 GitHub Issue 留言

4. 執行回歸測試案例（從歷史缺陷中選取同類型 TC）

5. 更新 GitHub Issue 狀態
   └── 通過 → 標記 VERIFIED，關閉 Issue
   └── 未通過 → 留言說明，重新開啟 Issue
```

### 5.3 回歸測試記錄範本

```markdown
## 回歸測試結果

**測試日期：** YYYY-MM-DD
**測試人員：**
**修復版本：** commit SHA

| 測試案例 | 測試結果 | 備註 |
|----------|----------|------|
| TC-XXX   | PASS/FAIL |      |
| TC-YYY   | PASS/FAIL |      |

**結論：** 通過 / 未通過（原因：___）
```

---

## 6. 缺陷統計與報告

### 6.1 每日缺陷狀態追蹤（SIT/UAT 期間）

每日 17:00 由 QA Lead 更新缺陷統計表：

| 日期 | 新增 | 修復 | 驗證通過 | 未解決 P0 | 未解決 P1 | 未解決 P2 | 未解決 P3 |
|------|------|------|----------|-----------|-----------|-----------|-----------|
| | | | | | | | |

### 6.2 SIT 結束出場標準（基於缺陷狀態）

- [ ] 未解決 P0 缺陷：**0 個**
- [ ] 未解決 P1 缺陷：**0 個**
- [ ] 未解決 P2 缺陷：**≤ 2 個**（須有 workaround 且已記錄）
- [ ] 未解決 P3 缺陷：**≤ 5 個**（非核心功能）
- [ ] 回歸測試通過率：**100%**（針對 P0/P1 修復）

---

## 7. 缺陷升級機制

### 7.1 升級條件

| 情境 | 升級對象 | 升級管道 |
|------|----------|----------|
| P0 缺陷發現 | PM + 技術主管 + DevOps | 即時 Telegram/電話 |
| P1 超過 8 小時未修復 | PM | Telegram 訊息 |
| P2 超過 3 個工作日未排程 | Sprint Lead | 每日站會 |
| 缺陷影響 Go-Live 時程 | 專案負責人 | 正式會議 |

### 7.2 緊急聯絡人（填入實際資訊後使用）

| 角色 | 姓名 | Telegram / 電話 |
|------|------|-----------------|
| 技術主管 | ___ | ___ |
| DevOps 負責人 | ___ | ___ |
| QA Lead | ___ | ___ |
| PM | ___ | ___ |
