# TITAN 審批機制設計文件

> Issue #222 — Manager 可啟用多層審批流程

**版本**: v1.0
**最後更新**: 2026-03-25
**狀態**: 設計階段（P5）
**前置文件**: `docs/architecture-v3.md` §2.9、§8.5

---

## 1. 概述

架構文件 §2.9 提到「審批機制（Approval Flow）：預設隱藏，Manager 可啟用」。
此功能允許 Manager 對特定任務類別設定審批流程，任務狀態變更需經核可。

**設計原則：**
- 預設關閉，不影響現有工作流
- Manager 可按任務類別啟用
- 審批記錄完整寫入 AuditLog

---

## 2. 資料模型

### 2.1 新增 Model

```prisma
/// 審批規則 — 定義哪些任務類別需要審批
model ApprovalRule {
  id            String       @id @default(cuid())
  category      TaskCategory // ROUTINE, ADDED, INCIDENT, PROJECT
  enabled       Boolean      @default(false)
  approverRole  Role         @default(MANAGER)
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt
  createdBy     String       // Manager userId

  @@unique([category])
  @@map("approval_rules")
}

/// 審批狀態
enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

/// 審批記錄
model ApprovalHistory {
  id         String         @id @default(cuid())
  taskId     String
  action     ApprovalStatus
  approvedBy String?        // null = pending
  comment    String?
  createdAt  DateTime       @default(now())

  task Task @relation(fields: [taskId], references: [id])

  @@index([taskId])
  @@map("approval_history")
}
```

### 2.2 Task Model 變更

```prisma
model Task {
  // ... 現有欄位 ...
  approvalStatus  ApprovalStatus?  // null = 不需審批
  approvalHistory ApprovalHistory[]
}
```

---

## 3. 業務流程

### 3.1 啟用審批

```
Manager → 系統設定 → 審批規則管理
  → 選擇任務類別（如 ADDED）
  → 啟用審批
  → 儲存
```

### 3.2 任務審批流程

```
Engineer 建立/變更任務（類別已啟用審批）
       │
       ▼
  任務狀態 → PENDING_APPROVAL
       │
       ▼
  Manager 收到通知
       │
       ├── 核可 → 任務正常進入目標狀態
       │          AuditLog: APPROVAL_GRANTED
       │
       └── 駁回 → 任務退回原狀態
                   通知 Engineer 駁回原因
                   AuditLog: APPROVAL_REJECTED
```

### 3.3 狀態機

```
未啟用審批:
  TODO → IN_PROGRESS → IN_REVIEW → DONE

啟用審批:
  TODO → IN_PROGRESS → PENDING_APPROVAL → [Manager 核可] → IN_REVIEW → DONE
                                        → [Manager 駁回] → IN_PROGRESS
```

---

## 4. API 設計

### 4.1 審批規則管理

```
GET    /api/admin/approval-rules          # 列出所有規則
PUT    /api/admin/approval-rules/:category # 更新規則（啟用/停用）
```

### 4.2 審批操作

```
GET    /api/tasks/pending-approval         # 列出待審核任務
POST   /api/tasks/:id/approve              # 核可
POST   /api/tasks/:id/reject               # 駁回（需附 comment）
```

### 4.3 範例

```typescript
// POST /api/tasks/:id/approve
{
  "comment": "已確認需求合理"  // 選填
}

// POST /api/tasks/:id/reject
{
  "comment": "請補充需求說明"  // 必填
}
```

---

## 5. UI 設計

### 5.1 系統設定頁（Manager only）

```
┌─────────────────────────────────────┐
│ 審批規則管理                         │
├─────────────────────────────────────┤
│ 任務類別      │ 審批    │ 核可角色  │
│───────────────┼─────────┼──────────│
│ ROUTINE       │ [ ]     │ MANAGER  │
│ ADDED         │ [✓]     │ MANAGER  │
│ INCIDENT      │ [ ]     │ MANAGER  │
│ PROJECT       │ [✓]     │ MANAGER  │
└─────────────────────────────────────┘
```

### 5.2 任務詳情頁

- 審批狀態標籤（PENDING / APPROVED / REJECTED）
- 核可/駁回按鈕（Manager 可見）
- 審批歷史時間軸

### 5.3 Dashboard

- 「待審核任務」計數卡片（Manager 視角）
- 點擊進入待審核任務列表

---

## 6. 安全考量

| 項目 | 處理方式 |
|------|---------|
| 權限控制 | 審批規則管理：MANAGER only |
| 自我審批 | 禁止 Engineer 審批自己的任務 |
| 審計追蹤 | 所有審批動作寫入 AuditLog |
| 歷史不可刪 | ApprovalHistory 僅新增，不可修改/刪除 |
| 並行處理 | 使用 Prisma transaction 確保狀態一致性 |

---

## 7. 對現有系統的影響

| 影響範圍 | 說明 |
|---------|------|
| Task Service | 新增審批狀態檢查邏輯（僅在規則啟用時） |
| Notification Service | 新增審批相關通知類型 |
| Prisma Schema | 新增 3 個 model/enum |
| Dashboard | 新增待審核計數卡片 |
| 向後相容 | `approvalStatus` 為 nullable，不影響現有任務 |

---

## 8. 前置條件

- [ ] 通知偏好機制完成（Issue #267）— 審批通知需整合偏好設定
- [ ] 確認任務類別（TaskCategory）enum 已定義
- [ ] UI 設計稿確認

## 9. 預估工時

16 小時

---

*Fixes #222*
