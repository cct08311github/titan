import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import { createDocumentSchema } from "@/validators/document-validators";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { parsePagination, buildPaginationMeta } from "@/lib/pagination";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);
  const spaceId = searchParams.get("spaceId");

  const where = spaceId ? { spaceId } : {};

  const select = {
    id: true,
    parentId: true,
    spaceId: true,
    title: true,
    slug: true,
    status: true,
    version: true,
    createdAt: true,
    updatedAt: true,
    creator: { select: { id: true, name: true } },
    updater: { select: { id: true, name: true } },
    _count: { select: { children: true } },
  } as const;

  const [docs, total] = await Promise.all([
    prisma.document.findMany({
      where,
      select,
      orderBy: [{ parentId: "asc" }, { title: "asc" }],
      skip,
      take: limit,
    }),
    prisma.document.count({ where }),
  ]);

  return success({ items: docs, pagination: buildPaginationMeta(total, { page, limit, skip }) });
});

// ── Document templates (Issue #967) ──
const TEMPLATES: Record<string, { title: string; content: string }> = {
  sop: {
    title: "SOP — [作業名稱]",
    content: `# SOP — [作業名稱]

## 目的
說明此作業標準流程的目的與適用範圍。

## 適用範圍
- 適用部門：
- 適用系統：

## 前置條件
1.
2.

## 操作步驟
### 步驟 1：
- 操作說明：
- 預期結果：

### 步驟 2：
- 操作說明：
- 預期結果：

## 異常處理
| 異常情境 | 處理方式 | 聯絡人 |
|---------|---------|--------|
|         |         |        |

## 變更紀錄
| 版本 | 日期 | 修改者 | 修改說明 |
|------|------|--------|---------|
| 1.0  |      |        | 初版建立 |
`,
  },
  "meeting-notes": {
    title: "會議紀錄 — [主題]",
    content: `# 會議紀錄 — [主題]

## 會議資訊
- **日期**：
- **時間**：
- **地點/會議室**：
- **主持人**：
- **記錄人**：
- **出席者**：

## 議程
1.
2.
3.

## 討論事項
### 議題一
- 討論內容：
- 決議：

### 議題二
- 討論內容：
- 決議：

## 待辦事項（Action Items）
| # | 待辦事項 | 負責人 | 預計完成日 | 狀態 |
|---|---------|--------|-----------|------|
| 1 |         |        |           | 待處理 |
| 2 |         |        |           | 待處理 |

## 下次會議
- 日期：
- 議程預告：
`,
  },
  "incident-report": {
    title: "事件報告 — [事件編號]",
    content: `# 事件報告 — [事件編號]

## 事件摘要
- **事件等級**：P1 / P2 / P3 / P4
- **發生時間**：
- **發現時間**：
- **恢復時間**：
- **影響範圍**：
- **影響用戶數**：

## 事件經過
### 時間軸
| 時間 | 事件 | 執行者 |
|------|------|--------|
|      | 事件發生 | - |
|      | 發現異常 |   |
|      | 開始處置 |   |
|      | 服務恢復 |   |

## 根因分析（Root Cause）


## 處置措施
### 立即處置
1.

### 永久修復
1.

## 改善計畫
| # | 改善項目 | 負責人 | 預計完成日 | 狀態 |
|---|---------|--------|-----------|------|
| 1 |         |        |           | 待處理 |

## 教訓與經驗
-
`,
  },
  "tech-doc": {
    title: "技術文件 — [系統/元件名稱]",
    content: `# 技術文件 — [系統/元件名稱]

## 概述
簡要說明此系統或元件的用途與定位。

## 架構
### 系統架構圖
（請描述或插入架構圖）

### 技術棧
| 層級 | 技術 | 版本 |
|------|------|------|
| 前端 |      |      |
| 後端 |      |      |
| 資料庫 |   |      |

## 環境設定
### 前置需求
-

### 安裝步驟
\`\`\`bash
# 安裝指令
\`\`\`

### 環境變數
| 變數名 | 說明 | 範例值 |
|--------|------|--------|
|        |      |        |

## API 文件
### 端點列表
| 方法 | 路徑 | 說明 |
|------|------|------|
| GET  |      |      |
| POST |      |      |

## 部署流程
1.
2.

## 監控與告警
-

## 常見問題（FAQ）
### Q:
A:

## 維護紀錄
| 日期 | 修改者 | 修改說明 |
|------|--------|---------|
|      |        | 初版建立 |
`,
  },
};

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();

  const raw = await req.json();
  const { title, content, parentId, spaceId, templateType } = validateBody(createDocumentSchema, raw);

  // Apply template if specified
  const template = templateType ? TEMPLATES[templateType] : null;
  const finalTitle = template && title === "" ? template.title : title;
  const finalContent = template ? template.content : (content ?? "");

  const base = finalTitle
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
    .replace(/^-|-$/g, "");
  const timestamp = Date.now();
  const slug = `${base}-${timestamp}`;

  const doc = await prisma.document.create({
    data: {
      parentId: parentId || null,
      spaceId: spaceId || null,
      title: finalTitle,
      content: finalContent,
      slug,
      createdBy: session.user.id,
      updatedBy: session.user.id,
      version: 1,
    },
    include: {
      creator: { select: { id: true, name: true } },
      updater: { select: { id: true, name: true } },
    },
  });

  return success(doc, 201);
});
