# 工時紀錄模組改善需求（參考 Kimai，適配 TITAN）

**需求提出：** PM（第六輪審查）
**參考系統：** [Kimai](https://www.kimai.org/) — 開源工時追蹤系統
**原則：** 結合現有架構，不過度設計，適合 5 人銀行 IT 團隊

---

## 現狀問題

| 問題 | 說明 |
|------|------|
| 只有「小時數」 | 沒有開始/結束時間，無法知道幾點到幾點在做什麼 |
| 無計時器 | 必須事後回想填報，不能即時計時 |
| 格子式 UI | 只有週曆格子，不直覺 |
| 無工時描述 | description 欄位存在但 UI 未提供輸入 |
| 無任務快速選擇 | 只有「自由工時」行，需手動關聯任務 |

---

## 改善需求（分 Phase 實施）

### Phase 1：核心改善（v1.1）

#### 1.1 開始/結束時間
- TimeEntry 新增 `startTime` 和 `endTime` 欄位（DateTime）
- `hours` 自動從 `endTime - startTime` 計算
- 保留手動輸入小時數的方式（相容舊流程）
- UI 顯示：`09:00 - 12:30 (3.5h)`

```prisma
model TimeEntry {
  // 新增欄位
  startTime   DateTime?  // 開始時間
  endTime     DateTime?  // 結束時間
  // hours 保留，自動計算或手動輸入
}
```

#### 1.2 計時器（Timer）
- 頁面頂部「開始計時」按鈕
- 點擊後記錄 startTime = now()
- 顯示即時計時器：`00:45:23`
- 點「停止」時記錄 endTime = now()，自動計算 hours
- 同時只能有一個進行中的計時器
- 計時器狀態存在 `localStorage`（重整不丟失）

#### 1.3 工時描述
- 每筆工時可填「工作內容描述」（description）
- 在格子/列表中滑鼠懸停顯示描述
- 描述非必填

#### 1.4 雙視圖切換
- **週曆格子視圖**（現有）— 快速概覽
- **列表視圖**（新增）— 詳細時間記錄

列表視圖顯示：
```
日期       開始     結束     時數   任務           分類       描述
03/25    09:00   12:30   3.5h   TITAN 開發    PLANNED    修復 API 回應格式
03/25    13:30   15:00   1.5h   —            SUPPORT    協助同事排查問題
03/25    15:00   17:00   2.0h   TITAN 測試    PLANNED    E2E 測試撰寫
```

#### 1.5 快速任務選擇
- 輸入工時時，下拉選單直接選任務（不只「自由工時」）
- 搜尋篩選（輸入關鍵字過濾任務列表）
- 「最近使用」的任務排在前面

### Phase 2：進階功能（v1.2，視需求）

#### 2.1 日曆視圖
- 月曆顯示每日工時總數
- 點擊日期展開當天記錄
- 色彩標示：正常（綠）/ 超時（橘）/ 未填（灰）

#### 2.2 工時覆核
- Manager 可看到全團隊工時
- 標記「已覆核」狀態
- 覆核後工時不可修改（鎖定）

#### 2.3 工時統計儀表板
- 本週/本月工時趨勢圖
- 按分類的工時分佈圓餅圖
- 計畫外工時比例趨勢

---

## 不做的功能（避免過度設計）

| Kimai 功能 | 不採用原因 |
|-----------|-----------|
| 客戶管理 | 銀行內部系統，無外部客戶 |
| 計費費率 | 不做計費/發票 |
| 多幣別 | 不需要 |
| 多時區 | 全部在台灣 |
| LDAP 認證 | 已在 TITAN 主認證處理 |
| 發票產生 | 不適用 |
| 預算追蹤 | 用 KPI 模組處理 |

---

## 資料庫變更

```prisma
model TimeEntry {
  id          String       @id @default(cuid())
  taskId      String?
  userId      String
  date        DateTime     @db.Date
  startTime   DateTime?    // 新增：開始時間
  endTime     DateTime?    // 新增：結束時間
  hours       Float        // 保留：自動計算或手動
  category    TimeCategory @default(PLANNED_TASK)
  description String?      // 已有：UI 需開放輸入
  isRunning   Boolean      @default(false)  // 新增：計時器進行中
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  task Task? @relation(fields: [taskId], references: [id])
  user User  @relation(fields: [userId], references: [id])

  @@index([taskId])
  @@index([userId])
  @@index([userId, date])
  @@index([isRunning])  // 快速查詢進行中的計時器
}
```

---

## API 變更

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/time-entries/start` | 開始計時（建立 isRunning=true 的記錄）|
| POST | `/api/time-entries/stop` | 停止計時（設 endTime + 計算 hours）|
| GET | `/api/time-entries/running` | 取得目前進行中的計時器 |
| GET | `/api/time-entries?view=list` | 列表視圖（含 startTime/endTime）|

---

## UI 變更摘要

1. 頁面頂部：計時器按鈕 + 即時顯示
2. 視圖切換：格子 / 列表 tab
3. 格子視圖：保留現有 + 支援開始/結束時間輸入
4. 列表視圖：新增，詳細時間記錄
5. 新增工時：下拉選任務 + 開始結束時間 + 描述
6. 統計摘要：增加時間段分佈圖

---

## 預估工時

| Phase | 項目 | 預估 |
|-------|------|------|
| 1.1 | Schema + API（startTime/endTime）| 2h |
| 1.2 | 計時器功能 | 4h |
| 1.3 | 描述欄位 UI | 1h |
| 1.4 | 列表視圖 | 3h |
| 1.5 | 任務快速選擇 | 2h |
| **Phase 1 合計** | | **12h** |
| 2.1 | 日曆視圖 | 4h |
| 2.2 | 覆核功能 | 3h |
| 2.3 | 統計儀表板 | 3h |
| **Phase 2 合計** | | **10h** |

---

*參考：[Kimai](https://www.kimai.org/) | 適配 TITAN v1.1*
