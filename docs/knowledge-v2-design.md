# TITAN Knowledge Base v2 — 設計文件

> **版本**: 1.0
> **日期**: 2026-03-26
> **狀態**: Draft
> **作者**: PM (Claude Opus 4.6)

---

## 一、現況問題分析

### 現行 v1 架構

| 層面 | 現狀 | 問題 |
|------|------|------|
| 資料模型 | `Document` + `DocumentVersion`，僅 title/content/slug/tags/parentId | 無 draft/published 狀態、無分類、無附件 |
| 版本控制 | version 遞增 + DocumentVersion 快照（僅存 content） | 無 diff view、無 title 變更紀錄、無審核流程 |
| 編輯器 | 自製 Markdown renderer（regex-based） | 不支援表格、程式碼高亮不完整、僅支援圖片上傳 |
| 檔案格式 | 僅 Markdown + 圖片上傳 | 不支援 PDF/Word/Excel 附件 |
| 搜尋 | PostgreSQL full-text + ILIKE fallback（CJK） | 無 metadata 搜尋、無語意搜尋、無 faceted filter |
| 組織結構 | 扁平 parent-child tree | 無 Space/Category 概念、無分類法 |
| 知識生命週期 | 建立 → 編輯 → 刪除 | 無 Draft/Review/Published/Archived 流程 |
| 協作 | 無 | 無評論、無建議修改、無共同編輯 |
| 分享 | 無 | 無 public/private 可見性、無分享連結 |
| 範本 | 無 | 每次從空白開始 |
| 學習 | 無 | 無指定閱讀、無新人引導 |

---

## 二、競品研究

### 1. Notion

| 維度 | 分析 |
|------|------|
| **知識組織** | Workspace > Teamspace > Pages，無限巢狀。每個 page 可當 database。支援 backlinks 與 relation。 |
| **版本控制** | Page history（付費方案 30 天～無限），可逐版 restore，無 diff view。無 draft/publish 二態。 |
| **檔案格式** | Rich text（block-based）、嵌入 PDF/影片/程式碼、支援 50+ embed 類型。 |
| **知識生命週期** | 無正式流程，依靠 lock page + 手動歸檔。 |
| **搜尋** | Full-text（含 PDF 內文）、filter by creator/date/team、近期加入 AI 搜尋。 |
| **協作** | Real-time co-editing、comments、mentions、resolve。 |
| **分享** | Share to web（public link）、guest access、permission levels（full/edit/comment/view）。 |

**TITAN 可借鏡**: Block-based editor 概念、database 視圖的靈活性、AI 搜尋。

### 2. Confluence

| 維度 | 分析 |
|------|------|
| **知識組織** | Space > Page Tree（無限巢狀）。Labels（tags）跨 space 搜尋。Space categories 分群。 |
| **版本控制** | 完整 revision history + diff view（逐行比較）。Draft → Publish 二態，unpublished changes 可見。 |
| **檔案格式** | Rich text editor（TinyMCE/Fabric）、附件管理器、Office 文件預覽、嵌入 macro。 |
| **知識生命週期** | Draft → Published → Archive。Content review（付費 add-on）、page restrictions。 |
| **搜尋** | CQL（Confluence Query Language）、full-text + metadata（label/space/author/date）、macro 搜尋。 |
| **協作** | Inline comments、page comments、@mention、collaborative editing（Cloud 版）。 |
| **分享** | Space permissions、page restrictions、public link（Cloud）、export PDF/Word。 |

**TITAN 可借鏡**: Space > Page Tree 層級、Draft/Publish 二態、diff view、Labels 系統、CQL-like 進階搜尋。

### 3. Outline

| 維度 | 分析 |
|------|------|
| **知識組織** | Collection > Document（巢狀）。支援 backlinks、starred docs、recent docs。 |
| **版本控制** | 自動版本歷史 + named versions。Revision diff view（side-by-side）。Archive/restore。 |
| **檔案格式** | Markdown-native（Prosemirror editor）、圖片上傳、檔案附件。API-first。 |
| **知識生命週期** | Draft → Publish → Archive → Delete（soft delete + trash）。Template gallery。 |
| **搜尋** | Full-text（PostgreSQL + optional Elasticsearch）、filter by collection/user/date。 |
| **協作** | Real-time co-editing、comments、read receipts。 |
| **分享** | Public share links、collection-level permissions、team/individual access。 |

**TITAN 可借鏡**: TITAN 已整合 Outline iframe。可深化 API 同步，借鏡 Collection 概念、named versions、Prosemirror editor。

### 4. GitBook

| 維度 | 分析 |
|------|------|
| **知識組織** | Organization > Space > Page Groups > Pages。Git-based 底層。 |
| **版本控制** | Git-style branching（change requests）、merge review、diff view、version history。最接近真正的版本控制。 |
| **檔案格式** | Markdown + rich blocks、OpenAPI spec rendering、code blocks with syntax highlighting。 |
| **知識生命週期** | Main（published）+ change requests（branches）→ review → merge。 |
| **搜尋** | Full-text、AI-powered（Lens）、search across spaces。 |
| **協作** | Change requests（like PR）、inline discussions、review + approve。 |
| **分享** | Public docs、visitor authentication、custom domains、PDF export。 |

**TITAN 可借鏡**: Change request 概念（類似 PR 的審核流程）、branching model、AI-powered search。

### 5. Slite

| 維度 | 分析 |
|------|------|
| **知識組織** | Channels（collections）> Documents。Tags、starred、pinned。 |
| **版本控制** | Version history（restore 功能）、無 diff。 |
| **檔案格式** | Rich text + 嵌入（Google Docs、Figma 等）、templates。 |
| **知識生命週期** | 基本（create/archive/delete）。Knowledge verification（ask feature 驗證知識新鮮度）。 |
| **搜尋** | AI "Ask" feature（語意搜尋 + 摘要回答）、full-text、filter by channel/person。 |
| **協作** | Real-time editing、comments、reactions。 |
| **分享** | Share link、external guests、channel permissions。 |

**TITAN 可借鏡**: "Ask" AI 語意搜尋（用自然語言問問題，回傳摘要 + 來源）、knowledge verification。

### 6. Guru

| 維度 | 分析 |
|------|------|
| **知識組織** | Boards > Sections > Cards。扁平化但有結構。 |
| **版本控制** | Card history、restore。無 diff。 |
| **檔案格式** | Rich text、附件、嵌入。 |
| **知識生命週期** | **核心差異化**: 驗證系統 — 每張 card 有 verifier + 驗證週期（如 90 天），到期自動提醒驗證或過期。Expert 審核制。 |
| **搜尋** | AI search、browser extension 嵌入（在任何工具中搜尋）、Slack/Teams 整合。 |
| **協作** | Suggest edits、comments、verification workflow。 |
| **分享** | Team/group permissions、public collections。 |

**TITAN 可借鏡**: 知識驗證系統（verifier + expiry）、expert ownership、到期自動提醒。對銀行業 SOP 維護極為重要。

### 7. BookStack

| 維度 | 分析 |
|------|------|
| **知識組織** | Shelves > Books > Chapters > Pages。四層結構，清晰的書本比喻。 |
| **版本控制** | Page revision history + diff view（HTML diff）。Drafts（auto-save）。 |
| **檔案格式** | WYSIWYG + Markdown editor 雙模式、圖片/附件上傳。 |
| **知識生命週期** | Create → Edit → revision history。無正式 publish 流程。 |
| **搜尋** | Full-text（MySQL/PostgreSQL）、tag filter、search within book/chapter。 |
| **協作** | Comments per page。無 real-time co-edit。 |
| **分享** | Role-based permissions（per shelf/book/chapter/page）、public access toggle。 |

**TITAN 可借鏡**: Shelves > Books > Chapters > Pages 四層結構概念（適合大量 SOP 文件）、HTML diff。

### 8. SharePoint

| 維度 | 分析 |
|------|------|
| **知識組織** | Sites > Document Libraries > Folders + Metadata columns。強大的 metadata taxonomy。 |
| **版本控制** | Major/Minor versioning（0.1 draft → 1.0 published）、check-in/check-out、approval workflow。 |
| **檔案格式** | 支援所有 Office 格式、PDF、任意檔案。Online co-editing（Office Online）。 |
| **知識生命週期** | Draft (minor) → Approved (major)。Content approval workflow、retention policies（自動歸檔/刪除）。 |
| **搜尋** | Microsoft Search、metadata filters、managed properties、content types。 |
| **協作** | Co-authoring、comments、@mention、approval flow（Power Automate）。 |
| **分享** | Site/library/item level permissions、external sharing、sensitivity labels。 |

**TITAN 可借鏡**: Major/Minor versioning、approval workflow、retention policy（自動歸檔）、metadata taxonomy。

### 9. Nuclino

| 維度 | 分析 |
|------|------|
| **知識組織** | Workspaces > Clusters > Items。三種視圖：List、Board、Graph。 |
| **版本控制** | Version history、restore。無 diff。 |
| **檔案格式** | Rich text（block-based）、嵌入、attachments。 |
| **知識生命週期** | 基本（create/archive/delete）。 |
| **搜尋** | Instant full-text、filter by workspace/cluster。 |
| **協作** | Real-time co-editing、comments、internal links。 |
| **分享** | Public share link、workspace permissions。 |

**TITAN 可借鏡**: Graph view（知識關聯圖）、極簡 UX。

### 10. Obsidian

| 維度 | 分析 |
|------|------|
| **知識組織** | Vault > Folders + `[[wikilinks]]`。Graph view 呈現知識網絡。Tags + frontmatter metadata。 |
| **版本控制** | File recovery（core plugin）、Git plugin（社群）。本質是 local-first plain text。 |
| **檔案格式** | Markdown-native、attachments、canvas（白板）。Plugin 生態支援幾乎任何格式。 |
| **知識生命週期** | 無正式流程（local-first 工具）。靠 plugin 補足。 |
| **搜尋** | 快速 full-text、regex search、tag search、backlink search。 |
| **協作** | Obsidian Publish（唯讀）、Obsidian Sync。無 real-time co-edit。 |
| **分享** | Obsidian Publish（public site）、export PDF/HTML。 |

**TITAN 可借鏡**: `[[wikilinks]]` 雙向連結、Graph view、frontmatter metadata、plugin 架構思維。

---

### 競品特性矩陣

| 特性 | Notion | Confluence | Outline | GitBook | Slite | Guru | BookStack | SharePoint | Nuclino | Obsidian |
|------|--------|------------|---------|---------|-------|------|-----------|------------|---------|----------|
| 階層組織 | 5 | 5 | 4 | 4 | 3 | 3 | 5 | 5 | 3 | 3 |
| Draft/Publish | 2 | 5 | 4 | 5 | 2 | 3 | 2 | 5 | 2 | 1 |
| Diff view | 1 | 5 | 4 | 5 | 1 | 1 | 4 | 3 | 1 | 1 |
| 檔案附件 | 4 | 5 | 3 | 3 | 3 | 3 | 4 | 5 | 3 | 3 |
| 知識驗證 | 1 | 2 | 1 | 1 | 3 | 5 | 1 | 3 | 1 | 1 |
| AI 搜尋 | 4 | 2 | 2 | 4 | 5 | 4 | 1 | 3 | 1 | 1 |
| 協作 | 5 | 4 | 4 | 4 | 4 | 3 | 2 | 4 | 4 | 1 |
| 權限控管 | 4 | 5 | 3 | 3 | 3 | 4 | 4 | 5 | 3 | 1 |

（5 = 業界最佳, 1 = 無/極弱）

---

## 三、TITAN Knowledge Base v2 設計

### 設計原則

1. **Confluence 的結構深度** + **Outline 的簡潔 UX** + **Guru 的驗證機制**
2. **漸進式複雜度** — 小團隊不被結構綁死，大團隊有足夠組織力
3. **銀行業適用** — SOP 驗證、稽核追蹤、權限控管、retention policy
4. **API-first** — 所有功能透過 API 暴露，支援自動化與整合

---

### 3.1 知識結構: Space > Category > Document

```
┌─────────────────────────────────────────────────────┐
│  Space (e.g. "IT Operations", "HR Policies")        │
│  ├── Category (e.g. "Batch Jobs", "DR Procedures")  │
│  │   ├── Document (SOP-001: EOD Batch Procedure)    │
│  │   │   ├── child document (附錄 A)                │
│  │   │   └── child document (附錄 B)                │
│  │   └── Document (SOP-002: DR Failover)            │
│  └── Category (e.g. "Monitoring")                   │
│      └── Document (Grafana Alert Playbook)          │
└─────────────────────────────────────────────────────┘
```

#### Prisma Schema — 新增 Models

```prisma
model KnowledgeSpace {
  id          String   @id @default(cuid())
  name        String
  slug        String   @unique
  description String?
  icon        String?  // emoji or icon name
  color       String?  // hex color for UI
  visibility  Visibility @default(TEAM)  // TEAM, PUBLIC, PRIVATE
  sortOrder   Int      @default(0)
  createdBy   String
  updatedBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  creator     User               @relation("SpaceCreator", fields: [createdBy], references: [id])
  updater     User               @relation("SpaceUpdater", fields: [updatedBy], references: [id])
  categories  KnowledgeCategory[]
  documents   Document[]
  members     SpaceMember[]

  @@map("knowledge_spaces")
}

model SpaceMember {
  id       String    @id @default(cuid())
  spaceId  String
  userId   String
  role     SpaceRole @default(VIEWER) // ADMIN, EDITOR, VIEWER

  space    KnowledgeSpace @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  user     User           @relation(fields: [userId], references: [id])

  @@unique([spaceId, userId])
  @@map("space_members")
}

model KnowledgeCategory {
  id          String   @id @default(cuid())
  spaceId     String
  parentId    String?  // nested categories
  name        String
  slug        String
  description String?
  icon        String?
  sortOrder   Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  space      KnowledgeSpace      @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  parent     KnowledgeCategory?  @relation("CategoryTree", fields: [parentId], references: [id])
  children   KnowledgeCategory[] @relation("CategoryTree")
  documents  Document[]

  @@unique([spaceId, slug])
  @@index([spaceId])
  @@index([parentId])
  @@map("knowledge_categories")
}

enum Visibility {
  PUBLIC   // 所有人可見（含未登入）
  TEAM     // 所有登入成員
  PRIVATE  // 僅 space members
}

enum SpaceRole {
  ADMIN    // manage space settings, members
  EDITOR   // create/edit documents
  VIEWER   // read only
}
```

#### 修改既有 Document Model

```prisma
model Document {
  id          String         @id @default(cuid())
  spaceId     String?        // nullable for migration
  categoryId  String?        // nullable for uncategorized
  parentId    String?
  title       String
  content     String         // Markdown
  summary     String?        // auto-generated or manual excerpt
  slug        String         @unique
  tags        String[]
  status      DocumentStatus @default(DRAFT)
  visibility  Visibility     @default(TEAM)
  pinned      Boolean        @default(false)
  templateId  String?        // created from template
  coverImage  String?        // cover image URL

  // Version control
  version     Int            @default(1)
  publishedVersion Int?      // last published version number
  publishedAt DateTime?
  publishedBy String?

  // Knowledge verification (Guru-inspired)
  verifierId    String?      // assigned expert verifier
  verifiedAt    DateTime?
  verifyByDate  DateTime?    // next verification due date
  verifyIntervalDays Int?    // e.g. 90 days

  // Lifecycle
  archivedAt  DateTime?
  archivedBy  String?

  // Metadata
  createdBy   String
  updatedBy   String
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  wordCount   Int            @default(0)
  readTimeMin Int            @default(0) // estimated read time

  // Relations
  space       KnowledgeSpace?    @relation(fields: [spaceId], references: [id])
  category    KnowledgeCategory? @relation(fields: [categoryId], references: [id])
  parent      Document?          @relation("DocTree", fields: [parentId], references: [id])
  children    Document[]         @relation("DocTree")
  creator     User               @relation("DocCreator", fields: [createdBy], references: [id])
  updater     User               @relation("DocUpdater", fields: [updatedBy], references: [id])
  publisher   User?              @relation("DocPublisher", fields: [publishedBy], references: [id])
  verifier    User?              @relation("DocVerifier", fields: [verifierId], references: [id])
  archiver    User?              @relation("DocArchiver", fields: [archivedBy], references: [id])
  template    DocumentTemplate?  @relation(fields: [templateId], references: [id])
  versions    DocumentVersion[]
  attachments DocumentAttachment[]
  comments    DocumentComment[]
  readLogs    DocumentReadLog[]
  links       DocumentLink[]     @relation("LinkSource")
  backlinks   DocumentLink[]     @relation("LinkTarget")

  @@index([spaceId])
  @@index([categoryId])
  @@index([parentId])
  @@index([status])
  @@index([createdBy])
  @@index([verifierId])
  @@index([verifyByDate])
  @@map("documents")
}

enum DocumentStatus {
  DRAFT
  IN_REVIEW
  PUBLISHED
  ARCHIVED
  RETIRED
}
```

#### DocumentVersion 強化

```prisma
model DocumentVersion {
  id           String   @id @default(cuid())
  documentId   String
  title        String   // also track title changes
  content      String
  version      Int
  changeNote   String?  // "修正第三步驟的 IP 位址"
  createdBy    String
  createdAt    DateTime @default(now())

  document     Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  creator      User     @relation(fields: [createdBy], references: [id])

  @@index([documentId])
  @@index([documentId, version])
  @@map("document_versions")
}
```

---

### 3.2 版本控制 — Draft/Published + Revision History + Diff

#### 狀態流轉

```
          ┌──────────┐
    ┌────→│  DRAFT   │←────────────────┐
    │     └────┬─────┘                 │
    │          │ submit for review     │ reject / request changes
    │          ▼                       │
    │     ┌──────────┐                 │
    │     │IN_REVIEW │─────────────────┘
    │     └────┬─────┘
    │          │ approve
    │          ▼
    │     ┌──────────┐
    │     │PUBLISHED │──────┐
    │     └────┬─────┘      │
    │          │ edit        │ archive
    │          ▼             ▼
    │     ┌──────────┐  ┌──────────┐
    └─────│  DRAFT   │  │ ARCHIVED │
          │(new ver) │  └────┬─────┘
          └──────────┘       │ retire
                             ▼
                        ┌──────────┐
                        │ RETIRED  │
                        └──────────┘
```

#### Diff View 實作策略

- 前端使用 `diff-match-patch` (Google) 或 `jsdiff` 產生 unified diff
- API: `GET /api/documents/:id/versions/:v1/diff/:v2`
- 回傳 unified diff format，前端 render 為 side-by-side 或 inline diff view
- 同時比較 title + content 變更

#### 關鍵 API

```
POST   /api/documents/:id/submit-review   — 送審
POST   /api/documents/:id/approve         — 核准發布
POST   /api/documents/:id/reject          — 退回修改
POST   /api/documents/:id/archive         — 歸檔
POST   /api/documents/:id/restore         — 從歸檔還原
POST   /api/documents/:id/publish         — 直接發布（有權限者）
```

---

### 3.3 Rich Editor — Tiptap (Prosemirror-based)

**選型**: Tiptap v2（Prosemirror 上層封裝）

- 已是 Outline 的技術底層，技術棧一致
- 豐富的 extension 生態
- 支援 Markdown 快捷鍵、slash commands
- 可擴充 collaborative editing (Yjs)

#### 核心 Extensions

| Extension | 功能 |
|-----------|------|
| StarterKit | 基本格式（bold, italic, heading, list, code block） |
| Table | 表格（merge cells, resize） |
| Image | 圖片上傳 + resize + alignment |
| FileHandler | 拖拽上傳檔案 |
| Link | 超連結 + auto-detect |
| CodeBlockLowlight | 程式碼語法高亮（lowlight） |
| TaskList | 核取方塊清單 |
| Placeholder | 空內容提示 |
| CharacterCount | 字數統計 |
| Typography | 自動排版（引號、破折號） |
| Mention | @mention 使用者 |
| SlashCommand | / 指令選單 |

#### Markdown 相容性

- 儲存格式仍為 Markdown（保持與 v1 資料相容）
- Tiptap ↔ Markdown 雙向轉換使用 `tiptap-markdown` extension
- 進階格式（表格、task list）使用 GFM (GitHub Flavored Markdown)

---

### 3.4 檔案管理 — 附件系統

```prisma
model DocumentAttachment {
  id          String   @id @default(cuid())
  documentId  String
  fileName    String
  fileType    String   // MIME type
  fileSize    Int      // bytes
  storageKey  String   // S3/R2 key
  url         String   // CDN URL
  thumbnailUrl String? // for images/PDF preview
  createdBy   String
  createdAt   DateTime @default(now())

  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  creator     User     @relation(fields: [createdBy], references: [id])

  @@index([documentId])
  @@map("document_attachments")
}
```

#### 支援格式

| 類別 | 格式 | 處理方式 |
|------|------|----------|
| 圖片 | JPEG, PNG, GIF, WebP, SVG | 直接嵌入編輯器 + 壓縮 + 縮圖 |
| 文件 | PDF | 預覽（pdf.js）+ full-text indexing |
| Office | DOCX, XLSX, PPTX | 上傳 + 預覽（LibreOffice 轉 PDF 或前端 viewer） |
| 程式碼 | 任意純文字 | 語法高亮預覽 |
| 壓縮 | ZIP, TAR.GZ | 僅下載，顯示檔案清單 |

#### 上傳流程

1. 前端取得 presigned URL（`POST /api/uploads/presign`）
2. 直傳 S3/R2（不經 server）
3. 上傳完成後通知 API 建立 attachment record
4. 背景處理：產生縮圖、PDF text extraction（for search indexing）

---

### 3.5 知識生命週期 — Draft → Review → Published → Archived

#### 角色與權限

| 動作 | VIEWER | EDITOR | ADMIN | MANAGER |
|------|--------|--------|-------|---------|
| 閱讀已發布文件 | O | O | O | O |
| 閱讀草稿 | - | 自己的 | O | O |
| 建立文件 | - | O | O | O |
| 編輯文件 | - | O（自己的 or assigned） | O | O |
| 送審 | - | O | O | O |
| 核准/退回 | - | - | O | O |
| 直接發布 | - | - | O | O |
| 歸檔 | - | - | O | O |
| 刪除 | - | - | - | O |
| 管理 Space | - | - | O | O |

#### 審核流程

```
Editor 送審 → 通知 Space Admin
  ↓
Admin 審核
  ├── 核准 → 狀態變 PUBLISHED, 記錄 publishedAt/publishedBy
  │          → 通知 Editor "已核准"
  │          → DocumentVersion 快照 (標記為 published)
  └── 退回 → 狀態回 DRAFT, 記錄 reject reason
             → 通知 Editor "需修改: {reason}"
```

---

### 3.6 搜尋 — Full-text + Metadata + 語意搜尋

#### 搜尋架構

```
┌──────────────┐
│  Search Bar  │  ← 統一入口
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────┐
│  Search Router                            │
│  ├── Full-text (PostgreSQL FTS / pg_trgm) │
│  ├── Metadata (space, category, tags,     │
│  │           status, author, date range)  │
│  └── Semantic (pgvector + embedding)      │  ← Phase 2
└──────────────────────────────────────────┘
```

#### Phase 1: 強化 Full-text + Faceted Filter

```sql
-- 新增 GIN index for better CJK support
CREATE INDEX idx_documents_fts ON documents
  USING GIN (to_tsvector('simple', title || ' ' || content));

-- pg_trgm for fuzzy CJK matching
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_documents_trgm_title ON documents USING GIN (title gin_trgm_ops);
CREATE INDEX idx_documents_trgm_content ON documents USING GIN (content gin_trgm_ops);
```

搜尋 API 擴充:
```
GET /api/documents/search?q=EOD&space=it-ops&category=batch&tags=Oracle&status=PUBLISHED&author=jun&from=2026-01-01&to=2026-03-31&sort=relevance
```

#### Phase 2: 語意搜尋（pgvector）

- 文件儲存時產生 embedding（OpenAI text-embedding-3-small 或 local model）
- 存入 `documents.embedding` (vector column, pgvector extension)
- 搜尋時同時做 keyword + semantic，混合排序
- 支援 "Ask" 功能：用自然語言提問，回傳摘要 + 來源文件

---

### 3.7 範本系統

```prisma
model DocumentTemplate {
  id          String   @id @default(cuid())
  name        String
  description String?
  content     String   // Markdown template with {{placeholders}}
  category    String?  // "SOP", "Meeting", "Incident", "Onboarding"
  icon        String?
  isSystem    Boolean  @default(false) // built-in templates
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  creator     User       @relation(fields: [createdBy], references: [id])
  documents   Document[]

  @@map("document_templates")
}
```

#### 內建範本

| 範本名稱 | 用途 | 預設內容結構 |
|----------|------|-------------|
| SOP 標準作業程序 | 操作流程文件 | 目的、適用範圍、前置條件、步驟、異常處理、相關文件 |
| 會議紀錄 | 會議記錄 | 日期、出席者、議程、決議事項、待辦事項 |
| 事件報告 | Incident Report | 事件摘要、時間軸、影響範圍、根因分析、矯正措施 |
| 變更申請 | Change Request | 變更說明、風險評估、回滾計畫、核准簽名 |
| 技術文件 | Tech Spec | 概述、架構、API、資料模型、部署、監控 |
| 新人指南 | Onboarding Guide | 歡迎、系統存取、必讀文件、聯絡人 |
| 問題排查 | Troubleshooting | 症狀、診斷步驟、解決方案、預防措施 |
| 每日交接 | Handover | 今日重點、進行中任務、待追蹤、注意事項 |

---

### 3.8 修訂歷史 — 完整追蹤 + Diff View

#### 版本快照強化

每次儲存時：
1. 將當前 title + content 存入 `DocumentVersion`
2. 記錄 `changeNote`（可選）
3. version 遞增
4. 計算 `wordCount` 與 `readTimeMin`

#### Diff View UI

```
┌─────────────────────────────────────────┐
│ Version History                    [×]  │
│                                         │
│ Comparing: v3 ←→ v5                     │
│ [v1] [v2] [v3] [v4] [v5 current]       │
│                                         │
│ ┌─ v3 (2026-03-20 by Jun) ─┐ ┌─ v5 ─┐ │
│ │ # EOD Batch Procedure     │ │ ...  │ │
│ │ - Step 1: Login to srv01  │ │ ...  │ │
│ │ - Step 2: Run batch.sh    │ │ ...  │ │
│ │                           │ │ ...  │ │
│ │ (red = deleted lines)     │ │(green│ │
│ │                           │ │= add)│ │
│ └───────────────────────────┘ └──────┘ │
│                                         │
│ [Restore v3] [View inline diff]         │
└─────────────────────────────────────────┘
```

---

### 3.9 知識分享 — 可見性層級

| 層級 | 說明 | 存取方式 |
|------|------|----------|
| PUBLIC | 任何人可見（無需登入） | 公開 URL：`/public/docs/:slug` |
| TEAM | 所有已登入成員可見 | 登入後存取 |
| PRIVATE | 僅 Space members 可見 | Space 權限控管 |
| RESTRICTED | 特定人員 | 文件層級指定存取者（未來 Phase） |

#### 分享連結

```
POST /api/documents/:id/share
  → 產生帶 token 的分享連結
  → 可設過期時間、密碼保護、存取次數上限
  → 回傳：https://titan.example.com/shared/:token
```

---

### 3.10 學習與新人引導

```prisma
model ReadingList {
  id          String   @id @default(cuid())
  name        String   // e.g. "新人必讀 - IT Operations"
  description String?
  spaceId     String?
  isRequired  Boolean  @default(false) // 必讀 vs 推薦
  sortOrder   Int      @default(0)
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  creator     User              @relation(fields: [createdBy], references: [id])
  space       KnowledgeSpace?   @relation(fields: [spaceId], references: [id])
  items       ReadingListItem[]

  @@map("reading_lists")
}

model ReadingListItem {
  id            String  @id @default(cuid())
  readingListId String
  documentId    String
  sortOrder     Int     @default(0)
  notes         String? // "重點看第三章"

  readingList   ReadingList @relation(fields: [readingListId], references: [id], onDelete: Cascade)
  document      Document    @relation(fields: [documentId], references: [id])

  @@unique([readingListId, documentId])
  @@map("reading_list_items")
}

model DocumentReadLog {
  id          String   @id @default(cuid())
  documentId  String
  userId      String
  readAt      DateTime @default(now())
  timeSpentSec Int?    // 閱讀時間（秒）
  completed   Boolean  @default(false)

  document    Document @relation(fields: [documentId], references: [id], onDelete: Cascade)
  user        User     @relation(fields: [userId], references: [id])

  @@unique([documentId, userId])
  @@index([userId])
  @@map("document_read_logs")
}
```

#### 新人引導流程

```
新人加入 → 自動指派 required reading lists
  → 知識庫首頁顯示 "待閱讀 (3/10)"
  → 點入文件 → 記錄 readAt + timeSpent
  → 標記完成 → 進度更新
  → 主管可查看團隊閱讀進度 dashboard
```

---

### 3.11 知識連結 — Wikilinks + Graph

```prisma
model DocumentLink {
  id         String @id @default(cuid())
  sourceId   String
  targetId   String
  context    String? // surrounding text for preview

  source     Document @relation("LinkSource", fields: [sourceId], references: [id], onDelete: Cascade)
  target     Document @relation("LinkTarget", fields: [targetId], references: [id], onDelete: Cascade)

  @@unique([sourceId, targetId])
  @@index([targetId])
  @@map("document_links")
}
```

- 支援 `[[文件標題]]` 語法，編輯器自動解析為連結
- 每次儲存時解析 content 中的 `[[...]]`，更新 `DocumentLink` 表
- 文件詳情頁顯示 "反向連結" (backlinks)
- Space 層級的 Graph View（D3.js force-directed graph）

---

### 3.12 知識驗證系統（Guru-inspired）

#### 驗證流程

```
文件發布 → 設定 verifier + verifyIntervalDays (e.g. 90)
  → verifyByDate = publishedAt + 90 days
  → 到期前 7 天：通知 verifier "文件需驗證"
  → verifier 審閱：
      ├── 確認有效 → verifiedAt = now(), verifyByDate += 90 days
      └── 需更新 → 狀態回 DRAFT, 通知 owner
  → 逾期未驗證 → 文件標記 ⚠️ "驗證逾期"
      → 搜尋結果降權
```

#### Cron Job

```
daily-knowledge-verify-check:
  1. SELECT * FROM documents WHERE verifyByDate < NOW() + 7 days AND status = 'PUBLISHED'
  2. For each → create notification for verifier
  3. If verifyByDate < NOW() → mark as "verification overdue"
```

---

### 3.13 評論系統

```prisma
model DocumentComment {
  id          String   @id @default(cuid())
  documentId  String
  parentId    String?  // for threaded comments
  content     String
  resolved    Boolean  @default(false)
  // Inline comment anchor (optional)
  anchorText  String?  // the text being commented on
  anchorStart Int?     // character offset start
  anchorEnd   Int?     // character offset end
  createdBy   String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  document    Document          @relation(fields: [documentId], references: [id], onDelete: Cascade)
  parent      DocumentComment?  @relation("CommentThread", fields: [parentId], references: [id])
  replies     DocumentComment[] @relation("CommentThread")
  creator     User              @relation(fields: [createdBy], references: [id])

  @@index([documentId])
  @@index([parentId])
  @@map("document_comments")
}
```

---

## 四、六方審查（10 輪）

### 審查面板定義

| 角色 | 審查焦點 |
|------|----------|
| **架構師** | 技術可行性、效能、擴展性、技術債 |
| **安全官** | 權限模型、資料安全、稽核追蹤、合規 |
| **UX 設計師** | 使用者體驗、學習曲線、操作效率 |
| **PM (產品)** | 需求完整度、優先序、ROI、交付風險 |
| **QA 工程師** | 可測試性、邊界案例、資料一致性 |
| **終端使用者** | 日常使用痛點、實際操作流程、遷移成本 |

---

### 第 1 輪 — 知識結構 (Space > Category > Document)

| 角色 | 意見 |
|------|------|
| **架構師** | 三層結構合理。建議 Category 支援巢狀（已設計 parentId）。Space 的 slug 需考慮唯一性衝突。Document 的 spaceId nullable 是好的遷移策略，但需設 deadline 強制關聯。 |
| **安全官** | SpaceMember 的 RBAC 模型正確。需確保 API 層每個 endpoint 都檢查 space membership。Document visibility 與 Space visibility 衝突時，取嚴格者。 |
| **UX 設計師** | 三層對小團隊可能過重。建議：Space 可選（小團隊用 "General" 預設 space），Category 扁平化呈現（側邊欄 tag filter 而非深層樹狀）。 |
| **PM** | 結構對標 Confluence，企業用戶熟悉。但 MVP 應先做 Space + Document，Category 可 Phase 2。避免一次做太多。 |
| **QA** | 測試要點：Document 跨 Space 移動、Category 刪除時文件歸屬、Space 刪除的 cascade 行為。需測試 orphan 文件處理。 |
| **使用者** | 目前扁平 tree 已夠用但混亂。Space 分類很需要（IT vs HR 文件混在一起）。但不要強制我每次都選 category。 |

**決議**: MVP 做 Space + Document（Category 選填）。Category 巢狀列為 Phase 2。

---

### 第 2 輪 — 版本控制 (Draft/Publish + Diff)

| 角色 | 意見 |
|------|------|
| **架構師** | Draft/Publish 狀態機清晰。Diff 用 `jsdiff` 比 `diff-match-patch` 更適合（輸出 unified diff，前端 render 容易）。建議 DocumentVersion 也存 JSON 格式（Tiptap doc），不只 Markdown string，以利精確 diff。 |
| **安全官** | 審核流程 = 四眼原則（maker-checker），符合銀行合規要求。建議記錄每次狀態轉換至 audit log（已有 AuditService）。 |
| **UX 設計師** | 狀態 badge 要明顯：Draft(灰)、In Review(黃)、Published(綠)、Archived(紅)。Diff view 建議預設 inline（比 side-by-side 在窄螢幕更實用），可切換。 |
| **PM** | 核心功能，必須 MVP。但 IN_REVIEW 流程對小團隊可能太重。建議：EDITOR 以上可直接 publish，IN_REVIEW 為 optional（Space 設定決定是否啟用）。 |
| **QA** | 測試重點：狀態轉換的每個邊界（e.g. ARCHIVED 能否直接 publish？不行，需先 restore to DRAFT）。concurrent edit 時 version conflict 的處理。 |
| **使用者** | Diff view 非常需要！目前版本歷史只能看 raw content 很痛苦。希望能一鍵對比 "上次發布版" vs "當前草稿"。 |

**決議**: MVP 含 DRAFT/PUBLISHED/ARCHIVED。IN_REVIEW 為 Space-level 可選功能。Diff view 用 `jsdiff` + inline 模式為預設。

---

### 第 3 輪 — Rich Editor (Tiptap)

| 角色 | 意見 |
|------|------|
| **架構師** | Tiptap 是正確選擇。但 Markdown 儲存格式有風險 — 複雜格式（nested table、colored text）Markdown 表達力不足。建議雙存：DB 存 Tiptap JSON + 產出 Markdown 作為 export/search index。 |
| **安全官** | Tiptap output 需 sanitize（已有 sanitizeHtml）。Image URL 需驗證為允許的 domain（防止 SSRF via img src）。 |
| **UX 設計師** | Slash command menu 是關鍵 UX 提升。建議：`/table`、`/code`、`/image`、`/file`、`/template`、`/link-doc`（插入文件連結）。Toolbar 保持極簡（bold, italic, heading, list），進階靠 slash command。 |
| **PM** | Tiptap bundle size 偏大（~200KB gzipped with extensions）。需確認 Next.js 動態載入。先上基本 extensions，collaborative editing 列 Phase 3。 |
| **QA** | 測試：Markdown ↔ Tiptap JSON 轉換的 round-trip fidelity。大文件（10,000+ 字）效能。手機瀏覽器相容性。Copy-paste from Word/Google Docs 的格式保持。 |
| **使用者** | 終於有 table 了！目前寫 Markdown table 很痛苦。希望支援從 Excel 貼上自動轉 table。 |

**決議**: 採用 Tiptap。DB 主存 Tiptap JSON（新欄位 `contentJson`），保留 `content` 欄位存 Markdown（向後相容 + search indexing）。Dynamic import 控制 bundle size。

---

### 第 4 輪 — 檔案管理

| 角色 | 意見 |
|------|------|
| **架構師** | Presigned URL 直傳 S3/R2 是正確架構。需設檔案大小上限（建議 50MB）。PDF text extraction 用 `pdf-parse`（Node.js）或背景 worker。 |
| **安全官** | 必須：檔案類型白名單（不接受 .exe, .bat, .sh 等執行檔）、virus scan（ClamAV 或雲端方案）、storage 加密（S3 SSE）。上傳的檔案 URL 不可猜測（使用 UUID path）。 |
| **UX 設計師** | 附件區域放在文件底部（像 email attachment）+ 編輯器內可直接拖拽插入。圖片直接 inline 顯示，其他檔案顯示為 file card（icon + name + size + download）。 |
| **PM** | MVP 先做圖片 + PDF。Office 預覽可 Phase 2（需 LibreOffice server 或第三方服務，成本考量）。 |
| **QA** | 測試：上傳失敗 retry、大檔案上傳中斷、檔名特殊字元（中文、空格、emoji）、同名檔案覆蓋邏輯。 |
| **使用者** | 最需要 PDF！很多 vendor 文件是 PDF，目前只能貼連結。Excel 也很需要（報表附件）。 |

**決議**: MVP 支援圖片（JPEG/PNG/GIF/WebP）+ PDF（含預覽）。Office 格式 Phase 2。檔案上限 50MB。必須有 MIME type 白名單 + 檔名清理。

---

### 第 5 輪 — 知識生命週期

| 角色 | 意見 |
|------|------|
| **架構師** | 狀態機設計完整。RETIRED 與 ARCHIVED 差異需明確：ARCHIVED = 暫時下架可恢復，RETIRED = 正式廢止（保留紀錄但不可恢復使用）。建議 RETIRED 文件 content 仍可讀（稽核用）。 |
| **安全官** | RETIRED 文件絕不可刪除（法規保留要求）。Soft delete only。所有狀態轉換必須記 audit log。建議加 retention policy：RETIRED 後 N 年自動 flag for review。 |
| **UX 設計師** | 文件列表需清楚區分狀態。建議：左側 sidebar 加 filter tabs（All / Draft / Published / Archived）。RETIRED 文件顯示 strikethrough + 浮水印 "已廢止"。 |
| **PM** | MVP: DRAFT → PUBLISHED → ARCHIVED。RETIRED + IN_REVIEW 為 Phase 2。retention policy 為 Phase 3。 |
| **QA** | 測試：每個狀態轉換路徑、非法轉換（e.g. ARCHIVED → PUBLISHED 應禁止，需先 restore to DRAFT）、權限檢查。 |
| **使用者** | Archive 很需要。目前刪除就真的沒了，很怕誤刪。希望有 "回收站" 概念。 |

**決議**: MVP 做 DRAFT/PUBLISHED/ARCHIVED + soft delete（trash）。RETIRED 列 Phase 2。所有狀態轉換寫 audit log。

---

### 第 6 輪 — 搜尋

| 角色 | 意見 |
|------|------|
| **架構師** | pg_trgm 對 CJK 效能比 ILIKE 好很多。Phase 2 pgvector 需注意 embedding 更新策略（文件更新時重算）。建議用 background job 非同步更新 embedding，不阻塞 save。 |
| **安全官** | 搜尋結果必須尊重權限 — 使用者不該搜到無權存取的文件。PRIVATE space 文件不可出現在非成員搜尋結果。 |
| **UX 設計師** | Faceted search UI：左側 filter panel（Space / Category / Tags / Status / Author / Date range），右側結果列表。搜尋結果 highlight 關鍵字 + snippet。 |
| **PM** | Phase 1 強化 FTS + faceted filter 已足夠。語意搜尋（Phase 2）是差異化功能但需 OpenAI API 成本。先用 pg_trgm 解決 CJK 搜尋品質問題。 |
| **QA** | 測試：CJK 搜尋準確度、大量文件（1000+）搜尋效能、faceted filter 組合、搜尋結果排序穩定性。 |
| **使用者** | 現在搜尋中文常找不到。希望能用 tag 過濾（e.g. 只搜 "Oracle" tag 的文件）。 |

**決議**: Phase 1 加 pg_trgm + faceted filter（space/tag/status/author）。Phase 2 加 pgvector 語意搜尋。搜尋結果強制 permission filter。

---

### 第 7 輪 — 範本

| 角色 | 意見 |
|------|------|
| **架構師** | Template 用 Markdown string 儲存即可。`{{placeholder}}` 語法需前端配合（建立文件時顯示填寫 form）。isSystem template 需 seed script。 |
| **安全官** | 系統範本不可被一般使用者修改或刪除。自訂範本的 content 需 sanitize。 |
| **UX 設計師** | 新增文件時顯示 template gallery（grid layout with preview）。常用範本 pin 到頂部。空白文件也是一個選項（不強制選範本）。 |
| **PM** | MVP 做 4 個系統範本（SOP、會議、事件、技術文件）+ 自訂範本。Placeholder 填寫 Phase 2。 |
| **QA** | 測試：從 template 建立文件後修改不影響 template。template 刪除時已建文件不受影響（templateId 保留但 template 可 null）。 |
| **使用者** | SOP template 最需要。每次寫 SOP 格式都不一致，有範本可以統一。 |

**決議**: MVP 含 4 個 system templates + 使用者自訂 template。Template gallery UI。

---

### 第 8 輪 — 知識驗證

| 角色 | 意見 |
|------|------|
| **架構師** | Cron job 查詢 verifyByDate 效能沒問題（indexed）。通知整合現有 notification 系統。需注意：verifier 離職時的 reassignment 機制。 |
| **安全官** | 銀行稽核要求 SOP 定期覆核，此功能直接對應合規需求。驗證紀錄需完整保留（who verified, when, result）。建議加 verification audit trail table。 |
| **UX 設計師** | 文件列表加 "驗證狀態" 欄位（✅ 已驗證 / ⚠️ 即將到期 / ❌ 逾期）。Dashboard 加 "待驗證文件" widget。 |
| **PM** | 差異化功能，優先序高。MVP 做基本驗證流程（assign verifier + interval + reminder）。Dashboard widget Phase 2。 |
| **QA** | 測試：驗證到期邊界（today = verifyByDate 算到期嗎？）、verifier 變更、interval 修改後的 date 重算。 |
| **使用者** | 超需要！目前 SOP 寫完就沒人管了，半年後可能已過時。有自動提醒就不怕忘記更新。 |

**決議**: MVP 含基本驗證流程。Daily cron check + notification。Verification history 記錄。

---

### 第 9 輪 — 知識分享 + 連結

| 角色 | 意見 |
|------|------|
| **架構師** | Share token 需 cryptographically random（`crypto.randomUUID()`）。Token 存 DB 含 expiresAt。Wikilink 解析用 regex `\[\[(.+?)\]\]` 在 save 時處理。Graph view 用 D3 force graph，限制顯示 200 nodes 以內避免效能問題。 |
| **安全官** | Public share link = 資料外洩風險。需：(1) 只有 ADMIN+ 能產生 share link，(2) share link 可隨時撤銷，(3) access log 記錄每次 share link 存取，(4) 敏感 Space 禁止產生 share link。 |
| **UX 設計師** | Share modal：選擇可見性 → 複製連結 → 設定過期。Graph view 作為 Space 的 "探索" 視圖，hover 顯示 title + snippet。 |
| **PM** | Share link MVP。Graph view 是 nice-to-have（Phase 2）。Wikilinks MVP（低成本高價值）。 |
| **QA** | 測試：share token 過期、撤銷後存取、同時多人存取 share link、wikilink target 被刪除時的 graceful degradation。 |
| **使用者** | Wikilink 很讚！目前文件間要手動貼 URL 很不方便。Share link 偶爾需要分享給外部廠商。 |

**決議**: MVP 含 wikilinks + basic share link（ADMIN only, with expiry）。Graph view Phase 2。

---

### 第 10 輪 — 學習與引導 + 總體評估

| 角色 | 意見 |
|------|------|
| **架構師** | ReadingList + ReadLog 模型簡潔。readTimeMin 透過 word count 估算即可（中文約 300 字/分鐘）。總體架構：新增 7 個 model，migration 需分批（避免一次大 migration）。建議拆 3-4 個 migration batch。 |
| **安全官** | 總體安全評估：(1) 每個新 endpoint 需 auth middleware（已有模式），(2) SpaceMember RBAC 需 middleware 級別 enforcement，(3) 新增的 share link / public access 是最大攻擊面 — 需額外 rate limiting。建議做 threat modeling 後再開發 share link。 |
| **UX 設計師** | 總體 UX 風險：功能太多怕使用者迷路。建議：知識庫首頁 = dashboard（最近文件 + 待驗證 + 待閱讀 + 快速新增），而非直接進文件列表。Progressive disclosure — 進階功能藏在選單裡。 |
| **PM** | 交付建議見下方 Phase 規劃。估計 MVP (Phase 1) 需 3-4 週開發。總計約 8-10 週完成 Phase 1-2。ROI 高：直接解決目前最大的知識管理痛點 + 合規需求。 |
| **QA** | 測試策略：(1) Unit test 每個 service method，(2) API integration test 每個 endpoint + permission，(3) E2E test 核心流程（create → edit → publish → search → share），(4) Migration test（v1 data → v2 schema）。 |
| **使用者** | 整體很期待。最希望先有：Space 分類 + Draft/Publish + Diff view + 驗證提醒。其他可以慢慢來。 |

---

## 五、Phase 規劃

### Phase 1 — MVP（3-4 週）

| 項目 | 內容 | 優先序 |
|------|------|--------|
| **1a** | KnowledgeSpace model + CRUD API + UI | P0 |
| **1b** | Document status (DRAFT/PUBLISHED/ARCHIVED) + 狀態轉換 API | P0 |
| **1c** | DocumentVersion 強化（存 title, changeNote）+ Diff view (jsdiff) | P0 |
| **1d** | Tiptap editor 替換 MarkdownEditor（基本 extensions） | P0 |
| **1e** | 搜尋強化：pg_trgm + faceted filter (space/tag/status) | P1 |
| **1f** | 知識驗證基本流程（verifier + interval + daily cron reminder） | P1 |
| **1g** | 4 個 system templates + template gallery | P1 |
| **1h** | 圖片 + PDF 附件上傳（presigned URL） | P1 |
| **1i** | Wikilinks `[[...]]` 解析 + backlinks 顯示 | P2 |
| **1j** | v1 → v2 資料遷移 script | P0 |

### Phase 2（3-4 週）

| 項目 | 內容 |
|------|------|
| **2a** | KnowledgeCategory model + nested categories |
| **2b** | IN_REVIEW 審核流程（optional per Space） |
| **2c** | RETIRED 狀態 + retention policy |
| **2d** | Office 檔案預覽（DOCX/XLSX/PPTX） |
| **2e** | Share link（token-based, with expiry + access log） |
| **2f** | Graph view（D3 force graph） |
| **2g** | ReadingList + 閱讀進度追蹤 |
| **2h** | pgvector 語意搜尋 |
| **2i** | Document comments（page-level + inline） |

### Phase 3（未來）

- Collaborative editing（Tiptap + Yjs）
- AI "Ask" 功能（語意搜尋 + 摘要回答）
- Outline 深度 API 同步（雙向）
- PDF export（含版本浮水印）
- Content analytics dashboard
- External integration（Slack/Discord bot 搜尋知識庫）

---

## 六、Migration 策略（v1 → v2）

### 資料遷移

```sql
-- Step 1: 建立 default Space
INSERT INTO knowledge_spaces (id, name, slug, description, visibility, "createdBy", "updatedBy")
VALUES ('default-space', '一般知識庫', 'general', '遷移自 v1 的文件', 'TEAM', 'system', 'system');

-- Step 2: 為所有既有文件設定 spaceId + status
UPDATE documents SET
  "spaceId" = 'default-space',
  status = 'PUBLISHED',  -- 既有文件視為已發布
  "publishedAt" = "updatedAt",
  "publishedBy" = "createdBy"
WHERE "spaceId" IS NULL;

-- Step 3: DocumentVersion 補 title 欄位
ALTER TABLE document_versions ADD COLUMN title TEXT;
UPDATE document_versions dv SET title = (
  SELECT d.title FROM documents d WHERE d.id = dv."documentId"
);
```

### 向後相容

- `spaceId` nullable → 舊 API endpoint 仍可運作
- 新 UI 部署後，舊文件自動出現在 "一般知識庫" Space
- 逐步遷移：使用者可將文件拖拽到正確 Space

---

## 七、技術架構總覽

```
┌────────────────────────────────────────────────────────────────┐
│                         Frontend (Next.js)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Knowledge Hub │  │ Tiptap Editor│  │ Search + Filters     │  │
│  │ (Spaces,     │  │ (Rich edit,  │  │ (Faceted, FTS,       │  │
│  │  Doc list,   │  │  slash cmd,  │  │  semantic - Phase 2) │  │
│  │  status tabs)│  │  image drag) │  │                      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│  ┌──────┴────────────────┴──────────────────────┘              │
│  │  Version History + Diff View (jsdiff)                       │
│  │  Template Gallery | Attachment Manager | Comments           │
│  └─────────────────────────────────────────────────────────────│
└────────────────────────────────┬───────────────────────────────┘
                                 │ API Routes
┌────────────────────────────────┴───────────────────────────────┐
│                      API Layer (Next.js Routes)                 │
│  /api/spaces/*    /api/documents/*    /api/uploads/*            │
│  /api/templates/* /api/search/*       /api/reading-lists/*      │
│                                                                 │
│  Middleware: withAuth → checkSpaceMembership → handler           │
└────────────────────────────────┬───────────────────────────────┘
                                 │
┌────────────────────────────────┴───────────────────────────────┐
│                      Service Layer                              │
│  DocumentService (enhanced)  │  SpaceService                    │
│  VersionService (diff)       │  TemplateService                 │
│  AttachmentService           │  VerificationService             │
│  SearchService               │  ReadingListService              │
└────────────────────────────────┬───────────────────────────────┘
                                 │
┌────────────────────────────────┴───────────────────────────────┐
│  PostgreSQL (Prisma)           │  S3/R2 (File Storage)          │
│  + pg_trgm (fuzzy search)     │  + CDN (Cloudflare)            │
│  + pgvector (Phase 2)         │                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 八、成功指標

| 指標 | 目標 | 衡量方式 |
|------|------|----------|
| 文件組織效率 | Space 使用率 > 80% 文件有 Space 歸屬 | DB query |
| 版本控制採用 | > 50% 文件有 2+ 個 published version | DB query |
| 搜尋品質 | CJK 搜尋滿意度提升（使用者回饋） | Survey |
| 知識驗證覆蓋 | > 70% PUBLISHED 文件有設定 verifier | DB query |
| 新人引導 | 新人 30 天內完成 required reading > 80% | ReadLog query |
| 範本使用率 | > 30% 新文件使用範本建立 | templateId not null |

---

*文件結束 — TITAN Knowledge Base v2 Design Document*
