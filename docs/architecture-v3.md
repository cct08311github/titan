# TITAN — 銀行 IT 團隊工作管理系統
## 架構設計文件 v3.0（最終版）

**文件日期：** 2026-03-24
**版本：** 3.0（確認版，開發前最終審閱）
**適用對象：** 5 人銀行 IT 團隊（1 位主管 + 4 位工程師）
**部署環境：** 封閉內網（Air-gapped），無網際網路連線
**文件狀態：** 已整合所有確認需求，可供開發啟動

---

## 目錄

1. [系統概覽](#1-系統概覽)
2. [任務層級與核心概念](#2-任務層級與核心概念)
3. [資料模型（完整 Prisma Schema）](#3-資料模型完整-prisma-schema)
4. [API 設計（40+ 端點）](#4-api-設計40-端點)
5. [頁面線框圖（6 頁 ASCII Wireframes）](#5-頁面線框圖6-頁-ascii-wireframes)
6. [任務拆解與開發計畫（8 週）](#6-任務拆解與開發計畫8-週)
7. [UI 設計規範](#7-ui-設計規範)
8. [部署架構](#8-部署架構)

---

## 1. 系統概覽

### 1.1 背景與目標

TITAN 是為銀行內部 IT 團隊設計的一體化工作管理系統，目的是取代現有分散的 Excel 試算表、電子郵件和紙本流程，將所有工作資訊整合在單一平台上。

**核心設計原則：**
- **簡單（Simple）**：介面清晰，功能直觀，不強迫使用者學習複雜操作
- **直覺（Intuitive）**：任何功能最多 3 次點擊即可完成
- **以人為本（User-centered）**：主管看團隊全局，工程師看個人任務，各取所需
- **可追溯（Traceable）**：所有變更、延期、追加任務均有完整記錄，支援向上呈報
- **計畫外透明（Unplanned Transparency）**：突發與追加任務自動統計，呈現真實工作負荷

### 1.2 技術棧

| 層級 | 技術選型 | 說明 |
|------|---------|------|
| 前端框架 | Next.js 14（App Router） | SSR + 靜態生成，效能優異 |
| UI 框架 | Tailwind CSS + shadcn/ui | 快速開發，設計一致 |
| 字體 | Geist（Vercel 出品） | 現代感、可讀性強 |
| ORM | Prisma | 型別安全的資料庫操作 |
| 資料庫 | PostgreSQL 16 | 穩定、功能完整的關聯式資料庫 |
| 容器化 | Docker + Docker Compose | 方便在封閉內網部署 |
| 認證（MVP） | 帳號 + 密碼（bcrypt 雜湊）+ HTTP-only Cookie | 快速上線 |
| 認證（生產） | LDAP 整合 | 對接銀行現有 AD/LDAP |
| 通知（MVP） | 站內通知鈴（Notification Bell） | 即時 in-app 提醒 |
| 通知（Phase 2） | 行信 API | 推播至行動裝置 |

### 1.3 系統地圖

```
┌──────────────────────────────────────────────────┐
│                TITAN 系統地圖                     │
├──────────────────────────────────────────────────┤
│  /              → Dashboard（首頁）               │
│  /kanban        → Kanban（含任務分類徽章、A/B 角）│
│  /gantt         → Gantt（含里程碑、年度計畫時程） │
│  /knowledge     → 知識庫                         │
│  /timesheet     → 工時紀錄（6 類別）             │
│  /reports       → 報表（週/月/KPI/計畫外負荷）   │
└──────────────────────────────────────────────────┘
```

---

## 2. 任務層級與核心概念

### 2.1 完整任務層級（雙向追溯）

```
KPI（年度 KPI，約 3 月底建立，與任務連結而非強綁定）
 │
 └── AnnualPlan（年度計畫，REQUIRED：含執行計畫 + 里程碑）
      │
      └── MonthlyGoal（月度目標，進度自動向上彙整）
           │
           └── Task（任務，含 A 角 + B 角 + 交付項）
                │
                └── SubTask（子任務，完成率影響母任務進度）
```

**雙向追溯規則：**
- 向下鑽取（Top-down）：KPI → AnnualPlan → MonthlyGoal → Task → SubTask
- 向上彙整（Bottom-up）：SubTask 完成率 → Task 進度 → MonthlyGoal 完成率 → AnnualPlan 達成率 → KPI 達成率
- KPI 與 Task 為多對多連結（透過 KPITaskLink），KPI 不強制綁定特定任務

### 2.2 任務分類（6 種）

| 分類 | 代碼 | 說明 | 備註 |
|------|------|------|------|
| 原始規劃 | PLANNED | 年度/月度計畫內的任務 | |
| 追加任務 | ADDED | 計畫外新增，需記錄原因與來源 | 需填 addedDate、addedReason、addedSource |
| 突發事件 | INCIDENT | 非預期緊急事件，如系統故障 | |
| 用戶支援 | SUPPORT | 處理內部用戶問題、服務請求 | |
| 行政庶務 | ADMIN | 會議、文件、行政作業 | |
| 學習成長 | LEARNING | 教育訓練、技術研究、自我提升 | |

**計畫外負荷計算：** ADDED + INCIDENT + SUPPORT 合計為「計畫外工作量」，在報表中呈現比例與工時，供主管向上呈報。

### 2.3 A 角 / B 角機制

- 每個 Task 均設定 **primaryAssigneeId**（A 角，主要負責人）與 **backupAssigneeId**（B 角，備援負責人）
- A 角無法完成任務時（請假、離職、緊急），B 角自動收到通知
- 看板與甘特圖均顯示 A/B 角 avatar
- 只有 Manager 可指派/更改 A/B 角

### 2.4 KPI 系統

- KPI 為獨立實體（KPI table），約每年 3 月底建立
- KPI 與 Task 透過 **KPITaskLink** 多對多連結（1 個 KPI 可連結多個 Task，1 個 Task 可貢獻多個 KPI）
- KPI 包含：year、code（如 KPI-2026-01）、title、target、actual（自動彙整）、weight（佔比）、status
- 每個 KPI 可設定交付項（Deliverable）與說明
- 達成率 = actual / target，可設為手動或從連結任務的完成率自動計算

### 2.5 里程碑（Milestone）

- AnnualPlan 必須設定至少 1 個里程碑
- 里程碑顯示於甘特圖的年度時程軸上
- 系統在 **plannedEnd 前 7 天**自動發送提醒通知
- 里程碑支援追蹤 actualStart / actualEnd 以計算延誤

### 2.6 延期與變更追蹤

所有任務延期或範圍變更均記錄於 **TaskChange** 表：
- changeType：DELAY（截止日延後）或 SCOPE_CHANGE（範圍變更）
- 記錄：reason、oldValue、newValue、changedBy、changedAt
- Dashboard 顯示：「本月延期 X 件、變更 Y 件」

### 2.7 交付項（Deliverable）

以下層級均可設定交付項：KPI、AnnualPlan、MonthlyGoal、Task

| 欄位 | 說明 |
|------|------|
| title | 交付項名稱 |
| type | 文件 / 系統 / 報告 / 簽核單 |
| status | 未開始 / 進行中 / 已交付 / 已驗收 |
| attachmentUrl | 附件連結或路徑 |
| acceptedBy | 驗收人 |
| acceptedAt | 驗收時間 |

### 2.8 工時分類（6 種）

工時紀錄需標記分類，對應任務分類：

| 工時類別 | 對應任務類別 |
|---------|------------|
| PLANNED_TASK | 原始規劃任務工時 |
| ADDED_TASK | 追加任務工時 |
| INCIDENT | 突發事件處理工時 |
| SUPPORT | 用戶支援工時 |
| ADMIN | 行政庶務工時 |
| LEARNING | 學習成長工時 |

**實際任務投入率：** PLANNED_TASK 工時 ÷ 總工時，以個人與團隊平均呈現。

### 2.9 權限系統（動態）

| 角色 | 預設可見範圍 | 可授權擴展 |
|------|------------|-----------|
| Manager | 全員全部資料 | N/A |
| Engineer | 僅自己的任務與工時 | Manager 可授權：查看全隊 / 查看特定人員 |

**權限授權機制：**
- Manager 透過 Permission 表動態授權 Engineer
- 審批機制（Approval Flow）：預設隱藏，Manager 可啟用
- 可設定時效性授權（有效期間）

### 2.10 年度計畫範本

- 系統支援從前一年度計畫複製架構（MonthlyGoal 結構、Milestone 架構）
- 僅複製結構，不複製任務內容
- 操作入口：AnnualPlan 建立頁面 → 「從上年度複製範本」

### 2.11 Excel 匯入

- 支援從標準格式 Excel 匯入任務
- 提供範本下載
- 匯入時自動對應欄位：title、category、priority、assigneeId、dueDate、estimatedHours、monthlyGoalId
- 匯入結果顯示：成功筆數、失敗列與原因

### 2.12 通知機制

**MVP（站內通知鈴）：**
- 任務指派給你（A 角或 B 角）
- 任務即將到期（7 天前）
- 里程碑即將到期（7 天前）
- 你的任務被評論
- A 角請假，B 角收到通知
- 任務延期或變更

**Phase 2（行信 API）：**
- 推播緊急通知（P0 任務指派、里程碑逾期）
- 每日早晨摘要推播

---

## 3. 資料模型（完整 Prisma Schema）

### 3.1 完整 Prisma Schema

```prisma
// schema.prisma
// TITAN v3.0 — 完整資料模型

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ═══════════════════════════════════════
// 使用者與權限
// ═══════════════════════════════════════

enum Role {
  MANAGER
  ENGINEER
}

model User {
  id        String   @id @default(cuid())
  name      String
  email     String   @unique
  password  String   // bcrypt hash
  role      Role     @default(ENGINEER)
  avatar    String?  // base64 or filename
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // 關聯
  createdPlans        AnnualPlan[]     @relation("PlanCreator")
  primaryTasks        Task[]           @relation("TaskPrimaryAssignee")
  backupTasks         Task[]           @relation("TaskBackupAssignee")
  createdTasks        Task[]           @relation("TaskCreator")
  comments            TaskComment[]
  activities          TaskActivity[]
  taskChanges         TaskChange[]
  timeEntries         TimeEntry[]
  createdDocuments    Document[]       @relation("DocCreator")
  updatedDocuments    Document[]       @relation("DocUpdater")
  docVersions         DocumentVersion[]
  notifications       Notification[]
  grantedPermissions  Permission[]     @relation("PermissionGrantee")
  grantedByPermissions Permission[]   @relation("PermissionGranter")
  deliverableAcceptances Deliverable[] @relation("DeliverableAcceptor")
  createdKPIs         KPI[]            @relation("KPICreator")

  @@map("users")
}

model Permission {
  id          String   @id @default(cuid())
  granteeId   String   // 被授權的 Engineer
  granterId   String   // 授權的 Manager
  permType    String   // "VIEW_TEAM" | "VIEW_PERSON"
  targetId    String?  // 若 permType = VIEW_PERSON，則為目標使用者 ID
  expiresAt   DateTime?
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())

  grantee  User @relation("PermissionGrantee", fields: [granteeId], references: [id])
  granter  User @relation("PermissionGranter", fields: [granterId], references: [id])

  @@map("permissions")
}

// ═══════════════════════════════════════
// KPI 系統
// ═══════════════════════════════════════

enum KPIStatus {
  DRAFT
  ACTIVE
  ACHIEVED
  MISSED
  CANCELLED
}

model KPI {
  id          String    @id @default(cuid())
  year        Int
  code        String    // e.g., "KPI-2026-01"
  title       String
  description String?
  target      Float     // 目標值（如 95.0 代表 95%）
  actual      Float     @default(0) // 實際達成值，可手動或自動計算
  weight      Float     @default(1) // 佔年度 KPI 權重
  status      KPIStatus @default(ACTIVE)
  autoCalc    Boolean   @default(false) // 是否從連結任務自動計算
  createdBy   String
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  // 關聯
  creator     User           @relation("KPICreator", fields: [createdBy], references: [id])
  taskLinks   KPITaskLink[]
  deliverables Deliverable[] @relation("KPIDeliverable")

  @@unique([year, code])
  @@map("kpis")
}

model KPITaskLink {
  id        String   @id @default(cuid())
  kpiId     String
  taskId    String
  weight    Float    @default(1) // 此任務在 KPI 計算中的權重
  createdAt DateTime @default(now())

  kpi  KPI  @relation(fields: [kpiId], references: [id], onDelete: Cascade)
  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@unique([kpiId, taskId])
  @@map("kpi_task_links")
}

// ═══════════════════════════════════════
// 年度計畫、月度目標
// ═══════════════════════════════════════

model AnnualPlan {
  id              String   @id @default(cuid())
  year            Int
  title           String
  description     String?
  implementationPlan String? // 執行計畫說明（Markdown）
  progressPct     Float    @default(0) // 自動計算，月度目標完成率平均
  copiedFromYear  Int?     // 若從前一年複製，記錄來源年度
  createdBy       String
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // 關聯
  creator      User          @relation("PlanCreator", fields: [createdBy], references: [id])
  monthlyGoals MonthlyGoal[]
  milestones   Milestone[]
  deliverables Deliverable[] @relation("AnnualPlanDeliverable")

  @@unique([year])
  @@map("annual_plans")
}

enum GoalStatus {
  NOT_STARTED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model MonthlyGoal {
  id           String     @id @default(cuid())
  annualPlanId String
  month        Int        // 1–12
  title        String
  description  String?
  status       GoalStatus @default(NOT_STARTED)
  progressPct  Float      @default(0) // 自動計算，任務完成率
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt

  // 關聯
  annualPlan   AnnualPlan  @relation(fields: [annualPlanId], references: [id], onDelete: Cascade)
  tasks        Task[]
  deliverables Deliverable[] @relation("MonthlyGoalDeliverable")

  @@unique([annualPlanId, month, title])
  @@map("monthly_goals")
}

// ═══════════════════════════════════════
// 里程碑
// ═══════════════════════════════════════

enum MilestoneStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  DELAYED
  CANCELLED
}

model Milestone {
  id           String          @id @default(cuid())
  annualPlanId String
  title        String
  description  String?
  plannedStart DateTime?
  plannedEnd   DateTime
  actualStart  DateTime?
  actualEnd    DateTime?
  status       MilestoneStatus @default(PENDING)
  order        Int             @default(0)
  createdAt    DateTime        @default(now())
  updatedAt    DateTime        @updatedAt

  annualPlan AnnualPlan @relation(fields: [annualPlanId], references: [id], onDelete: Cascade)

  @@map("milestones")
}

// ═══════════════════════════════════════
// 任務
// ═══════════════════════════════════════

enum TaskStatus {
  BACKLOG
  TODO
  IN_PROGRESS
  REVIEW
  DONE
}

enum Priority {
  P0  // 緊急
  P1  // 高
  P2  // 中
  P3  // 低
}

enum TaskCategory {
  PLANNED    // 原始規劃
  ADDED      // 追加任務
  INCIDENT   // 突發事件
  SUPPORT    // 用戶支援
  ADMIN      // 行政庶務
  LEARNING   // 學習成長
}

model Task {
  id                  String       @id @default(cuid())
  monthlyGoalId       String?
  title               String
  description         String?
  category            TaskCategory @default(PLANNED)
  primaryAssigneeId   String?      // A 角
  backupAssigneeId    String?      // B 角
  creatorId           String
  status              TaskStatus   @default(BACKLOG)
  priority            Priority     @default(P2)
  dueDate             DateTime?
  startDate           DateTime?
  estimatedHours      Float?
  actualHours         Float        @default(0) // 自動彙整自 TimeEntry
  progressPct         Float        @default(0) // 自動計算自 SubTask 完成率
  tags                String[]     // PostgreSQL 陣列
  // 追加任務特有欄位
  addedDate           DateTime?
  addedReason         String?
  addedSource         String?      // 來源（如：主管指派、用戶需求、事件通報）
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  // 關聯
  monthlyGoal      MonthlyGoal?   @relation(fields: [monthlyGoalId], references: [id])
  primaryAssignee  User?          @relation("TaskPrimaryAssignee", fields: [primaryAssigneeId], references: [id])
  backupAssignee   User?          @relation("TaskBackupAssignee", fields: [backupAssigneeId], references: [id])
  creator          User           @relation("TaskCreator", fields: [creatorId], references: [id])
  subTasks         SubTask[]
  comments         TaskComment[]
  activities       TaskActivity[]
  taskChanges      TaskChange[]
  timeEntries      TimeEntry[]
  kpiLinks         KPITaskLink[]
  deliverables     Deliverable[]  @relation("TaskDeliverable")

  @@map("tasks")
}

model SubTask {
  id          String   @id @default(cuid())
  taskId      String
  title       String
  done        Boolean  @default(false)
  order       Int      @default(0)
  assigneeId  String?
  dueDate     DateTime?
  createdAt   DateTime @default(now())

  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)

  @@map("sub_tasks")
}

model TaskComment {
  id        String   @id @default(cuid())
  taskId    String
  userId    String
  content   String   // Markdown 支援
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id])

  @@map("task_comments")
}

model TaskActivity {
  id        String   @id @default(cuid())
  taskId    String
  userId    String
  action    String   // "STATUS_CHANGED" | "ASSIGNED" | "COMMENTED" | "DELAY" | "SCOPE_CHANGE" | "SUBTASK_DONE"
  detail    Json?    // { from: "TODO", to: "IN_PROGRESS" }
  createdAt DateTime @default(now())

  task Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  user User @relation(fields: [userId], references: [id])

  @@map("task_activities")
}

// ═══════════════════════════════════════
// 延期與變更追蹤
// ═══════════════════════════════════════

enum ChangeType {
  DELAY        // 截止日延後
  SCOPE_CHANGE // 範圍變更（工時、描述、子任務增減）
}

model TaskChange {
  id          String     @id @default(cuid())
  taskId      String
  changeType  ChangeType
  reason      String
  oldValue    String?    // 舊值（如舊截止日 ISO 字串）
  newValue    String?    // 新值
  changedBy   String
  changedAt   DateTime   @default(now())

  task      Task @relation(fields: [taskId], references: [id], onDelete: Cascade)
  changedByUser User @relation(fields: [changedBy], references: [id])

  @@map("task_changes")
}

// ═══════════════════════════════════════
// 交付項
// ═══════════════════════════════════════

enum DeliverableType {
  DOCUMENT    // 文件
  SYSTEM      // 系統
  REPORT      // 報告
  APPROVAL    // 簽核單
}

enum DeliverableStatus {
  NOT_STARTED  // 未開始
  IN_PROGRESS  // 進行中
  DELIVERED    // 已交付
  ACCEPTED     // 已驗收
}

model Deliverable {
  id            String            @id @default(cuid())
  title         String
  type          DeliverableType
  status        DeliverableStatus @default(NOT_STARTED)
  attachmentUrl String?
  acceptedBy    String?
  acceptedAt    DateTime?
  // 所屬層級（四擇一，其餘為 null）
  kpiId         String?
  annualPlanId  String?
  monthlyGoalId String?
  taskId        String?
  createdAt     DateTime          @default(now())
  updatedAt     DateTime          @updatedAt

  kpi         KPI?         @relation("KPIDeliverable", fields: [kpiId], references: [id])
  annualPlan  AnnualPlan?  @relation("AnnualPlanDeliverable", fields: [annualPlanId], references: [id])
  monthlyGoal MonthlyGoal? @relation("MonthlyGoalDeliverable", fields: [monthlyGoalId], references: [id])
  task        Task?        @relation("TaskDeliverable", fields: [taskId], references: [id])
  acceptor    User?        @relation("DeliverableAcceptor", fields: [acceptedBy], references: [id])

  @@map("deliverables")
}

// ═══════════════════════════════════════
// 工時紀錄
// ═══════════════════════════════════════

enum TimeCategory {
  PLANNED_TASK  // 原始規劃任務
  ADDED_TASK    // 追加任務
  INCIDENT      // 突發事件
  SUPPORT       // 用戶支援
  ADMIN         // 行政庶務
  LEARNING      // 學習成長
}

model TimeEntry {
  id          String       @id @default(cuid())
  taskId      String?      // 可為 null（無任務的行政工時）
  userId      String
  date        DateTime     @db.Date
  hours       Float
  category    TimeCategory @default(PLANNED_TASK)
  description String?
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  task Task? @relation(fields: [taskId], references: [id])
  user User  @relation(fields: [userId], references: [id])

  @@map("time_entries")
}

// ═══════════════════════════════════════
// 通知
// ═══════════════════════════════════════

enum NotificationType {
  TASK_ASSIGNED      // 任務指派
  TASK_DUE_SOON     // 任務即將到期
  TASK_OVERDUE      // 任務逾期
  TASK_COMMENTED    // 任務被評論
  MILESTONE_DUE     // 里程碑即將到期
  BACKUP_ACTIVATED  // B 角被啟用
  TASK_CHANGED      // 任務延期或變更
}

model Notification {
  id         String           @id @default(cuid())
  userId     String
  type       NotificationType
  title      String
  body       String?
  relatedId  String?          // 關聯任務/里程碑 ID
  relatedType String?         // "Task" | "Milestone"
  isRead     Boolean          @default(false)
  createdAt  DateTime         @default(now())

  user User @relation(fields: [userId], references: [id])

  @@map("notifications")
}

// ═══════════════════════════════════════
// 知識庫文件
// ═══════════════════════════════════════

model Document {
  id        String   @id @default(cuid())
  parentId  String?
  title     String
  content   String   // Markdown
  slug      String   @unique
  createdBy String
  updatedBy String
  version   Int      @default(1)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  parent   Document?         @relation("DocTree", fields: [parentId], references: [id])
  children Document[]        @relation("DocTree")
  creator  User              @relation("DocCreator", fields: [createdBy], references: [id])
  updater  User              @relation("DocUpdater", fields: [updatedBy], references: [id])
  versions DocumentVersion[]

  @@map("documents")
}

model DocumentVersion {
  id         String   @id @default(cuid())
  documentId String
  content    String
  version    Int
  createdBy  String
  createdAt  DateTime @default(now())

  document Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  creator  User     @relation(fields: [createdBy], references: [id])

  @@map("document_versions")
}
```

### 3.2 ER 圖（簡要文字版）

```
User ──────────────────────────────────────────────────────────────┐
 │                                                                  │
 │ createdBy             primaryAssigneeId / backupAssigneeId       │
 ▼                         ▼                                        │
AnnualPlan             Task ──────────── KPITaskLink ──── KPI       │
 │                      │   │   │   │                    │          │
 │                      │   │   │   └─── SubTask         │          │
 │                      │   │   ├─── TaskComment         │          │
 ├─── MonthlyGoal ──────┘   │   ├─── TaskActivity        │          │
 │       │                  │   ├─── TaskChange           │          │
 │       └─── Deliverable   │   ├─── TimeEntry            │          │
 │                          │   └─── Deliverable          │          │
 ├─── Milestone             │                             │          │
 └─── Deliverable           └─── Deliverable (KPI)       │          │
                                                          │          │
User ◄─── Notification                                    │          │
User ◄─── Permission (grantee/granter)                    │          │
Document ─── DocumentVersion                              │          │
```

---

## 4. API 設計（40+ 端點）

所有 API 均為 RESTful，路徑前綴 `/api`，回傳 JSON。

**共通回應格式：**
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "pagination": { "page": 1, "pageSize": 20, "total": 100 }
}
```

**認證：** 透過 HTTP-only Cookie 傳遞 Session Token，所有 `/api/*` 路由均需驗證，除了 `/api/auth/login`。

---

### 4.1 認證 `/api/auth`

| 方法 | 路徑 | 說明 |
|------|------|------|
| POST | `/api/auth/login` | 登入（返回 user 資訊，設置 Cookie） |
| POST | `/api/auth/logout` | 登出（清除 Cookie） |
| GET  | `/api/auth/me` | 取得目前登入使用者資訊與權限 |

---

### 4.2 使用者 `/api/users`

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET | `/api/users` | 列出所有使用者 | 全員 |
| GET | `/api/users/:id` | 取得單一使用者 | 全員 |
| POST | `/api/users` | 建立使用者 | Manager |
| PATCH | `/api/users/:id` | 更新使用者資料 | Manager / 本人 |
| DELETE | `/api/users/:id` | 停用使用者 | Manager |
| GET | `/api/users/:id/workload` | 取得工作負載（任務數、工時、投入率） | Manager / 本人 |
| POST | `/api/users/:id/permissions` | 授權 Engineer 查看範圍 | Manager |
| GET | `/api/users/:id/permissions` | 查看已授予的權限 | Manager |

---

### 4.3 KPI `/api/kpis`

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET | `/api/kpis` | 列出 KPI（可 filter by year） | 全員 |
| GET | `/api/kpis/:id` | 取得 KPI 詳情（含連結任務、交付項） | 全員 |
| POST | `/api/kpis` | 建立 KPI | Manager |
| PATCH | `/api/kpis/:id` | 更新 KPI | Manager |
| DELETE | `/api/kpis/:id` | 刪除 KPI | Manager |
| POST | `/api/kpis/:id/links` | 連結任務至 KPI | Manager |
| DELETE | `/api/kpis/:id/links/:taskId` | 解除任務連結 | Manager |
| GET | `/api/kpis/:id/achievement` | 計算達成率（含明細） | 全員 |

**GET /api/kpis/:id/achievement 回應範例：**
```json
{
  "success": true,
  "data": {
    "kpiId": "kpi_xxx",
    "code": "KPI-2026-01",
    "title": "系統可用率",
    "target": 99.5,
    "actual": 99.7,
    "achievementRate": 1.002,
    "status": "ACHIEVED",
    "linkedTasks": [
      { "taskId": "task_xxx", "title": "更新核心交換機韌體", "progressPct": 100, "weight": 1 }
    ]
  }
}
```

---

### 4.4 年度計畫 `/api/plans`

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET | `/api/plans` | 列出所有年度計畫 | 全員 |
| GET | `/api/plans/:id` | 取得年度計畫（含月度目標、里程碑、交付項） | 全員 |
| POST | `/api/plans` | 建立年度計畫 | Manager |
| POST | `/api/plans/copy-template` | 從前一年複製架構 | Manager |
| PATCH | `/api/plans/:id` | 更新年度計畫 | Manager |
| DELETE | `/api/plans/:id` | 刪除年度計畫 | Manager |
| GET | `/api/plans/:id/progress` | 取得年度計畫整體進度（含各月進度） | 全員 |

**POST /api/plans/copy-template 請求範例：**
```json
{
  "fromYear": 2025,
  "toYear": 2026,
  "title": "2026 IT 部門年度計畫"
}
```

---

### 4.5 月度目標 `/api/goals`

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET | `/api/goals` | 列出月度目標（filter by planId, month, status） | 全員 |
| GET | `/api/goals/:id` | 取得月度目標（含任務列表、交付項） | 全員 |
| POST | `/api/goals` | 建立月度目標 | Manager |
| PATCH | `/api/goals/:id` | 更新月度目標 | Manager |
| DELETE | `/api/goals/:id` | 刪除月度目標 | Manager |
| PATCH | `/api/goals/:id/status` | 更新目標狀態 | Manager |

---

### 4.6 里程碑 `/api/milestones`

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET | `/api/milestones` | 列出里程碑（filter by planId, status） | 全員 |
| GET | `/api/milestones/:id` | 取得里程碑詳情 | 全員 |
| POST | `/api/milestones` | 建立里程碑 | Manager |
| PATCH | `/api/milestones/:id` | 更新里程碑（含 actualStart/End） | Manager |
| DELETE | `/api/milestones/:id` | 刪除里程碑 | Manager |

---

### 4.7 任務 `/api/tasks`

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET | `/api/tasks` | 列出任務（多種 filter） | 全員（受權限控管） |
| GET | `/api/tasks/:id` | 取得任務詳情（含子任務、交付項） | 全員（受權限控管） |
| POST | `/api/tasks` | 建立任務 | 全員 |
| PATCH | `/api/tasks/:id` | 更新任務資料 | 全員 |
| DELETE | `/api/tasks/:id` | 刪除任務 | Manager / 建立者 |
| PATCH | `/api/tasks/:id/status` | 更新任務狀態（自動計算月度目標進度） | 全員 |
| PATCH | `/api/tasks/:id/assign` | 指派/更換 A 角 B 角 | Manager |
| PATCH | `/api/tasks/:id/delay` | 記錄延期（寫入 TaskChange） | Manager / A 角 |
| PATCH | `/api/tasks/:id/scope-change` | 記錄範圍變更（寫入 TaskChange） | Manager |
| GET | `/api/tasks/kanban` | 取得看板視圖資料（含分類、A/B 角） | 全員 |
| GET | `/api/tasks/gantt` | 取得甘特圖視圖資料 | 全員 |
| POST | `/api/tasks/import-excel` | 從 Excel 匯入任務 | Manager |
| GET | `/api/tasks/import-template` | 下載 Excel 匯入範本 | 全員 |

**GET /api/tasks Query Params：**
```
?assigneeId=xxx
&status=IN_PROGRESS
&priority=P0,P1
&category=PLANNED,ADDED
&tag=infrastructure
&goalId=xxx
&dueDateFrom=2026-03-01
&dueDateTo=2026-03-31
&page=1
&pageSize=20
```

**POST /api/tasks 請求範例（追加任務）：**
```json
{
  "title": "緊急處理核心路由器告警",
  "category": "ADDED",
  "addedDate": "2026-03-24T09:00:00Z",
  "addedReason": "核心路由器 CPU 超過 95% 告警，需立即調查",
  "addedSource": "監控系統告警",
  "primaryAssigneeId": "user_bob",
  "backupAssigneeId": "user_dave",
  "priority": "P0",
  "dueDate": "2026-03-24T18:00:00Z",
  "estimatedHours": 4
}
```

**PATCH /api/tasks/:id/delay 請求範例：**
```json
{
  "newDueDate": "2026-03-31",
  "reason": "需等待廠商提供最新韌體版本，預計 3/28 到貨"
}
```

---

### 4.8 子任務 `/api/subtasks`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/subtasks?taskId=xxx` | 取得任務的子任務列表 |
| POST | `/api/subtasks` | 建立子任務 |
| PATCH | `/api/subtasks/:id` | 更新子任務（標題、排序、指派人） |
| PATCH | `/api/subtasks/:id/toggle` | 切換完成狀態（自動更新母任務進度） |
| DELETE | `/api/subtasks/:id` | 刪除子任務 |

---

### 4.9 交付項 `/api/deliverables`

| 方法 | 路徑 | 說明 | 權限 |
|------|------|------|------|
| GET | `/api/deliverables` | 列出交付項（filter by kpiId/planId/goalId/taskId） | 全員 |
| GET | `/api/deliverables/:id` | 取得交付項詳情 | 全員 |
| POST | `/api/deliverables` | 建立交付項 | 全員 |
| PATCH | `/api/deliverables/:id` | 更新交付項（含上傳附件 URL） | 全員 |
| PATCH | `/api/deliverables/:id/accept` | 驗收交付項（記錄 acceptedBy, acceptedAt） | Manager |
| DELETE | `/api/deliverables/:id` | 刪除交付項 | Manager |

---

### 4.10 工時紀錄 `/api/time-entries`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/time-entries` | 列出工時紀錄（filter by userId, taskId, category, date） |
| POST | `/api/time-entries` | 新增工時紀錄 |
| PATCH | `/api/time-entries/:id` | 更新工時紀錄 |
| DELETE | `/api/time-entries/:id` | 刪除工時紀錄 |
| GET | `/api/time-entries/stats` | 工時統計（含投入率計算） |

**GET /api/time-entries/stats 回應範例：**
```json
{
  "success": true,
  "data": {
    "period": { "from": "2026-03-01", "to": "2026-03-31" },
    "teamAvgEngagementRate": 0.71,
    "byUser": [
      {
        "userId": "user_bob",
        "name": "Bob",
        "totalHours": 168,
        "byCategory": {
          "PLANNED_TASK": 110,
          "ADDED_TASK": 25,
          "INCIDENT": 15,
          "SUPPORT": 10,
          "ADMIN": 5,
          "LEARNING": 3
        },
        "engagementRate": 0.655,
        "unplannedRate": 0.298
      }
    ]
  }
}
```

---

### 4.11 通知 `/api/notifications`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/notifications` | 取得目前使用者通知（未讀/全部） |
| PATCH | `/api/notifications/:id/read` | 標記為已讀 |
| PATCH | `/api/notifications/read-all` | 全部標記已讀 |
| DELETE | `/api/notifications/:id` | 刪除通知 |

---

### 4.12 知識庫 `/api/documents`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/documents/tree` | 取得文件樹狀結構 |
| GET | `/api/documents/search?q=xxx` | 全文搜尋（PostgreSQL tsvector） |
| GET | `/api/documents/:idOrSlug` | 取得文件內容 |
| POST | `/api/documents` | 建立文件 |
| PATCH | `/api/documents/:id` | 更新文件（自動儲存版本） |
| DELETE | `/api/documents/:id` | 刪除文件 |
| GET | `/api/documents/:id/versions` | 取得版本歷史 |
| GET | `/api/documents/:id/versions/:ver` | 取得特定版本內容 |

---

### 4.13 報表 `/api/reports`

| 方法 | 路徑 | 說明 |
|------|------|------|
| GET | `/api/reports/weekly` | 週報（本週或指定週） |
| GET | `/api/reports/monthly` | 月報（本月或指定月） |
| GET | `/api/reports/kpi` | KPI 達成報表（指定年度） |
| GET | `/api/reports/unplanned-workload` | 計畫外負荷報表 |
| GET | `/api/reports/delay-change` | 延期與變更統計 |
| GET | `/api/reports/export/pdf` | 匯出 PDF（帶 report type 參數） |
| GET | `/api/reports/export/excel` | 匯出 Excel（帶 report type 參數） |

**GET /api/reports/unplanned-workload 回應範例：**
```json
{
  "success": true,
  "data": {
    "period": { "year": 2026, "month": 3 },
    "plannedTaskCount": 20,
    "unplannedTaskCount": 8,
    "unplannedRatio": 0.286,
    "plannedHours": 110,
    "unplannedHours": 45,
    "unplannedHourRatio": 0.290,
    "bySource": [
      { "source": "監控系統告警", "count": 3, "hours": 18 },
      { "source": "用戶支援請求", "count": 4, "hours": 20 },
      { "source": "主管臨時指派", "count": 1, "hours": 7 }
    ],
    "byCategory": {
      "ADDED": { "count": 4, "hours": 22 },
      "INCIDENT": { "count": 2, "hours": 15 },
      "SUPPORT": { "count": 2, "hours": 8 }
    }
  }
}
```

**GET /api/reports/delay-change 回應範例：**
```json
{
  "success": true,
  "data": {
    "period": { "year": 2026, "month": 3 },
    "delayCount": 3,
    "scopeChangeCount": 2,
    "details": [
      {
        "taskId": "task_xxx",
        "taskTitle": "更新核心交換機韌體",
        "changeType": "DELAY",
        "oldValue": "2026-03-21",
        "newValue": "2026-03-28",
        "reason": "等待廠商提供韌體",
        "changedBy": "Bob",
        "changedAt": "2026-03-21T17:00:00Z"
      }
    ]
  }
}
```

---

## 5. 頁面線框圖（6 頁 ASCII Wireframes）

### Page 1：Dashboard（首頁）

#### 5.1-A 主管視角

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ TITAN                      [通知鈴 (3)]          Alice（主管）  [登出]             │
├──────────┬─────────────────────────────────────────────────────────────────────────┤
│          │                                                                         │
│ 首頁  ◄  │  本週概覽  （2026-03-18 ～ 03-24）                                       │
│ 看板     │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │
│ 甘特圖   │  │  完成率       │ │  逾期任務     │ │  本月延期     │ │  本月追加     │   │
│ 知識庫   │  │              │ │              │ │              │ │              │   │
│ 工時紀錄 │  │    72%       │ │    3 件       │ │   3件  2變更  │ │   8件  29%   │   │
│ 報表     │  │  ████████░░  │ │  ⚠ 需處理    │ │  ⚠ 本月統計  │ │  計畫外負荷  │   │
│          │  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │
│          │                                                                         │
│          │  ─── KPI 達成概況 (2026) ─────────────────────────────────────────     │
│          │                                                                         │
│          │  KPI-01 系統可用率     99.7% / 99.5%  ████████████████████  達成 ✓      │
│          │  KPI-02 事件解決時效   92% / 95%      ████████████████░░░░  進行中 ⚠    │
│          │  KPI-03 資安稽核完成   75% / 100%     ███████████░░░░░░░░░  進行中      │
│          │                                                                         │
│          │  ─── 團隊工作負載 ─────────────────────────────────────────────────    │
│          │                                                                         │
│          │       任務   工時投入率  計畫外%                                         │
│          │  Alice  8件   ███████░░  88% | 計畫外 18%                               │
│          │  Bob   11件   █████████  92% | 計畫外 35%  ⚠ 計畫外偏高                 │
│          │  Carol  6件   ██████░░░  72% | 計畫外 12%                               │
│          │  Dave   9件   ████████░  85% | 計畫外 22%                               │
│          │  Eve    4件   ████░░░░░  55% | 計畫外  8%                               │
│          │                                                                         │
│          │  ─── 逾期任務 ─────────────────────────────────────────────────────    │
│          │                                                                         │
│          │  [P0] 更新核心交換機韌體     ── Bob（A角）Dave（B角）── 逾期3天  [處理] │
│          │  [P1] 完成 AD 帳號清查報告  ── Carol（A角）── 逾期1天            [處理] │
│          │  [P1] SSL 憑證續約          ── Dave（A角）Bob（B角）── 逾期1天   [處理] │
│          │                                                                         │
│          │  ─── 即將到期里程碑（7天內）───────────────────────────────────────    │
│          │                                                                         │
│          │  03/28  Q1 資安稽核完成里程碑   2026 年度計畫   ⚠ 7天後                 │
│          │                                                                         │
│          │  ─── 即將到期任務（7天內）─────────────────────────────────────────    │
│          │                                                                         │
│          │  03/25  [P1] 資安政策文件更新     Alice                                 │
│          │  03/26  [P2] 備份系統測試         Eve                                   │
│          │  03/28  [P0] 季度漏洞掃描         Dave                                  │
│          │                                                                         │
└──────────┴─────────────────────────────────────────────────────────────────────────┘
```

#### 5.1-B 工程師視角（以 Bob 為例）

```
┌────────────────────────────────────────────────────────────────────────────────────┐
│ TITAN                      [通知鈴 (2)]          Bob（工程師）  [登出]             │
├──────────┬─────────────────────────────────────────────────────────────────────────┤
│          │                                                                         │
│ 首頁  ◄  │  早安，Bob！（2026-03-24 週一）                                         │
│ 看板     │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                   │
│ 甘特圖   │  │  今日待辦     │ │  本週工時     │ │  逾期任務     │                   │
│ 知識庫   │  │              │ │              │ │              │                   │
│ 工時紀錄 │  │    5 件       │ │  22.5/40h    │ │    1 件       │                   │
│ 報表     │  │  需完成       │ │  ████████░░  │ │  ⚠ 請處理    │                   │
│          │  └──────────────┘ └──────────────┘ └──────────────┘                   │
│          │                                                                         │
│          │  ─── 今日任務（依優先級排序）───────────────────────────────────────   │
│          │                                                                         │
│          │  [P0] [PLANNED] 更新核心交換機韌體   [IN_PROGRESS] 03/21 ⚠逾期          │
│          │       A角: 我  B角: Dave   預估4h・已記2h         [記工時] [開啟]        │
│          │                                                                         │
│          │  [P0] [ADDED]   路由器告警調查       [TODO]        03/24 今日到期        │
│          │       A角: 我   追加自: 監控系統告警  預估4h        [記工時] [開啟]       │
│          │                                                                         │
│          │  [P1] [PLANNED] 網路監控告警調整     [TODO]        03/25                │
│          │       A角: 我   預估3h・尚未開始               [記工時] [開啟]          │
│          │                                                                         │
│          │  [P2] [PLANNED] 更新機房設備清冊     [IN_PROGRESS] 03/28                │
│          │       A角: 我   預估2h・已記0.5h               [記工時] [開啟]          │
│          │                                                                         │
│          │  [P3] [ADMIN]   整理測試環境文件     [BACKLOG]     無截止日              │
│          │       A角: 我   預估2h                           [記工時] [開啟]        │
│          │                                                                         │
└──────────┴─────────────────────────────────────────────────────────────────────────┘
```

---

### Page 2：Kanban（任務看板）

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│ TITAN                               [通知鈴]              Alice（主管）  [登出]            │
├──────────┬────────────────────────────────────────────────────────────────────────────────┤
│          │  任務看板                           [看板] [甘特圖]   [匯入Excel]  [+ 新增任務] │
│ 首頁     │                                                                                │
│ 看板  ◄  │  篩選：[全部成員 ▼] [全部優先級 ▼] [全部分類 ▼] [全部標籤 ▼] [日期範圍 ▼]     │
│ 甘特圖   │  分類圖例：[PLANNED] [ADDED] [INCIDENT] [SUPPORT] [ADMIN] [LEARNING]           │
│ 知識庫   │                                                                                │
│ 工時紀錄 │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐  ┌──────┐│
│ 報表     │  │  BACKLOG (3) │  │  TODO (5)    │  │ IN_PROGRESS  │  │REVIEW (2)│  │DONE  ││
│          │  │              │  │              │  │    (4)       │  │          │  │  (8) ││
│          │  ├──────────────┤  ├──────────────┤  ├──────────────┤  ├──────────┤  ├──────┤│
│          │  │┌────────────┐│  │┌────────────┐│  │┌────────────┐│  │┌────────┐│  │...   ││
│          │  ││[P3][ADMIN] ││  ││[P1][PLAN]  ││  ││[P0][PLAN] ⚠││  ││[P1]    ││  │      ││
│          │  ││整理測試    ││  ││網路監控    ││  ││更新核心    ││  ││資安政策││  │      ││
│          │  ││環境文件    ││  ││告警調整    ││  ││交換機韌體  ││  ││文件審查││  │      ││
│          │  ││            ││  ││            ││  ││逾期 3 天   ││  ││        ││  │      ││
│          │  ││A: Bob      ││  ││ 03/25      ││  ││A: Bob      ││  ││A: Alice││  │      ││
│          │  ││B: -        ││  ││A: Bob B:-  ││  ││B: Dave     ││  ││B: -    ││  │      ││
│          │  │└────────────┘│  │└────────────┘│  │└────────────┘│  │└────────┘│  │      ││
│          │  │┌────────────┐│  │┌────────────┐│  │┌────────────┐│  │┌────────┐│  │      ││
│          │  ││[P2][PLAN]  ││  ││[P0][ADDED] ││  ││[P1][PLAN]  ││  ││[P2]    ││  │      ││
│          │  ││閱讀資安    ││  ││路由器告警  ││  ││機房設備    ││  ││AD帳號  ││  │      ││
│          │  ││政策文件    ││  ││調查        ││  ││清冊更新    ││  ││清查報告││  │      ││
│          │  ││            ││  ││追加:監控系統││  ││            ││  ││逾期1天 ││  │      ││
│          │  ││A: Bob B:-  ││  ││A:Bob B:Dave││  ││A:Bob B:Dave││  ││A:Carol ││  │      ││
│          │  │└────────────┘│  │└────────────┘│  │└────────────┘│  │└────────┘│  │      ││
│          │  │ [+ 新增]     │  │              │  │              │  │          │  │      ││
│          │  └──────────────┘  └──────────────┘  └──────────────┘  └──────────┘  └──────┘│
│          │                                                                                │
│          │  拖曳卡片可移動狀態；點擊任務可開啟詳情側板                                    │
└──────────┴────────────────────────────────────────────────────────────────────────────────┘
```

---

### Page 3：Gantt（甘特圖）

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│ TITAN                                                        [通知鈴]  Alice（主管）  [登出]  │
├──────────┬───────────────────────────────────────────────────────────────────────────────────┤
│          │  甘特圖                              [看板] [甘特圖]  時間範圍：[月] [季] [年]     │
│ 首頁     │  2026-03-18 ～ 2026-04-30  [< 上一週] [本週] [下一週 >]  篩選：[全部成員 ▼]       │
│ 看板     │                                                                                   │
│ 甘特圖◄  ├─────────────────────────────────┬───────────────────────────────────────────────┤│
│ 知識庫   │ 年度計畫 / 里程碑 / 任務          │03/18 03/21 03/24 03/28 04/01 04/07 04/14 04/30││
│ 工時紀錄 │                                  │ 週三  週六  週二  週六  週三  週二  週二         ││
│ 報表     ├─────────────────────────────────┼───────────────────────────────────────────────┤│
│          │ ◆ 2026 IT 年度計畫               │═════════════════════════════════════════════   ││
│          │   ◇ 里程碑: Q1資安稽核完成       │               ◇━━━━━━━━━━━━━━━(03/28) ⚠7天   ││
│          │   ◇ 里程碑: H1 網路更新完成      │                                ◇─────(06/30)  ││
│          ├─────────────────────────────────┼───────────────────────────────────────────────┤│
│          │ 3月月度目標：資安稽核準備         │                                               ││
│          │   [P1][PLAN] Alice 資安稽核報告  │ ████████████████                              ││
│          │   [P1][PLAN] Carol AD帳號清查    │ ████████████████████                  ← 逾期⚠ ││
│          ├─────────────────────────────────┼───────────────────────────────────────────────┤│
│          │ 3月月度目標：網路基礎設施更新     │                                               ││
│          │   [P0][PLAN] Bob 交換機韌體更新  │ ████████████████░░░░░░░░░░░░░░        ← 逾期⚠ ││
│          │   [P0][ADD]  Bob 路由器告警調查  │               ████                            ││
│          │   [P2][PLAN] Bob 機房設備清冊    │         ░░░░░░░░░░░░░░░░░████████            ││
│          │   [P1][PLAN] Dave DR演練準備     │               ░░░░░░░░░░░░░░░░░████████       ││
│          │   [P2][PLAN] Dave SSL憑證續約    │ ████████████████████████████                  ││
│          ├─────────────────────────────────┼───────────────────────────────────────────────┤│
│          │  ████ 進行中  ░░░░ 計畫中  ████ 完成  ← 逾期  ◇ 里程碑  │ 今日                  ││
└──────────┴───────────────────────────────────────────────────────────────────────────────────┘
```

---

### Page 4：Knowledge Base（知識庫）

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ TITAN                                                 [通知鈴]  Alice（主管）  [登出]    │
├──────────┬──────────────────────────────────────────────────────────────────────────────┤
│          │                                                                              │
│ 首頁     │  搜尋知識庫...                                                               │
│ 看板     │                                                                              │
│ 甘特圖   ├──────────────────────────┬───────────────────────────────────────────────── │
│ 知識庫 ◄ │                          │                                                  │
│ 工時紀錄 │ 文件樹                   │  防火牆設定規範                   [編輯] [版本歷史]│
│ 報表     │ ──────────────────────── │  ──────────────────────────────────────────────  │
│          │ 📁 基礎設施              │  更新者：Dave  ·  2026-03-10  ·  版本 3           │
│          │   📄 網路架構說明        │                                                  │
│          │   📄 防火牆設定規範  ◄   │  ## 概述                                         │
│          │   📄 VPN 操作手冊        │  本文件定義銀行 IT 部門防火牆設定的標準...        │
│          │ 📁 資訊安全              │                                                  │
│          │   📄 資安政策總覽        │  ## 防火牆規則原則                               │
│          │   📁 事件應變            │  1. **預設拒絕（Default Deny）**                  │
│          │     📄 DDoS 應變流程     │  2. **最小權限原則**                              │
│          │     📄 勒索軟體應變      │  3. **稽核日誌**                                  │
│          │ 📁 系統維護              │                                                  │
│          │   📄 備份作業規範        │  ## 標準連接埠白名單                              │
│          │   📄 季度維護清單        │  | 連接埠 | 協定 | 用途       |                  │
│          │ 📁 使用者管理            │  |--------|------|-----------|                  │
│          │   📄 帳號申請流程        │  | 443    | TCP  | HTTPS     |                  │
│          │   📄 權限管理規範        │  | 8443   | TCP  | 管理介面  |                  │
│          │                          │  | 22     | TCP  | SSH（限IT）|                │
│          │ [+ 新增文件]             │                                                  │
│          │ [+ 新增資料夾]           │  ── 版本歷史 ─────────────────────────────────  │
│          │                          │  v3  2026-03-10  Dave  新增 IPv6 規則說明        │
│          │                          │  v2  2026-02-15  Alice 更新管理介面連接埠         │
│          │                          │  v1  2026-01-05  Dave  初版建立                 │
└──────────┴──────────────────────────┴──────────────────────────────────────────────────┘
```

---

### Page 5：Timesheet（工時紀錄，含 6 類別）

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ TITAN                              [通知鈴]                Bob（工程師）  [登出]          │
├──────────┬───────────────────────────────────────────────────────────────────────────────┤
│          │                                                                               │
│ 首頁     │  工時紀錄                             [< 上一週]  [本週]  [下一週 >]           │
│ 看板     │  2026-03-18（週一） ～ 2026-03-22（週五）                                     │
│ 甘特圖   │  人員：[Bob ▼]  （主管可切換查看全員）                                        │
│ 知識庫   │                                                                               │
│ 工時紀錄◄│  ┌──────────────────────────┬──────┬──────┬──────┬──────┬──────┬──────┐     │
│ 報表     │  │ 任務 / 工時類別           │ 週一  │ 週二  │ 週三  │ 週四  │ 週五  │ 合計 │     │
│          │  │                          │03/18 │03/19 │03/20 │03/21 │03/22 │      │     │
│          │  ├──────────────────────────┼──────┼──────┼──────┼──────┼──────┼──────┤     │
│          │  │[PLANNED] 更新交換機韌體  │  4.0 │  3.0 │  1.0 │      │      │  8.0 │     │
│          │  ├──────────────────────────┼──────┼──────┼──────┼──────┼──────┼──────┤     │
│          │  │[ADDED]   路由器告警調查  │      │      │      │  4.0 │      │  4.0 │     │
│          │  ├──────────────────────────┼──────┼──────┼──────┼──────┼──────┼──────┤     │
│          │  │[PLANNED] 機房設備清冊    │      │  2.0 │  2.0 │  2.5 │      │  6.5 │     │
│          │  ├──────────────────────────┼──────┼──────┼──────┼──────┼──────┼──────┤     │
│          │  │[PLANNED] 網路監控調整    │      │      │  1.0 │  2.0 │  4.0 │  7.0 │     │
│          │  ├──────────────────────────┼──────┼──────┼──────┼──────┼──────┼──────┤     │
│          │  │[ADMIN]   週例會          │      │  1.0 │      │      │  1.0 │  2.0 │     │
│          │  ├──────────────────────────┼──────┼──────┼──────┼──────┼──────┼──────┤     │
│          │  │[+ 新增工時]              │      │      │      │      │      │      │     │
│          │  ├──────────────────────────┼──────┼──────┼──────┼──────┼──────┼──────┤     │
│          │  │ 每日合計                 │  4.0 │  6.0 │  4.0 │  8.5 │  5.0 │ 27.5 │     │
│          │  └──────────────────────────┴──────┴──────┴──────┴──────┴──────┴──────┘     │
│          │                                                                               │
│          │  ── 本週投入率分析 ─────────────────────────────────────────────────────    │
│          │  PLANNED_TASK  21.5h  ████████████████████████  78.2%  （實際投入率）        │
│          │  ADDED_TASK     4.0h  ████                       14.5%                       │
│          │  ADMIN          2.0h  ██                          7.3%                       │
│          │  合計          27.5h                             68.8% 達標準40h              │
│          │                                                                               │
│          │  ── 快速輸入 popup（點擊格子後出現）─────────────────────────────────────   │
│          │  ┌─────────────────────────────────────┐                                    │
│          │  │ 記錄工時                          [×]│                                    │
│          │  │ 任務：機房設備清冊更新               │                                    │
│          │  │ 日期：2026-03-22  類別：[PLANNED ▼]  │                                    │
│          │  │ 工時：[2.0] 小時                     │                                    │
│          │  │ 備註：完成 A 棟機房清點               │                                    │
│          │  │               [取消]  [儲存]          │                                    │
│          │  └─────────────────────────────────────┘                                    │
└──────────┴───────────────────────────────────────────────────────────────────────────────┘
```

---

### Page 6：Reports（報表）

```
┌──────────────────────────────────────────────────────────────────────────────────────────┐
│ TITAN                              [通知鈴]                Alice（主管）  [登出]          │
├──────────┬───────────────────────────────────────────────────────────────────────────────┤
│          │                                                                               │
│ 首頁     │  報表                                                                         │
│ 看板     │  [週報] [月報] [KPI達成] [計畫外負荷]        [匯出 PDF] [匯出 Excel]           │
│ 甘特圖   │                                                                               │
│ 知識庫   │  ══════════════════ 計畫外負荷報表（2026 年 3 月）══════════════════          │
│ 工時紀錄 │                                                                               │
│ 報表   ◄ │  本月計畫任務：20 件  計畫外任務：8 件   計畫外比例：28.6%                   │
│          │  計畫任務工時：110h  計畫外工時：45h     計畫外工時比例：29.0%               │
│          │                                                                               │
│          │  ─── 計畫外任務來源 ──────────────────────────────────────────────────     │
│          │                                                                               │
│          │  監控系統告警   ████████████  3件  18h                                       │
│          │  用戶支援請求   ████████████████  4件  20h                                   │
│          │  主管臨時指派   ████  1件  7h                                                 │
│          │                                                                               │
│          │  ─── 各人計畫外負荷 ─────────────────────────────────────────────────      │
│          │                                                                               │
│          │       計畫外任務   計畫外工時   計畫外工時比                                  │
│          │  Bob    3件 ⚠      22h ⚠        35.5%  ⚠（偏高）                            │
│          │  Dave   2件        12h          18.2%                                        │
│          │  Carol  2件         8h          13.2%                                        │
│          │  Alice  1件         3h           5.7%                                        │
│          │  Eve    0件         0h           0.0%                                        │
│          │                                                                               │
│          │  ═══════════════════════ KPI 達成報表（2026） ═══════════════════════       │
│          │                                                                               │
│          │  KPI-01 系統可用率（權重 30%）     目標 99.5%   實際 99.7%   達成 ✓ 100.2%   │
│          │  KPI-02 事件解決時效（權重 25%）   目標 95%     實際 92%     進行中 ⚠ 96.8%  │
│          │  KPI-03 資安稽核完成（權重 20%）   目標 100%    實際 75%     進行中  75.0%   │
│          │  KPI-04 員工訓練時數（權重 15%）   目標 40h     實際 35h     進行中  87.5%   │
│          │  KPI-05 系統變更成功率（權重 10%） 目標 98%     實際 99.2%   達成 ✓ 101.2%   │
│          │  ──────────────────────────────────────────────────────────────────────     │
│          │  加權年度達成率：90.4%  ████████████████████████████████████████░░░░         │
│          │                                                                               │
│          │  ─── 本月延期與變更摘要 ─────────────────────────────────────────────     │
│          │  延期 3 件：更新交換機韌體（+7天）、AD帳號清查（+2天）、SSL憑證（+1天）       │
│          │  變更 2 件：DR 演練準備（範圍擴大）、漏洞掃描（範圍縮減）                     │
│          │                                                                               │
│          │  ─── 自動產生週報預覽 ──────────────────────────────────────────────────   │
│          │  ┌──────────────────────────────────────────────────────────────────────┐  │
│          │  │  IT 部門週報（2026-03-18 ～ 03-22）                                   │  │
│          │  │  完成事項：5 件 | 進行中：7 件 | 逾期：3 件 | 本週計畫外：2 件        │  │
│          │  │  • Bob 完成網路監控告警規則更新（PLANNED）                             │  │
│          │  │  • Eve 完成季度備份系統測試（PLANNED）                                │  │
│          │  │  • Bob 處理路由器告警突發事件（INCIDENT，4h）                         │  │
│          │  │  需注意：Bob 本月計畫外負荷 35.5%，建議下月調整任務分配               │  │
│          │  └──────────────────────────────────────────────────────────────────────┘  │
│          │                               [編輯後匯出 PDF] [直接匯出 PDF]               │
└──────────┴───────────────────────────────────────────────────────────────────────────────┘
```

---

## 6. 任務拆解與開發計畫（8 週）

總預估開發時間：8 週（1 位全職開發者，每週 40h）

---

### Phase 1：基礎建設（第 1-2 週）

**預估：約 65 小時**

| # | 任務 | 描述 | 預估時間 | 依賴 |
|---|------|------|---------|------|
| 1.1 | 專案初始化 | Next.js 14（App Router）+ TypeScript + Tailwind + shadcn/ui + ESLint + Prettier 設定 | 4h | 無 |
| 1.2 | Docker 環境設定 | 撰寫 `docker-compose.yml`，包含 Next.js app + PostgreSQL 16，支援 air-gapped 環境 | 4h | 1.1 |
| 1.3 | Prisma Schema（v3 完整版） | 建立 v3 全部 17 個 table 的 schema.prisma，執行初始 migration | 5h | 1.2 |
| 1.4 | 資料庫 Seed | 建立 seed 腳本，填入 5 位測試使用者、範例年度計畫、KPI、里程碑、任務 | 4h | 1.3 |
| 1.5 | 認證系統 | 實作 `/api/auth/login`（bcrypt）、`/api/auth/logout`、Session Cookie | 6h | 1.3 |
| 1.6 | Auth Middleware + 權限中介層 | 路由保護 + Permission 表動態檢查（Manager / Engineer 分流） | 5h | 1.5 |
| 1.7 | `useCurrentUser` Hook | 前端 hook，取得目前使用者資訊、角色、授權範圍 | 2h | 1.5 |
| 1.8 | 通知基礎建設 | Notification 模型 + `createNotification` 工具函式 + 站內鈴鐺 UI 元件 | 6h | 1.3 |
| 1.9 | 版面配置（Layout） | 側邊欄 + 頂部導覽（含通知鈴）+ 主內容區，暗色主題，Geist 字體 | 8h | 1.1、1.8 |
| 1.10 | 登入頁面 UI | `/login` 頁面，處理錯誤訊息，登入後跳轉首頁 | 4h | 1.5、1.9 |
| 1.11 | 使用者管理 API | `/api/users` 完整 CRUD + 權限授予 API | 6h | 1.3、1.6 |
| 1.12 | 使用者管理頁面 | Manager 專屬：列出使用者、新增/停用、動態授權設定 | 6h | 1.11、1.9 |
| 1.13 | 錯誤處理通用元件 | Toast 通知、Error Boundary、Loading Skeleton | 4h | 1.9 |

---

### Phase 2：計畫層級與 KPI（第 2-3 週）

**預估：約 60 小時**

| # | 任務 | 描述 | 預估時間 | 依賴 |
|---|------|------|---------|------|
| 2.1 | KPI API | `/api/kpis` 完整 CRUD + 連結任務 + 達成率計算 | 6h | 1.3 |
| 2.2 | 里程碑 API | `/api/milestones` 完整 CRUD，含 7 天前自動通知 cron job | 5h | 1.3、1.8 |
| 2.3 | 年度計畫 API | `/api/plans` 完整 CRUD + copy-template（從上年複製） | 5h | 1.3、2.2 |
| 2.4 | 月度目標 API | `/api/goals` 完整 CRUD + 進度自動彙整（任務完成率） | 4h | 2.3 |
| 2.5 | 交付項 API | `/api/deliverables` 完整 CRUD + 驗收功能 | 4h | 1.3 |
| 2.6 | 計畫管理頁面 | KPI 列表、年度計畫 → 月度目標層級瀏覽、里程碑設定、交付項管理 | 14h | 2.1、2.3、2.4、2.5 |
| 2.7 | TaskChange API | `/api/tasks/:id/delay` + `/scope-change`，寫入 TaskChange 並觸發通知 | 4h | 1.3、1.8 |
| 2.8 | 進度彙整後台邏輯 | SubTask 完成 → 更新 Task.progressPct → MonthlyGoal.progressPct → AnnualPlan.progressPct | 6h | 1.3 |
| 2.9 | Excel 匯入功能 | `POST /api/tasks/import-excel` + 範本下載端點，使用 `xlsx` 套件解析 | 8h | 1.3 |
| 2.10 | Dashboard API | `/api/users/:id/workload`（含投入率）+ 逾期查詢 + 本月延期/追加統計 | 4h | 2.7、2.8 |

---

### Phase 3：核心任務功能（第 3-4 週）

**預估：約 80 小時**

| # | 任務 | 描述 | 預估時間 | 依賴 |
|---|------|------|---------|------|
| 3.1 | 任務 CRUD API | `/api/tasks` 完整 CRUD（含 A/B 角、分類、addedDate/Reason/Source 欄位）| 8h | 2.4 |
| 3.2 | 任務狀態/指派 API | PATCH status + assign（A/B 角），觸發通知 | 4h | 3.1、1.8 |
| 3.3 | 子任務 API | `/api/subtasks` 完整 CRUD + toggle（自動更新母任務進度） | 4h | 3.1、2.8 |
| 3.4 | 看板 API | `GET /api/tasks/kanban`，依狀態分組，含分類徽章、A/B 角 | 3h | 3.1 |
| 3.5 | Kanban 看板 UI | 5 欄看板，`@dnd-kit` 拖曳，任務卡片顯示分類徽章 + A/B 角 | 14h | 3.4 |
| 3.6 | 任務卡片元件 | 優先級色標、分類徽章（6 色）、A/B 角 avatar、截止日、逾期警示 | 6h | 3.5 |
| 3.7 | 任務詳情側板 | Slide-over panel：標題/描述/子任務/留言/交付項/工時/活動/變更記錄 | 14h | 3.6、3.3 |
| 3.8 | 任務留言 API | `/api/tasks/:id/comments` GET + POST | 3h | 3.1 |
| 3.9 | 任務活動記錄 | 後端 hook：狀態變更/指派/留言/延期/變更時自動寫入 TaskActivity | 4h | 3.1 |
| 3.10 | 看板篩選工具列 | 依成員、優先級、分類、標籤、日期篩選，即時更新看板 | 6h | 3.5 |
| 3.11 | 追加任務流程 UI | 建立任務時若選 ADDED 類別，顯示 addedDate/addedReason/addedSource 欄位 | 4h | 3.5 |
| 3.12 | B 角啟用通知流程 | Manager 可標記 A 角不可用，自動通知 B 角，在 Dashboard 顯示 | 4h | 3.2、1.8 |

---

### Phase 4：甘特圖與工時（第 5-6 週）

**預估：約 75 小時**

| # | 任務 | 描述 | 預估時間 | 依賴 |
|---|------|------|---------|------|
| 4.1 | 甘特圖 API | `GET /api/tasks/gantt`，含里程碑、年度計畫時程、任務分類 | 4h | 3.1、2.2 |
| 4.2 | 甘特圖 UI（基礎） | 時間軸 + 月度目標分組 + 任務條（顯示 A 角），使用自製 SVG 或 react-gantt | 16h | 4.1 |
| 4.3 | 甘特圖：里程碑顯示 | 里程碑菱形圖示（◇），含 7 天提醒高亮 | 4h | 4.2、2.2 |
| 4.4 | 甘特圖：年度計畫時程 | 顯示 AnnualPlan 整體時程橫條於頂部 | 4h | 4.2 |
| 4.5 | 甘特圖互動 | 點擊任務條開啟詳情側板，拖曳調整截止日（自動記錄 TaskChange DELAY） | 8h | 4.2、2.7 |
| 4.6 | 工時紀錄 API（6 類別） | `/api/time-entries` 完整 CRUD + stats（含投入率計算） | 6h | 3.1 |
| 4.7 | 工時週表 UI（6 類別） | 週×任務格狀表格，分類色標，點擊彈出快速輸入（含類別選擇） | 12h | 4.6 |
| 4.8 | 工時統計圖表 | 每人工時分類長條圖、投入率儀表、計畫外工時佔比 | 8h | 4.7 |
| 4.9 | 工時人員切換 | Manager 可透過下拉切換查看任何人的工時表（受 Permission 控管） | 3h | 4.7 |
| 4.10 | 知識庫 CRUD API | `/api/documents` 完整 CRUD，含自動版本儲存、全文搜尋（tsvector） | 8h | 1.3 |
| 4.11 | 知識庫頁面 + 編輯器 | 樹狀導覽 + Markdown 左右分割即時預覽編輯器 + 版本歷史 UI | 12h | 4.10 |

---

### Phase 5：報表、Dashboard、完善（第 7-8 週）

**預估：約 75 小時**

| # | 任務 | 描述 | 預估時間 | 依賴 |
|---|------|------|---------|------|
| 5.1 | 報表 API（全部） | 週報、月報、KPI 達成、計畫外負荷、延期/變更統計 API | 10h | 3.1、4.6 |
| 5.2 | 週報頁面 | 自動彙整本週完成/進行中/逾期/計畫外，可編輯後匯出 | 8h | 5.1 |
| 5.3 | 月報頁面 | 月度目標達成率、任務完成統計、每人工時圖表 | 8h | 5.1 |
| 5.4 | KPI 達成報表頁面 | 年度 KPI 達成率、加權綜合分、連結任務進度 | 8h | 5.1 |
| 5.5 | 計畫外負荷報表頁面 | 計畫外任務比例、工時比例、來源分析、各人負荷，供向上呈報 | 8h | 5.1 |
| 5.6 | PDF 匯出 | 使用 `@react-pdf/renderer` 產生 PDF（週報、月報、KPI、負荷報表） | 8h | 5.2、5.3、5.4、5.5 |
| 5.7 | Excel 匯出 | 使用 `xlsx` 套件匯出報表資料 | 4h | 5.1 |
| 5.8 | Dashboard 主管視角 | KPI 概況、延期/追加計數卡、投入率、計畫外高亮，整合所有 API | 10h | 2.10、5.1 |
| 5.9 | Dashboard 工程師視角 | 今日任務（含分類）、A/B 角標示、工時進度、逾期提醒 | 6h | 2.10 |
| 5.10 | 效能優化 | React Query 快取、長清單虛擬捲動、API 分頁最佳化 | 4h | 所有前置 |
| 5.11 | 完整測試 | 手動 E2E 測試所有核心流程（含 Excel 匯入、PDF 匯出、通知觸發） | 8h | 所有前置 |
| 5.12 | Docker 生產設定 + 部署文件 | 生產用 docker-compose.prod.yml、Dockerfile、air-gapped 部署手冊 | 5h | 所有前置 |

### 總計工時估算

| 階段 | 說明 | 預估工時 |
|------|------|---------|
| Phase 1 | 基礎建設、認證、通知基礎、使用者管理 | 65h |
| Phase 2 | KPI、年度計畫、里程碑、進度彙整 | 60h |
| Phase 3 | 核心任務、看板、A/B 角、追加任務流程 | 80h |
| Phase 4 | 甘特圖、工時（6 類別）、知識庫 | 75h |
| Phase 5 | 報表、Dashboard、PDF/Excel 匯出、完善 | 75h |
| **合計** | | **355h** |

> 以 1 位全職開發者（每週 40h）計算約需 **8.9 週**，安排為 8 週密集開發（每週約 44h）或 9 週含 buffer。

---

## 7. UI 設計規範

### 7.1 色彩系統（暗色主題）

```
背景層級：
  最底層背景    zinc-950  (#09090b)
  卡片/面板     zinc-900  (#18181b)
  懸停高亮      zinc-800  (#27272a)
  邊框/分隔線   zinc-700  (#3f3f46)

文字：
  主要文字      zinc-100  (#f4f4f5)
  次要文字      zinc-400  (#a1a1aa)
  停用文字      zinc-600  (#52525b)

主色（強調）：
  品牌藍        indigo-500  (#6366f1)
  品牌藍深      indigo-600  (#4f46e5)

狀態色：
  成功          emerald-500  (#10b981)
  警告          amber-500    (#f59e0b)
  錯誤/危險     red-500      (#ef4444)
  資訊          sky-500      (#0ea5e9)

優先級色標：
  P0（緊急）    red-500
  P1（高）      orange-500
  P2（中）      blue-500
  P3（低）      zinc-500

任務分類徽章色：
  PLANNED（原始規劃）  indigo-600  深紫藍
  ADDED（追加）        orange-600  橘色（醒目，提示計畫外）
  INCIDENT（突發）     red-700     紅色（高重要性）
  SUPPORT（用戶支援）  sky-600     天藍
  ADMIN（行政庶務）    zinc-600    灰色（低視覺權重）
  LEARNING（學習）     emerald-600 綠色（正向）
```

### 7.2 字體

```
主要字體：Geist（Vercel 出品）
程式碼字體：Geist Mono

字級規範：
  頁面標題（h1）  text-2xl  font-semibold
  區塊標題（h2）  text-lg   font-semibold
  小節標題（h3）  text-base font-medium
  內文           text-sm   font-normal
  說明文字        text-xs   text-zinc-400
  標籤/徽章       text-xs   font-medium
```

### 7.3 元件使用規範（shadcn/ui）

| 元件 | 使用場景 |
|------|---------|
| `Button` | 主要操作（default）、次要（outline）、危險（destructive） |
| `Card` | 統計卡片、KPI 卡、資訊展示 |
| `Dialog` | 確認框、新增/編輯表單 |
| `Sheet` | 任務詳情側板（從右側滑入） |
| `Select` | 下拉篩選器、類別選擇 |
| `Command` | 全文搜尋、指令選單、成員搜尋 |
| `Popover` | 日期選擇器、快速工時輸入 |
| `Tabs` | 看板/甘特圖切換、報表分頁 |
| `Progress` | 工作負載條、KPI 達成率、任務進度 |
| `Badge` | 優先級、任務分類、狀態標籤 |
| `Avatar` | A 角 / B 角使用者頭像 |
| `Tooltip` | 懸停顯示 A/B 角全名、分類說明 |
| `Separator` | 區塊分隔 |
| `Skeleton` | 載入狀態 |
| `Toast` | 操作成功/失敗通知 |
| `AlertDialog` | 刪除確認、不可逆操作確認 |

### 7.4 互動設計原則

**3 次點擊原則：**
```
建立任務：[看板頁] → [點擊「+ 新增任務」] → [填表送出]       完成（2 次操作）
記錄工時：[工時頁] → [點擊格子] → [輸入工時 → 儲存]         完成（2 次操作）
查看 KPI：[報表頁] → [點擊「KPI 達成」Tab] → [選年度]        完成（2 次操作）
設定 B 角：[任務詳情] → [指派欄位] → [選擇 B 角]              完成（2 次操作）
```

**角色差異視圖：**
| 情境 | Manager 預設視圖 | Engineer 預設視圖 |
|------|----------------|----------------|
| Dashboard | 全員工作負載、KPI 概況、計畫外高亮 | 自己今日任務、工時、逾期提醒 |
| 看板 | 全員任務（可篩選），含分類徽章 | 預設篩選自己的任務 |
| 甘特圖 | 全員任務 + 里程碑 + 年度計畫時程 | 自己的任務（可申請查看全隊） |
| 工時 | 顯示自己（可切換至任何人） | 只看自己 |
| 報表 | 完整月報、KPI、計畫外負荷、全員分析 | 只看自己的工時與任務統計 |

**動態回饋：**
- 拖曳任務卡片：即時更新狀態，Optimistic UI，失敗時回滾並 Toast
- 拖曳甘特圖任務條：調整截止日，自動彈出 DELAY 原因填寫框
- 儲存文件：顯示「自動儲存中...」→「已儲存（N 秒前）」
- 工時輸入：Popover 即時顯示，Enter 儲存，Esc 取消
- 所有 API 請求：Loading skeleton → 實際資料，避免 Layout Shift
- 通知鈴：紅點顯示未讀數量，點擊展開通知列表

**空狀態（Empty State）：**
- 看板欄位空白：顯示「+ 新增任務」引導
- 知識庫無文件：顯示「+ 建立第一份文件」引導
- 工時表無紀錄：顯示「+ 記錄今日工時」引導
- KPI 無資料：顯示「+ 建立本年度 KPI」引導（僅 Manager）

---

## 8. 部署架構

### 8.1 Docker Compose 設定（生產環境）

```yaml
# docker-compose.prod.yml
version: '3.9'

services:
  app:
    image: titan-app:latest
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    environment:
      DATABASE_URL: postgresql://titan:${DB_PASSWORD}@db:5432/titan
      AUTH_SECRET: ${AUTH_SECRET}
      AUTH_URL: http://内網IP:3000
      NODE_ENV: production
    depends_on:
      db:
        condition: service_healthy
    restart: unless-stopped
    volumes:
      - uploads:/app/public/uploads
    healthcheck:
      test: ["CMD-SHELL", "curl -f http://localhost:3000/api/health || exit 1"]
      interval: 30s
      timeout: 10s
      retries: 3

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: titan
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: titan
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U titan"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  pgdata:
  uploads:
```

### 8.2 Dockerfile（多階段建置）

```dockerfile
# --- 建置階段 ---
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --frozen-lockfile
COPY . .
RUN npx prisma generate
RUN npm run build

# --- 執行階段 ---
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

EXPOSE 3000
CMD ["node", "server.js"]
```

### 8.3 Air-Gapped 環境部署步驟

```bash
# 在有網路的機器上打包
docker build -t titan-app:latest .
docker save titan-app:latest | gzip > titan-app.tar.gz
docker save postgres:16-alpine | gzip > postgres.tar.gz

# 傳輸至 air-gapped 機器（USB 或內網傳輸）
# scp titan-app.tar.gz postgres.tar.gz user@内網伺服器:/opt/titan/

# 在 air-gapped 機器上載入
docker load < titan-app.tar.gz
docker load < postgres.tar.gz

# 建立環境變數檔案
cat > /opt/titan/.env << 'EOF'
DB_PASSWORD=<強密碼>
AUTH_SECRET=<隨機32字元>
EOF

# 啟動
cd /opt/titan
docker-compose -f docker-compose.prod.yml up -d

# 初始化資料庫（首次）
docker-compose exec app npx prisma migrate deploy
docker-compose exec app npx prisma db seed

# 確認運行狀態
docker-compose ps
curl -f http://localhost:3000/api/health
```

### 8.4 每日備份腳本

```bash
#!/bin/bash
# /opt/titan/backup.sh
BACKUP_DIR=/opt/titan/backups
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# 備份資料庫
docker-compose -f /opt/titan/docker-compose.prod.yml exec -T db \
  pg_dump -U titan titan | gzip > $BACKUP_DIR/titan_db_$DATE.sql.gz

# 保留最近 30 天
find $BACKUP_DIR -name "titan_db_*.sql.gz" -mtime +30 -delete

echo "備份完成：$BACKUP_DIR/titan_db_$DATE.sql.gz"
```

```cron
# 每日凌晨 2 點執行備份
0 2 * * * /opt/titan/backup.sh >> /var/log/titan-backup.log 2>&1
```

### 8.5 未來擴展規劃

| 功能 | 優先級 | 說明 |
|------|------|------|
| LDAP/AD 整合 | P0（生產必要） | 對接銀行現有 Active Directory，統一帳號管理 |
| 行信 API 通知（Phase 2） | P1 | 推播緊急通知與每日摘要至行動裝置 |
| 審批機制啟用 | P1 | Manager 可針對特定任務類別啟用多層審批流程 |
| 行動端適配 | P2 | RWD 優化，工程師在手機上也能快速記錄工時 |
| API 速率限制 | P1 | 防止意外的 API 濫用 |
| 進階圖表（BI） | P3 | 跨年度趨勢分析、KPI 歷史對比 |

---

*文件版本：v3.0（最終版）｜ 建立日期：2026-03-24 ｜ TITAN 銀行 IT 團隊工作管理系統*

*本文件已整合所有確認需求，包含任務層級雙向追溯、6 種任務分類、KPI 系統、A/B 角機制、交付項、里程碑、延期/變更追蹤、6 種工時類別、計畫外負荷報表、動態權限、年度計畫範本、Excel 匯入、站內通知，可作為開發啟動的最終依據。*
