# Deliverable 附件機制設計文件

> Issue #369 — Deliverable 附件只有 URL 欄位，無實際檔案上傳

**版本**: v1.0
**最後更新**: 2026-03-25
**狀態**: 已決定
**前置文件**: `prisma/schema.prisma` Deliverable model

---

## 1. 現況分析

目前 Deliverable model 已有 `attachmentUrl` 欄位（`String?`），
設計為儲存附件的參考連結，但無實際檔案上傳功能。

```prisma
model Deliverable {
  // ...
  attachmentUrl String?   // 現有欄位
  // ...
}
```

---

## 2. 方案評估

| 方案 | 優點 | 缺點 | 複雜度 | 適用階段 |
|------|------|------|--------|----------|
| **URL 參考連結** | 零額外基礎設施、立即可用 | 連結可能失效、無版本追蹤 | 低 | v1.0 |
| **MinIO 物件儲存** | S3 相容、支援大檔案、版本控制 | 需額外部署 MinIO、維運成本 | 高 | v2.0+ |
| **本地檔案系統** | 實作簡單 | 無法擴展、備份困難、安全風險 | 中 | 不建議 |
| **PostgreSQL BYTEA** | 無額外服務 | 效能差、DB 膨脹、不適合大檔案 | 中 | 不建議 |

---

## 3. v1.0 決定：URL 參考連結

**理由**：

1. **銀行內部環境**：交付物通常為內部系統連結（SharePoint、Wiki、Git repo）
2. **5 人團隊**：手動管理連結的成本可接受
3. **現有欄位即可使用**：`attachmentUrl` 已存在於 schema，前端加入輸入框即可
4. **降低部署複雜度**：v1.0 目標為快速上線，避免額外基礎設施

### 3.1 前端實作方向

- Deliverable 表單加入 `attachmentUrl` 輸入框
- 支援多個 URL（以換行或逗號分隔，存為 JSON 陣列字串）
- URL 格式驗證（`https://` 或內網 `http://` 協議）
- 顯示時渲染為可點擊連結

### 3.2 Schema 變更（可選）

若需支援多附件，可擴充為：

```prisma
model DeliverableAttachment {
  id            String   @id @default(cuid())
  deliverableId String
  url           String
  label         String?  // 顯示名稱
  addedAt       DateTime @default(now())

  deliverable Deliverable @relation(fields: [deliverableId], references: [id], onDelete: Cascade)

  @@index([deliverableId])
  @@map("deliverable_attachments")
}
```

v1.0 暫不實作此 model，保持使用單一 `attachmentUrl` 欄位。

---

## 4. v2.0 MinIO 升級路線

```
Phase 2 計畫：
├── docker-compose 加入 MinIO 服務
├── 建立 DeliverableAttachment model（多附件）
├── 實作檔案上傳 API（multipart/form-data → MinIO）
├── 前端拖拽上傳元件
├── 檔案版本追蹤與下載 API
└── 整合 ClamAV 掃毒（銀行合規要求）
```

---

## 5. 安全考量

| 考量 | v1.0 處理方式 |
|------|---------------|
| URL 注入 | 前端 + 後端 URL 格式驗證 |
| SSRF 風險 | URL 僅供前端渲染為 `<a>` 連結，後端不 fetch |
| 連結失效 | 使用者自行確認，v2.0 可加入連結檢查排程 |
