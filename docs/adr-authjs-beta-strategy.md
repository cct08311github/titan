# ADR: Auth.js v5 Beta Version Strategy

## Status
Accepted

## Context
TITAN 使用 Auth.js v5 (next-auth@5.0.0-beta.30) 作為認證框架。
Auth.js v5 目前仍為 beta 階段，API 可能在不同 beta 版本間發生 breaking changes。

在 40+ PR 合併後的穩定性驗證中，發現 beta 版本自動升級可能引入不可預期的問題。

## Decision
1. **固定版本號**：將 next-auth 從 `^5.0.0-beta.30` 改為 `5.0.0-beta.30`（移除 caret）
2. **鎖定 package-lock.json**：確保 CI/CD 與所有開發者使用完全相同的版本
3. **設定 .npmrc**：加入 `save-exact=true` 確保未來安裝也使用精確版本
4. **升級策略**：
   - 當 Auth.js v5 正式發布 GA 時，安排專門的升級 sprint
   - beta 版本間的升級需要專門的 PR，包含完整的 auth 相關測試
   - 禁止在其他 feature PR 中順便升級 auth 版本

## Consequences
### Positive
- 避免 CI/CD 或不同開發者環境間的版本不一致
- 降低因 beta 升級導致的隱性 breaking changes 風險
- Auth 相關變更有明確的追蹤點

### Negative
- 不會自動獲得 beta 的 bug fix
- 需要手動追蹤 Auth.js changelog

### Risks
- beta.30 可能存在已知但未修復的 security issue
- Auth.js v5 GA 發布時可能需要較大的 migration effort

## Mitigation
- 每月檢查 Auth.js changelog，評估是否需要升級
- 維護 auth 相關的測試覆蓋率，確保升級時有足夠的迴歸測試
- 若發現 security vulnerability，立即評估並升級
