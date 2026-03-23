# TITAN 專案說明

**TITAN** — **T**eam **I**ntegrated **T**ask **A**nd k**N**owledge

銀行 IT 團隊現代化協作平台

## 專案結構

```
titan/
├── README.md          # 完整提案文件（10 章節）
├── docker-compose.yml # Phase 1 部署配置
├── docs/
│   ├── PROJECT.md     # 本文件
│   └── proposal.pptx  # 簡報版提案
└── src/               # 自開發膠水層（Phase 4+）
```

## GitHub Issue 結構

| Phase | Issues | 內容 |
|-------|--------|------|
| A | #1-#6 | 規劃與基礎準備 |
| B | #7-#12 | 基礎設施與安全底座 |
| C | #14-#22 | 應用建置與整合 |
| D | #27-#30 | 維運與合規 |
| E | #31-#37 | 測試、上線與收斂 |

## 分工

| 角色 | 負責 |
|------|------|
| zug (Claude Opus) | 規劃、架構、Issue 管理、Code Review |
| cct (OpenClaw) | 程式開發、PR 提交、CI 問題處理 |

## 開發流程

```
zug 建 Issue → cct 開 branch 開發 → 提 PR → zug Code Review → 合併
```
