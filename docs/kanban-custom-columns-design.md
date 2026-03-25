# 看板自訂欄位設計文件

> Issue #413 — 看板支援自訂欄位，不同專案不同狀態流程

**版本**: v1.0
**最後更新**: 2026-03-25
**狀態**: 設計階段
**前置文件**: `app/(app)/kanban/page.tsx`

---

## 1. 現況

目前看板使用硬編碼的 5 個欄位：

```typescript
const COLUMNS = [
  { status: "BACKLOG", label: "待辦清單" },
  { status: "TODO",    label: "待處理" },
  { status: "IN_PROGRESS", label: "進行中" },
  { status: "REVIEW",  label: "審核中" },
  { status: "DONE",    label: "已完成" },
];
```

所有專案共用相同狀態流程，無法依專案需求調整。

---

## 2. 設計目標

- 每個年度計畫（AnnualPlan）可自訂看板欄位配置
- 欄位配置儲存於資料庫，支援動態載入
- 向後相容：未設定自訂欄位的計畫使用預設 5 欄配置
- Manager 可管理欄位設定

---

## 3. 資料模型

### 3.1 新增 Model

```prisma
/// 看板欄位配置 — 每個年度計畫可自訂
model KanbanColumnConfig {
  id           String @id @default(cuid())
  annualPlanId String
  statusKey    String   // 對應 TaskStatus enum 值或自訂 key
  label        String   // 顯示名稱
  color        String   @default("text-muted-foreground") // Tailwind class
  order        Int      @default(0) // 排序順序
  isVisible    Boolean  @default(true) // 是否顯示
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  annualPlan AnnualPlan @relation(fields: [annualPlanId], references: [id], onDelete: Cascade)

  @@unique([annualPlanId, statusKey])
  @@index([annualPlanId])
  @@map("kanban_column_configs")
}
```

### 3.2 預設配置（Seed）

當年度計畫建立時，自動建立預設 5 欄配置：

```typescript
const DEFAULT_COLUMNS = [
  { statusKey: "BACKLOG",     label: "待辦清單", color: "text-muted-foreground", order: 0 },
  { statusKey: "TODO",        label: "待處理",   color: "text-blue-400",         order: 1 },
  { statusKey: "IN_PROGRESS", label: "進行中",   color: "text-yellow-400",       order: 2 },
  { statusKey: "REVIEW",      label: "審核中",   color: "text-purple-400",       order: 3 },
  { statusKey: "DONE",        label: "已完成",   color: "text-emerald-400",      order: 4 },
];
```

---

## 4. API 設計

### 4.1 讀取欄位配置

```
GET /api/kanban/columns?planId={annualPlanId}
```

回傳該計畫的欄位配置陣列，按 `order` 排序。
若無自訂配置則回傳預設值。

### 4.2 更新欄位配置（Manager）

```
PUT /api/kanban/columns
Body: { annualPlanId: string, columns: ColumnConfig[] }
```

整批替換該計畫的欄位配置。驗證：
- 必須包含至少一個 `DONE` 狀態的欄位（完成態不可移除）
- `statusKey` 不可重複
- `order` 必須連續

---

## 5. 前端整合

### 5.1 看板頁面修改

```typescript
// 現在：硬編碼
const COLUMNS = [...];

// 改為：從 API 載入
const [columns, setColumns] = useState(DEFAULT_COLUMNS);
useEffect(() => {
  fetch(`/api/kanban/columns?planId=${currentPlanId}`)
    .then(r => r.json())
    .then(data => setColumns(data));
}, [currentPlanId]);
```

### 5.2 欄位設定 UI

- Manager 在看板頁面新增「設定」按鈕
- 開啟設定 Modal：拖拽排序、重新命名、顯示/隱藏、色彩選擇
- 儲存後重新載入看板

---

## 6. 實作優先順序

| 步驟 | 說明 | 預估時間 |
|------|------|----------|
| 1 | 建立 KanbanColumnConfig model + migration | 0.5 天 |
| 2 | 建立 API endpoints (GET/PUT) | 0.5 天 |
| 3 | 看板頁面改為動態載入欄位 | 0.5 天 |
| 4 | 欄位設定 UI (Manager only) | 1 天 |
| 5 | 測試 + 邊界情況處理 | 0.5 天 |

**總預估**：3 天
