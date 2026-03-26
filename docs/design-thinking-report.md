# TITAN Design Thinking 深度報告：銀行 IT 維運工程師使用者旅程分析

> **人物誌**：林志偉，32 歲，台灣某商業銀行資訊處維運工程師，RHCE + OCP 認證，負責核心系統（Oracle + Linux）、AD、郵件、監控。團隊 5 人（1 主管陳經理 + 4 工程師）。

> **專家小組成員**：
> 1. **王教授**（HCI / UX 研究，台大資管所）
> 2. **李架構師**（15 年銀行 IT，前合庫資訊處副理）
> 3. **張顧問**（金管會資安稽核經驗，CISA/CISSP）
> 4. **陳 PM**（敏捷教練，金融業 PMO 經驗 10 年）
> 5. **林前端**（React/Next.js 資深開發，熟悉 TITAN codebase）
> 6. **黃測試**（QA Lead，銀行系統驗收測試專家）

---

## 場景 1：週一早上 08:35 — 系統巡檢

**日期**：2026 年 3 月 23 日（週一）08:35

志偉 08:30 打卡進辦公室，放下便當袋，開機。08:35 打開 Grafana 監控頁面（http://monitor.internal:3000），檢查核心系統（CBS）夜間批次狀態。他看到昨晚 02:30 的 EOD batch 有一條 warning：「Table ACCT_BALANCE rebuild index elapsed 47min（閾值 30min）」。他開啟 PuTTY 連上 db-prod-01，跑 `SELECT * FROM DBA_INDEXES WHERE STATUS='UNUSABLE';`，發現 ACCT_BALANCE_IDX03 狀態異常。他手動 `ALTER INDEX ACCT_BALANCE_IDX03 REBUILD ONLINE;`，等了 3 分鐘完成，再確認批次後續步驟全部 PASS。

08:52，他打開 TITAN `/dashboard`（EngineerDashboard 元件），看到「進行中任務：7」「逾期任務：1」「本週工時：0 / 40」。他知道該填工時了，但想說等下午再一起填。他點進 `/kanban`，把一張「監控系統升級評估」從 TODO 拖到 IN_PROGRESS（觸發 `PATCH /api/tasks/${taskId}` body: `{ status: "IN_PROGRESS" }`）。

**TITAN 缺口分析**：

1. **巡檢沒有結構化紀錄場所**：志偉的巡檢結果（index 狀態、batch warning）只存在 Grafana 截圖和他的腦海中。TITAN 的 `/kanban` 有 `TaskCategory.ADMIN` 但沒有「每日巡檢」這種重複性任務的自動產生機制。他不會為每天的巡檢手動建一張 Task。
2. **Dashboard 沒有基礎設施健康指標**：`DashboardPage` 裡的 `EngineerDashboard` 只顯示任務數和工時，完全沒有系統健康狀態。銀行 IT 人員最關心的是「系統現在有沒有問題」，不是「我有幾張 ticket」。
3. **工時延遲填報的惡性循環**：08:35 到 08:52 這 17 分鐘的巡檢工作，志偉不會馬上去 `/timesheet` 填，因為切換頁面、選任務、輸入數字的成本太高。TimesheetTimer 元件雖然有計時器功能（`isRunning` 欄位），但它需要事先選好 Task 才能啟動——巡檢不屬於任何特定 Task。

---

## 場景 2：週三下午 14:22 — P1 突發事件

**日期**：2026 年 3 月 25 日（週三）14:22

志偉正在看 `/kanban` 上「核心系統 OS 升級 SIT」任務的 SubTask 清單時，手機響了——營業部王副理：「網銀轉帳一直轉圈圈，客戶在臨櫃等。」志偉心跳加速，立刻開 PuTTY：
- 14:23 — `tail -f /app/cbs/log/transfer.log` 看到大量 `ORA-01555: snapshot too old`
- 14:25 — `SELECT USED_UBLK FROM V$ROLLSTAT;` 確認 undo tablespace 使用率 98%
- 14:28 — 通知陳經理，同時打電話給 DBA 廠商
- 14:35 — 執行 `ALTER TABLESPACE UNDOTBS1 ADD DATAFILE '/oracle/undotbs02.dbf' SIZE 10G;`
- 14:42 — 重新測試轉帳交易，確認恢復
- 14:45 — 回報營業部「已修復」

14:50，志偉想在 TITAN 記錄這件事。他打開 `/kanban`，點「+ 新增任務」（觸發 `prompt("任務標題：")`），輸入「P1-核心系統 ORA-01555 undo tablespace 不足」，系統建立一張 Task（`POST /api/tasks`，body: `{ title, status: "BACKLOG", priority: "P2", category: "PLANNED" }`）。

**志偉的挫折**：
1. 他剛建的任務 priority 預設是 P2，但這是 P1 事件，他要再點進去改。更糟糕的是 category 預設是 `PLANNED`，他要改成 `INCIDENT`。這要點開 TaskDetailModal、找到欄位、改兩次、存檔。
2. Task schema 裡有 `dueDate`、`estimatedHours` 但**沒有 `slaResponseTime`（SLA 回應時間）、`incidentStartTime`（事件發生時間）、`incidentEndTime`（事件結束時間）、`rootCause`（根因分析）、`impact`（影響範圍）** 這些 ITSM 事件管理必備欄位。
3. 陳經理會問「這個事件幾點發生、幾點復原、MTTR 是多少」——TITAN 完全沒有辦法回答，因為 Task model 的 `startDate` / `dueDate` 是「計畫」時間，不是「事件」時間。

**TITAN 缺口**：`Task` model（schema.prisma L260-300）缺乏 Incident 專用欄位。`TaskCategory.INCIDENT` 只是一個標籤，沒有觸發任何不同的 UI 流程或欄位集合。

---

## 場景 3：週三下午 16:00 — 變更管理會議後執行變更

**日期**：2026 年 3 月 25 日（週三）16:00

陳經理在 Teams 會議室主持 CAB（Change Advisory Board）會議。議程第三項是志偉提的「核心系統 Oracle 19c → 19.22 patch」。志偉報告：影響範圍（CBS 主機 2 台）、回滾方案（有 RMAN full backup）、預計停機時間（週六 22:00-02:00）。陳經理核准。

16:15 會議結束，志偉回到位子上，要在 TITAN 記錄這個變更。他打開 `/kanban`，找到「核心系統 Oracle 19.22 patch」這張 Task，點進 TaskDetailModal。他在 description（Markdown 欄位）裡寫：

```
## 變更紀錄
- 變更編號：CHG-2026-0325-01
- 影響系統：CBS (db-prod-01, db-prod-02)
- 停機窗口：2026/03/28 22:00 - 2026/03/29 02:00
- 回滾方案：RMAN full backup (2026/03/28 20:00 完成)
- CAB 核准：陳經理 2026/03/25 16:10
```

**志偉的挫折**：
1. 變更管理在銀行有嚴格的流程（提案→審核→核准→執行→驗證），但 TITAN 的 `TaskStatus` 只有 BACKLOG/TODO/IN_PROGRESS/REVIEW/DONE 五個狀態，沒有「待核准」「已核准待執行」「執行中」「驗證中」「關閉」這種變更管理狀態。
2. `ApprovalRequest` model（schema.prisma L716-738）支援 `TASK_STATUS_CHANGE` / `DELIVERABLE_ACCEPTANCE` / `PLAN_MODIFICATION` 三種類型，但沒有 `CHANGE_REQUEST`（變更請求）。他只能把核准資訊寫在 description 的 Markdown 裡，不是結構化資料。
3. 沒有排程停機窗口的概念——他需要在某個地方設定「03/28 22:00 執行」並在那天收到提醒。Notification model 有 `TASK_DUE_SOON`，但那是基於 `dueDate`，不是「排程執行時間」。

---

## 場景 4：週二上午整天 — 系統升級 SIT 測試

**日期**：2026 年 3 月 24 日（週二）09:00–17:30

今天整天配合廠商做核心系統 OS 升級的 SIT 測試。志偉 09:00 開了 Teams 會議和廠商連線。他打開 `/kanban` 找到「核心系統 OS 升級 SIT」任務，點進去看 SubTask 清單：
- [ ] 測試案例 TC-001：系統啟動驗證
- [ ] 測試案例 TC-002：批次執行驗證
- [ ] 測試案例 TC-003：備份還原驗證
- [x] 環境準備（上週完成）

09:15–10:30 跑 TC-001，志偉在 PuTTY 上執行 `systemctl status cbs-app` 確認服務正常啟動。PASS。他在 TITAN SubTask 上勾選 TC-001 的 checkbox（`PATCH /api/tasks/${taskId}/subtasks/${id}` body: `{ done: true }`）。

10:45–12:00 跑 TC-002，批次跑到一半出錯——新版 OS 的 `ulimit` 設定不同，導致 Oracle process limit 不足。志偉和廠商花了 30 分鐘排查，修改 `/etc/security/limits.conf`，重跑批次。12:00 PASS。

13:30–15:00 跑 TC-003，備份還原驗證。志偉執行 RMAN restore 到測試環境，驗證資料完整性。PASS。

15:00–16:30 志偉要寫 SIT 測試報告。他在 Task 的 description 裡寫測試結果……但這不對，測試報告應該是一份獨立的交付物。

**TITAN 缺口**：
1. **SubTask 太簡陋**：`SubTask` model（schema.prisma L302-316）只有 `title`、`done`、`order`、`assigneeId`、`dueDate`。沒有「測試結果」「附件」「備註」欄位。志偉沒辦法在 SubTask 上記錄 TC-002 遇到的問題和解決方案。
2. **Deliverable 沒有附件上傳**：`Deliverable` model 有 `attachmentUrl` 欄位，但 TITAN 前端（TaskDetailModal → task-deliverable-section.tsx）只是一個 URL 輸入框，不是文件上傳功能。志偉的 SIT 報告（Word 檔）無處可放。
3. **沒有和廠商協作的機制**：Task 的 `primaryAssigneeId` / `backupAssigneeId` 只能指向 TITAN 內的 User，廠商無法被加入。整天的協作紀錄只能以 TaskComment 的方式手動記錄。

---

## 場景 5：週四下午 — 準備 Deployment Checklist

**日期**：2026 年 3 月 26 日（週四）14:00

志偉打開 `/knowledge` 頁面，在左側 DocumentTree 搜尋「deployment」（透過 DocumentSearch 元件，`GET /api/documents/search?q=deployment`）。找到一份「核心系統部署 SOP」文件，點開後在右側 MarkdownEditor 看到上次留下的模板。他按「新增文件」（`createDoc(parentId)`），建立「2026-03-29 Oracle 19.22 Patch Deployment Checklist」，開始在 Markdown 裡列出步驟：

```markdown
## Pre-deployment
- [ ] RMAN full backup 完成
- [ ] 通知業務單位停機
- [ ] 準備回滾腳本

## Deployment
- [ ] 停止應用服務
- [ ] 執行 patch apply
- [ ] 啟動 & 驗證

## Post-deployment
- [ ] 執行 smoke test
- [ ] 通知業務恢復
```

**志偉的挫折**：他在 Knowledge 裡寫的 checklist 和 Kanban 上的 Task 是完全斷開的。他無法把這份文件「連結」到「Oracle 19.22 patch」那張 Task。Document model（schema.prisma L620-641）沒有 `taskId` 或 `relatedTaskId` 欄位。他只能手動在 Task description 裡貼 `/knowledge/xxx` 的連結。

---

## 場景 6：週五下午 16:50 — 補填整週工時（最痛苦場景）

**日期**：2026 年 3 月 27 日（週五）16:50

志偉點開 `/timesheet` 頁面。TimesheetToolbar 顯示「2026/03/23 – 2026/03/29」。TimesheetGrid 載入完成（`GET /api/time-entries?weekStart=2026-03-23`），他看到 7 行 x 7 欄的格子表。

**目前狀態**：只有週一填了一筆——「日常維運」行的週一格子顯示 `8.0`（藍色圓點 + 數字）。週二到週五全是「—」破折號。週末兩欄灰色底。底部「每日合計」只有週一顯示綠色的 `8.0`，其餘都是灰色的「—」。右下角「合計」顯示 `8.0`。

志偉嘆了口氣。他要回想這五天做了什麼。

**週二**（整天 SIT 測試）：他點「+ 新增任務列」按鈕（`add-task-row-btn`），出現搜尋框（`task-search-input`），輸入「SIT」，找到「核心系統 OS 升級 SIT」，點擊。Grid 多了一行。他在這行的週二格子點一下（觸發 `handleClick` → `setEditing(true)`），格子變成 `<input type="number">`，他輸入 `8`，按 Tab（觸發 `handleKeyDown` → `onQuickSave(taskId, "2026-03-24", 8)`）。格子變回顯示模式，出現藍點 + `8.0`。分類預設是 `PLANNED_TASK`，正確。

**週三上午**（日常 + P1 事件）：週三比較複雜。他先在「日常維運」行的週三格子點擊，輸入 `2`，Tab 存檔。然後他需要記錄 P1 事件的工時，但「P1-核心系統 ORA-01555」這張 Task 不在 Grid 的任務列裡。他再按「+ 新增任務列」，搜尋「ORA-01555」，加入。在新行的週三格子點擊，輸入 `4`，Tab。但他還想加備註「undo tablespace 擴充」。他在那個格子上雙擊（觸發 `handleDoubleClick` → `setExpanded(true)`），展開編輯器出現在格子下方——一個 `w-72` 的浮動面板，裡面有「工時」「分類」「備註」「加班類型」四個欄位。他把分類從 `PLANNED_TASK` 改成 `INCIDENT`（紅色圓點），備註欄輸入「ORA-01555 undo tablespace 不足，擴充後恢復」。點「儲存」（觸發 `handleEntrySave` → `onFullSave(taskId, date, 4, "INCIDENT", "ORA-01555...", "NONE", entryId)`）。

**週三下午**（CAB 會議 + 其他）：他在「日常維運」行的週三格子雙擊，想要加第二筆記錄。展開面板顯示已有的 2h 記錄，底部有「+ 新增記錄」按鈕（`add-entry-btn`）。他點擊，出現新表單（`new-entry-form`），輸入 2h / ADMIN / 「CAB 變更管理會議」。點「新增」（觸發 `handleNewEntrySave`）。但他發現格子顯示的是 `4.0 +1`——意思是「總共 4 小時，有 2 筆記錄」，但他填的是 2+2=4，而不是原本的 2 變成 4。他困惑了一下，仔細看才發現灰色小字 `+1` 表示有額外記錄。

**週三剩餘**：他還有 2 小時不知道做了什麼。他打開 Outlook 搜尋週三的郵件……但 TITAN 裡沒有辦法做這件事。他隨便填了「日常維運 2h」。

**週四**（上午處理其他任務、下午寫 deployment checklist）：同樣的操作重複。他在兩個任務行各填 4h。

**週五**（填工時本身花了 25 分鐘 + 其他工作）：他在「日常維運」填 6h，「行政庶務」填 2h（含填工時這件事本身）。

最後他看了一下底部合計：Mon=8, Tue=8, Wed=8, Thu=8, Fri=8, Sat=—, Sun=—。右下角 `40.0`。TimeSummary 元件顯示：「總工時 40h | PLANNED_TASK 60% | INCIDENT 10% | ADMIN 10% | 其他 20% | 任務投入率 70%」。

**耗時**：16:50 開始，17:15 填完。25 分鐘。

**TITAN 缺口**：
1. **沒有「從行事曆匯入」功能**：TimesheetToolbar 有「複製上週」（`onCopyPreviousWeek`），但沒有「從 Outlook/Teams 行事曆自動建議工時項目」的功能。志偉浪費大量時間回想過去做了什麼。
2. **週三的多筆記錄操作繁瑣**：要在同一天同一任務列加第二筆記錄，必須雙擊展開 → 點「+ 新增記錄」→ 填四個欄位 → 儲存。6 次點擊 + 打字，只為了加一筆 2h 的記錄。
3. **沒有「每日提醒」推動即時填報**：雖然 `NotificationType` 有 `TIMESHEET_REMINDER`，但從 codebase 看不到任何 cron job 或 scheduled notification 的實作。提醒只是一個 schema 定義，沒有觸發邏輯。
4. **格子顯示資訊不足**：`TimesheetCell` 在顯示模式只看到一個數字和小圓點。志偉無法一眼看出「這 4h 是什麼分類」——他要雙擊展開才看得到。

---

## 場景 7：每月第 1 個工作日 — 繳交上月月報

**日期**：2026 年 4 月 1 日（週三）09:30

陳經理在 Line 群發訊息：「各位本週五前交 3 月份月報到共用資料夾」。志偉打開 TITAN `/reports` 頁面，看到五個 Tab：「週報」「月報」「KPI 報表」「計畫外負荷」「趨勢分析」。他點「月報」Tab。

月報頁面載入（`GET /api/reports/monthly?month=3&year=2026`）。畫面顯示：
- 本月總工時：168h
- 計畫內投入率：62%
- 計畫外（INCIDENT + SUPPORT + ADDED_TASK）：38%
- 逾期任務：2 項
- 完成任務：14 項

志偉需要的是一份可以交給陳經理的 **Word 或 PDF 文件**，格式需要符合銀行內部範本（封面、摘要、工時明細表、任務完成清單、下月計畫）。但 TITAN 的 Reports 頁面只有螢幕上的統計數字和一個「匯出 JSON」按鈕（`exportJSON` 函式）。JSON 不是陳經理要的格式。

**志偉的實際做法**：他用 `/reports` 頁面上的數字，手動填入 Excel 模板。工時明細表要一天一天對——他切到 `/timesheet`，按「上一週」四次（每次觸發 `onPrevWeek`），分別截圖或抄數字。整個過程花了 45 分鐘。

**TITAN 缺口**：
1. **缺乏「匯出 PDF/Excel」功能**：ReportsPage 有 `PrintButton`（`window.print()`）和 `exportJSON`，但沒有結構化的月報模板匯出。
2. **月度視圖不完整**：`/timesheet/monthly` 頁面存在（`monthly/page.tsx`），但只給 Manager 看（TimesheetPage 的 isManager check），工程師自己看不到自己的月度彙總。
3. **跨週瀏覽痛苦**：要看整個月的工時，必須在週視圖來回切換 4-5 次。沒有一鍵「展開本月所有週」的功能。

---

## 場景 8：每月 5 日前 — KPI 數據填報

**日期**：2026 年 4 月 3 日（週五）11:00

志偉打開 `/kpi` 頁面。KPIPage 載入後顯示 2026 年度的 KPI 清單。他看到三個 KPI card：
- KPI-2026-01「核心系統可用率」目標 99.95%，目前 actual 顯示 0（因為沒人填）
- KPI-2026-02「P1 事件 MTTR」目標 ≤ 60 分鐘，目前 actual 顯示 0
- KPI-2026-03「專案準時完成率」目標 90%，目前 actual 顯示 85%（autoCalc=true，從 taskLinks 自動計算）

志偉的問題：KPI-01 和 KPI-02 的 `autoCalc` 是 false，需要他手動更新 `actual` 值。但在 KPICard 元件裡，他只能看到數字，**沒有「編輯 actual 值」的按鈕**。只有 Manager 可以在 CreateKPIForm 建立 KPI，但 schema 裡也沒看到 「更新 actual 值」的 UI。他要去問陳經理幫他改。

更根本的問題：「核心系統可用率 99.95%」這個數字從哪裡來？志偉要去 Grafana 拉整個月的 uptime 紀錄，手動計算。TITAN 沒有任何與外部監控系統的整合。

**TITAN 缺口**：
1. **KPI actual 值沒有編輯入口**：KPICard 只有展開看 taskLinks 和 unlink 的功能。缺少 `PATCH /api/kpi/${id}` 的前端 UI 讓工程師更新 actual 值。
2. **KPI 歷史紀錄缺失**：KPI model 的 `actual` 是一個 Float，不是時間序列。無法追蹤「3 月份可用率 99.97%，4 月份 99.92%」的月度變化。
3. **缺乏公式型 KPI**：銀行的 KPI 通常有公式（如：可用率 = (總分鐘數 - 停機分鐘數) / 總分鐘數）。TITAN 只支援「手動填數字」或「從任務完成率 autoCalc」。

---

## 場景 9：金管會稽核通知 — 準備稽核資料

**日期**：2026 年 4 月 8 日（週三）10:00

陳經理轉發郵件：「金管會 4/22 來稽核，主題：『資訊系統變更管理與事件管理』。請準備以下資料：(1) 近半年變更紀錄清冊 (2) 事件管理紀錄（含 MTTR） (3) 系統巡檢紀錄 (4) 工時投入分析報告。」

志偉打開 TITAN，開始盤點能提供什麼：
- **變更紀錄清冊**：TITAN 沒有獨立的「變更管理」模組。變更資訊散落在各 Task 的 description（Markdown 純文字）裡。TaskChange model（schema.prisma L359-375）只記錄「延期」和「範疇變更」，不是 ITIL 定義的 Change Record。
- **事件管理紀錄**：同上，INCIDENT 類型的 Task 沒有結構化的事件欄位。要算 MTTR，他得手動翻 TaskComment 裡寫的時間戳。
- **系統巡檢紀錄**：完全不存在。
- **工時投入分析報告**：`/reports` 頁面的「計畫外負荷」Tab 可以看到比率，但沒有半年的歷史趨勢，且只能匯出 JSON。

志偉花了整整兩天（16 小時）用 Excel 手動整理這些資料。其中 8 小時花在翻 Task description 裡的 Markdown 文字，人工提取變更編號、日期、影響範圍。

**TITAN 缺口**：這是最嚴重的缺口。銀行受金管會監管，稽核準備是剛需。TITAN 缺乏：
1. **結構化的變更管理紀錄**（Change Record with 變更編號、類型、風險等級、核准人、執行時間、驗證結果）
2. **結構化的事件管理紀錄**（Incident Record with 發生時間、影響範圍、MTTR、根因分析、矯正措施）
3. **稽核報表匯出**（一鍵產出符合金管會格式的報表）
4. **AuditLog**（schema.prisma L683-696）只記錄 TITAN 系統內的操作日誌，不是業務面的稽核軌跡。

---

## 場景 10：發現異常登入 — 資安事件通報

**日期**：2026 年 4 月 10 日（週五）14:00

志偉在看 SIEM（Splunk）告警時發現：昨晚 03:17 有一個 AD 帳號「svc_batch」從異常 IP（外部 IP）嘗試登入 5 次失敗。依照銀行《資安事件管理辦法》，這屬於「可疑資安事件」，30 分鐘內要通報資安長（CISO）。

14:02 志偉截圖 Splunk 畫面，用 email 通報資安長。
14:05 他打開 TITAN `/kanban`，建立一張 Task「SEC-可疑帳號異常登入 svc_batch」，分類 INCIDENT，優先序 P0。
14:08 他在 Task description 寫入事件描述。

**志偉的挫折**：銀行的資安事件通報有法定時限（30 分鐘初報 → 24 小時詳報 → 72 小時結案報告），但 TITAN 沒有任何倒數計時或 deadline 追蹤機制。Task 的 `dueDate` 是手動設的，不會自動從「事件建立時間 + SLA 時限」計算。更糟的是，`Notification` model 沒有「SLA 即將到期」的通知類型——`NotificationType` 裡只有 `TASK_DUE_SOON`，不是「資安事件通報時限倒數」。

**TITAN 缺口**：
1. 缺乏資安事件通報流程的結構化支援（通報層級、時限追蹤、自動提醒）
2. 沒有「附件上傳」功能來附加 SIEM 截圖
3. 無法與外部通報系統（如金管會 F-ISAC）整合或產出通報格式

---

## 場景 11：本季 DR 演練日

**日期**：2026 年 4 月 15 日（週三）22:00

今晚是本季災難復原（DR）演練。志偉和同事阿偉在機房值班。他打開 TITAN `/knowledge`，搜尋「DR」，找到「災難復原演練 SOP」文件。但他發現這份 SOP 是去年寫的（Document version 顯示 `v3`，最後更新者：「王大明」——去年離職的資深工程師）。

22:15 開始切換 DB 到 DR site。志偉照著 SOP 步驟操作，但到第 7 步「啟動 Data Guard switchover」時，指令和實際環境不符——去年升級 Oracle 19c 後，Data Guard 的指令有變化，但 SOP 沒更新。

他花了 20 分鐘 Google 正確指令，完成切換。23:45 演練結束，所有服務在 DR site 恢復。

**TITAN 缺口**：
1. **Document 沒有「過時提醒」機制**：Document model 有 `updatedAt`，但沒有「review deadline」或「有效期限」欄位。SOP 文件可能一年沒更新也不會有任何提醒。
2. **VersionHistory 元件只能回看**：志偉可以在 `VersionHistory` 看到每次修改紀錄，但不能「比較差異」（diff view）。他無法快速看出 v2 和 v3 改了什麼。
3. **缺乏 runbook 執行追蹤**：SOP 是一份 Markdown 文件，但「哪些步驟已執行、由誰在幾點執行」無法在 Document 裡追蹤。Knowledge 和 Task 系統是斷開的。

---

## 場景 12：資深同事退休知識交接

**日期**：2026 年 4 月 21 日（週一）10:00

資深工程師陳大哥（55 歲，年資 28 年）下個月退休。他負責的系統有些「只有他知道」的眉角。志偉被指派做知識交接。

志偉在 `/knowledge` 建立一份「陳大哥知識交接清冊」文件（`POST /api/documents`），開始記錄。陳大哥口述：「核心系統的 EOD batch 如果 step 37 失敗，不要直接 re-run，要先去 /app/cbs/tmp 清掉 lock file，不然會重複入帳。這個 lock file 的 naming pattern 是 `eod_{YYYYMMDD}.lck`。」

志偉在 Markdown 裡打這些內容。但問題來了：
1. 陳大哥的知識太多了（25 個系統 × 平均 10 個 know-how = 250 條）。全部寫在一份 Markdown 裡太亂。
2. 有些知識和特定 Task 有關（例如「每年 12/31 的 EOD 要特別注意閏秒」），但 Document 無法 link 到 Task。
3. 陳大哥說的「清 lock file」其實是一個 SOP，應該是一份獨立的、可搜尋的文件。但 DocumentTree 是樹狀結構，不支援「標籤」（tag）分類。

**TITAN 缺口**：
1. **Document 缺乏 tag/label 系統**：DocumentSearch 只支援全文搜尋（`GET /api/documents/search?q=`），不支援分類標籤。「Oracle」「batch」「EOD」這些標籤無處可放。
2. **缺乏 Document ↔ Task 關聯**：Knowledge 和 Task 是兩個獨立的系統，沒有交叉引用。
3. **沒有「知識卡片」概念**：250 條 know-how 如果都塞在一份長 Markdown 裡，可讀性和可搜尋性都差。需要類似 wiki 的短篇知識條目（每條一頁），但 Document 的建立成本太高（每次都要 `prompt("新文件標題：")`）。

---

## 場景 13：搜尋歷史 Oracle 錯誤解決方案

**日期**：2026 年 4 月 23 日（週三）15:30

志偉遇到一個罕見錯誤 `ORA-04031: unable to allocate shared memory`。他隱約記得半年前陳大哥處理過類似問題。他打開 `/knowledge`，在 DocumentSearch 輸入「ORA-04031」。搜尋結果：0 筆。

他改搜「shared memory」——找到一份「Oracle 記憶體管理」文件，但裡面是通用的 SGA/PGA 調整教學，不是特定的 troubleshooting 紀錄。

他改去 `/activity` 頁面（ActivityPage），想找半年前的操作紀錄。但 Activity 頁面一頁只顯示 30 筆（`limit=30`），要翻很多頁。更關鍵的是，`TaskActivity` 的 `action` 欄位只記錄「建立」「更新」「變更狀態」這些操作，不記錄 Task description 裡的技術內容。

最後他 Google 解決了問題（`ALTER SYSTEM SET SGA_TARGET=8G SCOPE=SPFILE;`），但這個解決方案又只存在他的腦海裡。

**TITAN 缺口**：
1. **Activity 不支援全文搜尋**：ActivityPage 只能按時間分頁瀏覽，不能搜尋。找半年前的事件像大海撈針。
2. **Knowledge 搜尋不搜尋 Task content**：DocumentSearch 只搜 Document 表，不搜 Task description 或 TaskComment。但很多技術解決方案是寫在 Task 的 comment 裡的。
3. **缺乏「解決方案知識庫」**：和 ServiceNow 的 Knowledge Base 不同，TITAN 的 Knowledge 是通用文件管理，不是 ITSM 導向的「問題-解決方案」配對。

---

## 場景 14：業務單位臨時要報表

**日期**：2026 年 4 月 24 日（週四）11:15

營業部張經理打電話：「志偉啊，下午要和金管會報告，可以幫我拉一張『最近三個月核心系統異動清單』嗎？要有日期、異動說明、影響範圍。格式用 Excel。」

志偉心想：TITAN 有 /reports 頁面，但那裡沒有「變更清單」報表。他打開 `/kanban`，用 TaskFilters 篩選 `category: PLANNED`，但 filter 沒有「日期範圍」選項。他也不能一次看到所有 DONE 的任務然後篩選過去三個月的。

他只好開 Excel，手動從 TITAN 的 kanban 一筆一筆抄。花了 40 分鐘。

**TITAN 缺口**：
1. **TaskFilters 缺乏日期範圍篩選**：`TaskFilters` 元件（task-filters.tsx）只支援 assignee、priority、category 三個篩選條件，沒有 dateRange。
2. **缺乏自訂報表/匯出功能**：`/reports` 只有固定的五種報表（週報、月報、KPI、計畫外、趨勢），無法讓使用者自訂查詢條件並匯出 Excel/CSV。
3. **沒有「快速回應臨時查詢」的設計**：銀行 IT 常收到臨時的資料需求，TITAN 完全沒有考慮這個場景。

---

## 場景 15：廠商通知安全漏洞緊急修補

**日期**：2026 年 4 月 25 日（週五）09:30

Oracle 原廠發布 Critical Patch Update（CPU），其中一個 CVE 影響目前版本。廠商 email 通知：「CVE-2026-XXXX，CVSS 9.8，建議 72 小時內修補。」

志偉在 `/kanban` 建立 Task「SEC-Oracle CPU CVE-2026-XXXX 緊急修補」，priority P0。他在 description 裡貼了 CVE 連結。然後他要做以下事情：
1. 確認影響範圍（哪些主機需要修補）
2. 準備測試環境先 patch
3. 排程正式環境修補時間
4. 通知相關人員

但在 TITAN 裡，這些步驟只能靠 SubTask 的 checkbox 追蹤。沒有「指派不同步驟給不同人」的能力——SubTask 有 `assigneeId` 欄位（schema L308），但 TaskDetailModal 的 SubTask UI（subtask-list.tsx）可能沒有展示這個功能。沒有「步驟之間的依賴關係」。沒有「72 小時倒數」。

**TITAN 缺口**：
1. SubTask 功能太簡化，不支援完整的 workflow（指派、到期日追蹤、依賴關係）
2. 缺乏漏洞追蹤的結構化欄位（CVE 編號、CVSS 分數、受影響系統、修補狀態）
3. 沒有 SLA 倒數計時

---

## 專家小組 10 輪討論

### 第 1 輪：工時填報的根本問題

**李架構師**：場景 6 是最核心的痛點。我在合庫的時候，工程師每週花 30 分鐘填工時，一年 52 週就是 26 小時/人，5 個人就是 130 小時。問題不是 TITAN 的格子不好用，而是**填工時這個動作本身和工作流程斷開了**。志偉做完一件事不會馬上去填，因為他的注意力在下一件事上。

**林前端**：但 TITAN 已經有 TimesheetTimer 元件了。`timesheet-timer.tsx` 實作了計時器，`TimeEntry` model 有 `startTime`/`endTime`/`isRunning` 欄位。問題是使用者不會用——因為要先切到 `/timesheet`、選任務、按開始。

**王教授**：研究顯示，行為改變需要降低「啟動成本」。我建議在 topbar 加入一個全域的 timer widget，不需要離開當前頁面就能一鍵記錄。具體來說：修改 `topbar.tsx`，在 NotificationBell 旁邊加一個 `<MiniTimer />` 元件，顯示「目前：未計時」或「00:45:23 — Oracle patch 測試」。點擊可以快速選任務、開始/停止。

**陳 PM**：我反對加計時器。銀行的工程師被打斷太頻繁（場景 2、10、14），他們會忘記按停止。最後還是要手動修正。我主張改善「回顧式填報」的體驗——在 TimesheetCell 的 expanded editor 加一個「今天的行事曆」按鈕，從 Exchange/Teams 抓今天的會議和行事曆事件，自動建議工時項目。

**林前端**：Exchange 整合在銀行內網很難做。OAuth2 在 air-gapped 環境行不通。比較可行的是：在 TimesheetGrid 上方加一個「本日活動摘要」區塊，從 TITAN 自己的 `TaskActivity` 表撈今天的操作紀錄（哪些 Task 被更新了、幾點更新的），自動建議工時分配。這只需要改 `useTimesheet` hook，加一個 `GET /api/activity?date=2026-03-27&userId=me` 的查詢。

**估計工時**：修改 `useTimesheet` 加入 daily activity hint 功能，約 8 小時開發 + 4 小時測試。

---

### 第 2 輪：事件管理的欄位缺口

**張顧問**：場景 2、9、10 都暴露同一個問題：TITAN 把 INCIDENT 當成普通 Task 的一個 category tag，但銀行需要完整的事件生命週期管理。金管會稽核時，他們要看的是：事件編號、發生時間、影響範圍、嚴重等級、根因分析、矯正措施、MTTR。這些都是**結構化欄位**，不是寫在 Markdown description 裡的。

**林前端**：技術上有兩條路。第一條：在 `Task` model 加入 ITSM 欄位（`incidentStartTime DateTime?`、`incidentEndTime DateTime?`、`rootCause String?`、`impactScope String?`、`slaMinutes Int?`）。優點是簡單，缺點是 Task 表會越來越胖。第二條：建一個獨立的 `IncidentRecord` model，和 Task 1:1 關聯。

**李架構師**：我投第二條。銀行的 ITSM 欄位至少有 15 個（還要有「通報時間」「通報對象」「升級時間」等），全塞進 Task 會讓 schema 混亂。而且未來可能需要獨立的 `/incidents` 頁面和報表。

**黃測試**：同意第二條，但我要提醒：建 IncidentRecord model 後，`/kanban` 的 TaskDetailModal 要有條件式欄位——只有 `category === INCIDENT` 時才顯示事件管理區塊。TaskCard 也要加事件嚴重等級的視覺指示。這額外增加 task-detail-modal.tsx 和 task-card.tsx 的修改量。

**陳 PM**：我同意第二條路線，但要分期。Phase 1 先加基礎的 5 個欄位（發生時間、結束時間、嚴重等級、根因、影響範圍），Phase 2 再做通報流程和 SLA 倒數。Phase 1 的開發估計：schema migration 2h + API endpoint 4h + TaskDetailModal 條件式 UI 8h + 測試 6h = **20 小時**。

---

### 第 3 輪：稽核合規是最高優先

**張顧問**：場景 9 志偉花了 16 小時準備稽核資料。以 5 人團隊、每年 2 次稽核計算，一年浪費 160 人時。這比工時填報的 130 人時還多。而且稽核不合格的後果是**糾正措施**甚至**罰款**。我認為稽核合規功能的優先序應該高於工時改善。

**王教授**：但使用者研究也很重要。志偉每週痛苦一次（填工時），但稽核一年只有兩次。從 day-to-day 使用者體驗來看，工時是更高頻的痛點。

**張顧問**：高頻不等於高影響。填工時慢 25 分鐘是不便，稽核不合格是**法規風險**。銀行 IT 的 priority 永遠是：合規 > 安全 > 效率。

**李架構師**：兩者不互斥。稽核報表的資料來源就是平常累積的結構化紀錄。如果平常的事件紀錄和變更紀錄都是結構化的（第 2 輪討論的 IncidentRecord + 未來的 ChangeRecord），那稽核時只要一鍵匯出就好。所以正確的順序是：先做結構化紀錄（IncidentRecord、ChangeRecord），再做匯出報表。

**陳 PM**：同意。Roadmap 建議：Q2 先做 IncidentRecord + ChangeRecord model，Q3 做稽核報表匯出。工時改善可以 Q2 並行做（因為改的是不同模組）。

---

### 第 4 輪：Knowledge 模組的困境

**王教授**：場景 12 和 13 暴露 Knowledge 模組的根本設計問題。它目前是一個「Markdown 文件管理器」，但銀行 IT 需要的是一個「troubleshooting knowledge base」。這兩者的差異是巨大的：前者是寫作工具，後者是搜尋工具。

**林前端**：TITAN 的 Knowledge 已經有 Outline wiki 整合（`NEXT_PUBLIC_OUTLINE_URL`），但場景是在 air-gapped 銀行環境，可能部署不了 Outline。回到內建的 DocumentTree + MarkdownEditor，我認為要做三件事：
1. Document model 加 `tags String[]` 欄位（參考 Task 的 tags 欄位實作）
2. DocumentSearch 改為同時搜尋 Document.content + Task.description + TaskComment.content
3. Document 加 `relatedTaskIds String[]` 欄位做交叉引用

**黃測試**：第 2 點（跨表搜尋）在 PostgreSQL 上需要全文索引。如果用 `to_tsvector` 做，中文支援需要 `zhparser` 擴充。銀行的 DBA 會不會同意裝擴充？

**李架構師**：好問題。銀行環境裝任何擴充都要走變更流程。比較安全的做法是用 application-level 的模糊搜尋（ILIKE），效能差一點但不需要改 DB。或者用 Prisma 的 `search` mode（需要 `@@fulltext`，但只支援 MySQL/MongoDB）。

**林前端**：務實方案：先用 `ILIKE '%keyword%'` 做跨表搜尋，加上 `GIN index on tsvector(title || content)` 提升 Document 搜尋效能。不需要 zhparser——PostgreSQL 內建的 `simple` dictionary 對 CJK 字元做 unigram tokenization 已經堪用。Migration 腳本約 1h，API 改動 4h，前端 DocumentSearch 元件改動 3h，含測試 = **12 小時**。

---

### 第 5 輪：變更管理的結構化

**陳 PM**：場景 3 和 9 都需要變更管理。ITIL v4 的 Change Enablement 流程是：Normal Change（要 CAB）→ Standard Change（預核准）→ Emergency Change（事後補單）。目前 TITAN 的 `ApprovalRequest` model 可以勉強拿來做 Normal Change 的核准，但它缺少幾個關鍵欄位。

**張顧問**：最低限度的 ChangeRecord model 需要：`changeId`（編號，如 CHG-2026-0325-01）、`type`（Normal/Standard/Emergency）、`riskLevel`（Low/Medium/High/Critical）、`impactedSystems String[]`、`scheduledStart DateTime`、`scheduledEnd DateTime`、`actualStart DateTime?`、`actualEnd DateTime?`、`rollbackPlan String`、`cabApprovedBy String?`、`cabApprovedAt DateTime?`、`status`（Draft/Pending/Approved/InProgress/Completed/RolledBack/Cancelled）。

**林前端**：用 `ApprovalRequest` 加新的 `ApprovalType.CHANGE_REQUEST` 可以處理核准流程，但 ChangeRecord 本身的欄位太多，不適合塞進 Task。我建議獨立 model：

```prisma
model ChangeRecord {
  id               String   @id @default(cuid())
  taskId           String   @unique
  changeNumber     String   @unique  // CHG-YYYY-MMDD-NN
  type             ChangeType  // NORMAL, STANDARD, EMERGENCY
  riskLevel        RiskLevel
  impactedSystems  String[]
  scheduledStart   DateTime?
  scheduledEnd     DateTime?
  actualStart      DateTime?
  actualEnd        DateTime?
  rollbackPlan     String?
  status           ChangeStatus
  task             Task     @relation(...)
}
```

**黃測試**：這代表 TaskDetailModal 要加第二個條件式區塊（第一個是 IncidentRecord）。UI 複雜度增加。我建議用 Tab 做：「基本資訊」「事件管理」（category=INCIDENT 才出現）「變更管理」（有 ChangeRecord 才出現）「時間紀錄」「評論」。

**估計工時**：ChangeRecord model + migration 2h，API 6h，TaskDetailModal Tab 重構 12h，測試 8h = **28 小時**。

---

### 第 6 輪：報表匯出的務實方案

**李架構師**：場景 7（月報）和場景 14（臨時報表）都需要匯出功能。目前 Reports 頁面只有 `window.print()` 和 `exportJSON`。銀行需要的是 Excel（.xlsx）格式。

**林前端**：前端用 `xlsx`（SheetJS）library 可以在 browser 生成 Excel 檔。不需要後端改動。具體做法：在 ReportsPage 每個 Tab 的右上角加一個「匯出 Excel」按鈕，用 `xlsx.utils.json_to_sheet()` 把當前報表資料轉成工作表。

**陳 PM**：月報需要特定格式（封面、表頭、合併儲存格）。SheetJS 做得到但很繁瑣。更好的做法是在後端準備一個 Excel template（`.xlsx` 模板檔），用 `exceljs` library 填入資料。這樣格式可以事先設計好。

**王教授**：我要挑戰「自訂報表」的需求。場景 14 張經理要的「最近三個月核心系統異動清單」是 ad-hoc query。如果每次臨時需求都要開發新報表，永遠做不完。更好的設計是在 `/reports` 加一個「自訂查詢」Tab，讓使用者選擇：時間範圍 + Task category + Task status + 欄位選擇，然後一鍵匯出。

**林前端**：自訂查詢 Tab 的開發量比較大。需要一個 query builder UI + 動態 API endpoint。估計：query builder 元件 16h，API endpoint 8h，Excel 匯出 4h，測試 8h = **36 小時**。相比之下，先做固定的 5 種報表 Excel 匯出只要 **12 小時**。

**陳 PM**：先做固定報表匯出（12h），後做自訂查詢（36h）。分兩個 sprint。

---

### 第 7 輪：SLA 與倒數計時器

**張顧問**：場景 10 和 15 都需要 SLA 倒數。資安事件 30 分鐘初報、CVE 漏洞 72 小時修補，這些時限必須有系統級的追蹤。

**林前端**：技術上可以在 Task model 加 `slaDeadline DateTime?`，然後在 Dashboard 和 Notification 裡做倒數。但問題是：SLA 不是靜態的——P0 和 P1 的 SLA 不同，資安事件和一般事件的 SLA 也不同。需要一個 SLA 定義表。

**黃測試**：我反對做 SLA 定義表。這會把 TITAN 變成 ServiceNow。銀行已經有 ServiceNow 了（或類似系統）。TITAN 的定位應該是「團隊日常工作管理」，不是「ITSM 平台」。

**張顧問**：我同意 TITAN 不該變成 ServiceNow。但最低限度的 SLA 追蹤是必要的——至少在 Task 上加一個 `slaDeadline DateTime?` 欄位，讓使用者手動設定。然後在 Dashboard 的 TodayTasksCard 裡，如果任務有 slaDeadline 且即將到期（< 2h），顯示紅色倒數。

**林前端**：這個改動很輕量。schema 加一個欄位 1h，migration 0.5h，TaskDetailModal 加一個 datetime picker 2h，Dashboard TodayTasksCard 加倒數顯示 3h，NotificationType 加 `SLA_EXPIRING` + notification 觸發邏輯 4h，測試 4h = **14.5 小時**。

---

### 第 8 輪：SubTask 的能力不足

**陳 PM**：場景 4（SIT 測試）和 15（CVE 修補步驟）都暴露 SubTask 的限制。目前 SubTask 只有 title + done + order + assigneeId + dueDate。缺乏：notes（備註）、result（結果）、attachment（附件）。

**林前端**：SubTask model 加 `notes String?` 和 `result String?` 很簡單（schema 改動 + migration < 1h）。但 attachment 很複雜——需要 file upload 功能，這在 air-gapped 銀行環境涉及 local storage 配置、檔案大小限制、安全掃描。

**李架構師**：先不做 attachment。先加 notes 和 result 兩個文字欄位，讓志偉可以在 SubTask 記錄 SIT 測試結果。attachment 放到後面的 sprint，和 Deliverable 的文件上傳一起做。

**黃測試**：同意。但我要提醒：subtask-list.tsx 元件的 UI 需要重新設計。目前每個 SubTask 只顯示一行（checkbox + title），加了 notes 和 result 後要展開成多行。可以用 accordion 模式——點擊展開。

**估計工時**：schema 加 2 個欄位 1h，API 2h，subtask-list.tsx UI 改造 6h，task-subtask-section.tsx 修改 4h，測試 4h = **17 小時**。

---

### 第 9 輪：優先序排列與 Roadmap

**陳 PM**：綜合前 8 輪討論，我列出所有改善項目和估計工時：

| # | 項目 | 估計時數 | 優先序理由 |
|---|------|---------|-----------|
| 1 | IncidentRecord model + UI | 20h | 稽核合規必備 |
| 2 | ChangeRecord model + UI | 28h | 稽核合規必備 |
| 3 | 固定報表 Excel 匯出 | 12h | 月報/稽核必備 |
| 4 | 工時 daily activity hint | 8h | 高頻痛點，ROI 高 |
| 5 | SLA deadline 欄位 + Dashboard 倒數 | 14.5h | 資安合規 |
| 6 | SubTask notes + result | 17h | SIT 測試品質 |
| 7 | Knowledge tag + 跨表搜尋 | 12h | 知識管理基礎 |
| 8 | 自訂報表查詢 | 36h | 臨時需求自助 |
| 9 | Document 過時提醒 | 6h | DR 演練品質 |
| 10 | Topbar mini timer | 10h | 工時即時記錄 |

**張顧問**：我的排序：1→2→3→5（合規線）先做，然後 4→6→7（效率線），最後 8→9→10。

**王教授**：我的排序不同：4（每週都用）→ 1 → 7（搜尋是高頻需求）→ 3 → 其他。

**李架構師**：考量銀行的政治現實——如果下次稽核不合格，整個團隊都要寫改善報告。我支持張顧問的排序。

**最終共識**：Phase 1（Q2，8 週）— 項目 1+2+3+4（共 68h，2 人 sprint）。Phase 2（Q3，6 週）— 項目 5+6+7（43.5h）。Phase 3（Q4）— 項目 8+9+10（52h）。

---

### 第 10 輪：設計原則與 Anti-patterns

**王教授**：最後我想歸納幾個設計原則。TITAN 目前最大的 anti-pattern 是**「通用模型承載特殊需求」**——用一個 Task model 試圖涵蓋「專案任務」「事件處理」「變更管理」「日常巡檢」「資安通報」，結果每個場景都不到位。

**林前端**：同意。技術上的設計原則：
1. **Composition over Inflation**：不要繼續膨脹 Task model，而是用 1:1 關聯的專用 model（IncidentRecord、ChangeRecord）來擴展。
2. **Progressive Disclosure**：TaskDetailModal 依據 category 條件式顯示不同的 Tab/區塊，不要一次展示所有欄位。
3. **Search-first Knowledge**：Knowledge 模組要從「文件編輯器」轉型為「搜尋引擎」，搜尋 scope 要涵蓋所有文字內容（Document + Task + Comment）。

**張顧問**：從合規角度加一條：
4. **Audit-ready by Default**：每個結構化紀錄（IncidentRecord、ChangeRecord）建立時就自動寫入 AuditLog，且提供一鍵匯出符合金管會格式的報表。

**黃測試**：從測試角度：
5. **Template-driven Forms**：INCIDENT 和 CHANGE 的建立表單應該有模板（pre-filled fields），減少遺漏必填欄位的機會。測試時也更容易驗證。

**陳 PM**：最後一條：
6. **Zero-effort Retrospective**：目標是讓志偉在週五不需要花 25 分鐘填工時。系統應該自動從 TaskActivity（狀態變更紀錄）+ Timer 紀錄推算工時分配，讓使用者只需要「確認」而非「回想 + 輸入」。

**李架構師**：這個「零回想填工時」是終極目標，但需要 Timer 的高使用率才行。以目前的情況，先做 daily activity hint（場景 6 的改善），讓系統至少能提示「今天你更新了這 3 張 Task，要不要各填 2h？」，這已經是很大的進步。

---

## 總結：關鍵發現

1. **最高風險缺口**：稽核合規（場景 9）。TITAN 缺乏結構化的事件/變更紀錄，導致稽核準備需要 16+ 人時的手動整理。建議 Q2 優先開發 IncidentRecord + ChangeRecord model。

2. **最高頻痛點**：工時補填（場景 6）。每週 25 分鐘 × 52 週 × 5 人 = 108 小時/年的浪費。建議 Q2 並行開發 daily activity hint 功能。

3. **最大架構問題**：Task model 承載過多語義。INCIDENT、CHANGE、日常巡檢、SIT 測試、資安事件都用同一個 Task 表示，導致每個場景的結構化程度不足。建議用 composition pattern（專用 1:1 model）擴展。

4. **最大搜尋缺口**：Knowledge 搜尋不跨 Task/Comment 表。技術解決方案散落在 Task description 和 TaskComment 裡，無法被 DocumentSearch 找到。建議 Q3 實作跨表全文搜尋。

5. **最大匯出缺口**：Reports 頁面只能看不能導出有格式的 Excel/PDF。銀行環境中「可交付的文件」比「螢幕上的數字」重要 100 倍。建議 Q2 實作固定報表 Excel 匯出。

---

*報告由 6 人專家小組於 2026 年 3 月 26 日完成。基於 TITAN v1.0.0 codebase 分析。*
