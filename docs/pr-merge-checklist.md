# PR 合併檢查清單

## 必要條件（缺一不可）

- [ ] CI 測試全過
- [ ] 如果改了 API response 格式 → 必須跑 36 個 E2E smoke tests
- [ ] 如果改了 API response 格式 → 必須更新 types/api-responses.ts
- [ ] 如果新增頁面 → 必須新增對應 E2E smoke test
- [ ] 真實瀏覽器驗證截圖（至少登入 + 受影響頁面）

## API 變更特別規範

- 修改任何 API route 的 response shape = **breaking change**
- 必須同時更新所有前端消費者
- 使用 `extractData()` / `extractItems()` 消費 API
- 禁止裸 `res.json()`，一律使用 `success()` / `error()` wrapper

## Contract Test 規範

- 任何 API response 結構變更 → 必須更新 `__tests__/contracts/api-response-contracts.test.ts`
- 任何 API response 結構變更 → 必須更新 `types/api-responses.ts`
- 新增 API endpoint → 必須在上述兩個檔案加入對應定義與測試

## 審閱者注意事項

1. **檢查 response shape 一致性**：`ok` + `data` envelope 是否正確
2. **檢查分頁格式**：paginated endpoint 必須回傳 `{ items, pagination }`
3. **檢查錯誤格式**：錯誤必須回傳 `{ ok: false, error, message }`
4. **檢查安全性**：不得回傳密碼、token 等敏感欄位
5. **檢查測試覆蓋**：有無對應的 contract test 和 E2E smoke test
