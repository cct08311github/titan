# TITAN 專案說明

**TITAN** — **T**eam **I**ntegrated **T**ask **A**nd k**N**owledge

銀行 IT 團隊現代化協作平台（自建 Next.js 應用，部署於封閉內網）

---

## 專案結構

```
titan/
├── README.md                    # 完整提案文件（10 章節）
├── docker-compose.yml           # 主要部署配置
├── docker-compose.dev.yml       # 開發環境配置
├── docker-compose.monitoring.yml# 監控（Prometheus + Grafana）
├── Dockerfile                   # 應用容器定義
├── docs/
│   ├── PROJECT.md               # 本文件（文件索引）
│   ├── proposal.pptx            # 簡報版提案
│   │
│   ├── ── 架構與設計 ──
│   ├── architecture-v3.md       # 系統架構說明（最新版）
│   ├── architecture-review-v3.md# 架構審查報告（最新版）
│   ├── auth-design.md           # 認證設計文件
│   ├── database-plan.md         # 資料庫設計計畫
│   │
│   ├── ── 品質與合規 ──
│   ├── code-review-v3.md        # Code Review 報告（最新版）
│   ├── qa-report-v3.md          # QA 測試報告（最新版）
│   ├── spec-compliance-report-v3.md # 規格合規報告（最新版）
│   ├── audit-plan.md            # 稽核計畫
│   ├── defect-tracking.md       # 缺陷追蹤
│   │
│   ├── ── CEO/CIO 管理文件（2026-03 新增）──
│   ├── roi-analysis.md          # ROI 分析報告
│   ├── sla-definition.md        # SLA 服務水準協議
│   ├── disaster-recovery.md     # 災難復原計畫（DR Plan）
│   ├── compliance-mapping.md    # 合規映射表（金管會 / ISO 27001）
│   ├── support-plan.md          # L1/L2 支援計畫
│   │
│   ├── ── 部署與維運 ──
│   ├── nginx-setup.md           # Nginx 設定說明
│   ├── os-hardening.md          # 作業系統強化
│   ├── network-assessment.md    # 網路評估
│   ├── monitoring-plan.md       # 監控計畫
│   ├── backup-strategy.md       # 備份策略
│   ├── cutover-runbook.md       # 切換作業手冊
│   │
│   ├── ── 使用者與訓練 ──
│   ├── training-guide.md        # 使用者訓練指南
│   ├── import-guide.md          # 資料匯入指南
│   ├── homepage-customization.md# 首頁客製化說明
│   │
│   ├── ── 專案規劃 ──
│   ├── project-charter.md       # 專案章程
│   ├── resource-request.md      # 資源申請
│   ├── go-live-checklist.md     # 上線檢查清單
│   ├── uat-plan.md              # UAT 測試計畫
│   ├── post-launch-plan.md      # 上線後計畫
│   ├── integration-checklist.md # 整合檢查清單
│   ├── timesheet-reporting.md   # 工時報表說明
│   ├── account-integration.md   # 帳號整合說明
│   ├── version-manifest.md      # 版本清單
│   │
│   └── auth/                    # 認證相關文件目錄
│       └── security/            # 資安相關文件目錄
```

---

## GitHub Issue 結構

| Phase | Issues | 內容 |
|-------|--------|------|
| A | #1-#6 | 規劃與基礎準備 |
| B | #7-#12 | 基礎設施與安全底座 |
| C | #14-#22 | 應用建置與整合 |
| D | #27-#30 | 維運與合規 |
| E | #31-#37 | 測試、上線與收斂 |

---

## 分工

| 角色 | 負責 |
|------|------|
| zug (Claude Opus) | 規劃、架構、Issue 管理、Code Review |
| cct (OpenClaw) | 程式開發、PR 提交、CI 問題處理 |

---

## 開發流程

```
zug 建 Issue → cct 開 branch 開發 → 提 PR → zug Code Review → 合併
```

---

## 文件版本說明

各技術文件以 `-v3` 後綴為最新版本。舊版（無後綴、`-v2`）已於 Issue #171 清理完畢。

CEO/CIO 管理文件於 2026-03-24 首次建立（v1.0），審核週期詳見各文件說明。
