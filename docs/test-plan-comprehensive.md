# TITAN 系統全面測試方案

**版本**: 1.0.0-rc.1
**測試範圍**: 全系統 14 模組 + 跨模組整合 + 安全 + 效能
**測試案例總數**: 1,247 個不重複案例
**預計執行時間**: ~40 小時（自動化+手動混合）

---

## 一、測試案例分佈

| 模組 | CRUD | 業務邏輯 | UI 互動 | 錯誤處理 | 邊界值 | 整合 | 小計 |
|------|------|---------|---------|---------|--------|------|------|
| 1. 認證與安全 | 15 | 25 | 20 | 30 | 15 | 10 | **115** |
| 2. Dashboard/駕駛艙 | 5 | 10 | 15 | 5 | 5 | 15 | **55** |
| 3. 看板（任務管理）| 30 | 35 | 25 | 20 | 15 | 20 | **145** |
| 4. 甘特圖 | 5 | 10 | 20 | 5 | 10 | 10 | **60** |
| 5. 年度計畫 | 20 | 15 | 15 | 10 | 10 | 10 | **80** |
| 6. KPI | 20 | 20 | 15 | 10 | 10 | 10 | **85** |
| 7. 工時紀錄 | 25 | 20 | 25 | 15 | 15 | 15 | **115** |
| 8. 報表 | 10 | 15 | 20 | 10 | 5 | 10 | **70** |
| 9. 知識庫 | 20 | 10 | 15 | 10 | 10 | 5 | **70** |
| 10. 團隊動態 | 5 | 5 | 10 | 5 | 3 | 7 | **35** |
| 11. 系統管理 | 20 | 10 | 15 | 10 | 10 | 5 | **70** |
| 12. 個人設定 | 10 | 5 | 10 | 10 | 5 | 5 | **45** |
| 13. PMO 項目管理 | 40 | 45 | 35 | 25 | 20 | 25 | **190** |
| 14. 全域 UI/UX | — | — | 40 | 10 | 10 | — | **60** |
| 15. 跨模組 E2E 旅程 | — | — | — | — | — | 52 | **52** |
| **合計** | **225** | **225** | **280** | **175** | **143** | **197** | **1,247** |

---

## 二、詳細測試案例

### 模組 1：認證與安全（115 案例）

#### 1.1 登入（20 案例）
| ID | 案例 | 步驟 | 預期結果 |
|----|------|------|---------|
| AUTH-001 | 正確帳密登入 | 輸入 admin/1234 → 點登入 | 跳轉 /dashboard |
| AUTH-002 | 錯誤密碼 | 輸入 admin/wrong → 點登入 | 顯示「帳號或密碼錯誤」|
| AUTH-003 | 空帳號 | 不填帳號 → 點登入 | HTML5 必填驗證 |
| AUTH-004 | 空密碼 | 填帳號不填密碼 → 點登入 | HTML5 必填驗證 |
| AUTH-005 | 不存在的帳號 | 輸入 nobody/1234 → 登入 | 帳號或密碼錯誤 |
| AUTH-006 | SQL injection | 輸入 `' OR 1=1 --`/1234 | 安全拒絕 |
| AUTH-007 | XSS payload | 輸入 `<script>alert(1)</script>` | 安全處理 |
| AUTH-008 | 超長帳號（500字） | 填 500 字帳號 | 安全處理或截斷 |
| AUTH-009 | 特殊字元帳號 | 輸入 `admin@titan.local` | 正常登入 |
| AUTH-010 | Unicode 帳號 | 輸入中文帳號 | 帳號或密碼錯誤 |
| AUTH-011 | 連續 5 次錯誤 | 重複錯誤登入 5 次 | 觸發帳號鎖定 |
| AUTH-012 | 鎖定後正確登入 | 鎖定中輸入正確密碼 | 仍被拒（等鎖定解除）|
| AUTH-013 | Tab 鍵切換 | Tab 從帳號到密碼到按鈕 | focus 順序正確 |
| AUTH-014 | Enter 鍵提交 | 填完按 Enter | 等同點登入按鈕 |
| AUTH-015 | 密碼欄位遮罩 | 輸入密碼 | 顯示 ●●●● |
| AUTH-016 | 瀏覽器自動填入 | Chrome 自動填入帳密 | 正常登入 |
| AUTH-017 | 重複點擊登入 | 快速連點 3 次 | 不會多次提交 |
| AUTH-018 | 未登入訪問 /dashboard | 直接打開 URL | 重導到 /login |
| AUTH-019 | 未登入訪問 /api/tasks | curl 不帶 cookie | 401 |
| AUTH-020 | 登入後瀏覽器返回 | 登入後按 Back | 不回到 login 頁 |

#### 1.2 登出（8 案例）
| ID | 案例 | 預期 |
|----|------|------|
| AUTH-021 | 正常登出 | 跳轉 /login |
| AUTH-022 | 登出後訪問 /dashboard | 重導 /login |
| AUTH-023 | 登出後瀏覽器返回 | 不顯示舊頁面 |
| AUTH-024 | 多 tab 登出（Tab A 登出） | Tab B 也應失效 |
| AUTH-025 | API token 登出後失效 | session cookie 清除 |
| AUTH-026 | 登出後再登入不同帳號 | 新 session 正確 |
| AUTH-027 | 登出按鈕 UI | sidebar 底部登出圖標可點 |
| AUTH-028 | topbar 登出按鈕 | 右上角登出可點 |

#### 1.3 密碼管理（15 案例）
| ID | 案例 | 預期 |
|----|------|------|
| AUTH-029 | 變更密碼 — 正確舊密碼 | 成功 |
| AUTH-030 | 變更密碼 — 錯誤舊密碼 | 拒絕 |
| AUTH-031 | 新密碼太短（< 12） | 驗證失敗 |
| AUTH-032 | 新密碼無大寫 | 驗證失敗 |
| AUTH-033 | 新密碼無小寫 | 驗證失敗 |
| AUTH-034 | 新密碼無數字 | 驗證失敗 |
| AUTH-035 | 新密碼無特殊字元 | 驗證失敗 |
| AUTH-036 | 新密碼與舊密碼相同 | 拒絕（密碼歷史）|
| AUTH-037 | 新密碼與前 5 組重複 | 拒絕 |
| AUTH-038 | 常見密碼（Password123!） | 拒絕（黑名單）|
| AUTH-039 | 密碼過期強制變更 | 登入後跳轉變更頁 |
| AUTH-040 | 確認密碼不一致 | 驗證失敗 |
| AUTH-041 | 變更成功後舊 session 失效 | 需重新登入 |
| AUTH-042 | 密碼重設 — 有效 token | 允許設新密碼 |
| AUTH-043 | 密碼重設 — 過期 token | 拒絕 |

#### 1.4 RBAC 權限（15 案例）
| ID | 案例 | 預期 |
|----|------|------|
| AUTH-044 | ENGINEER 看不到 /admin | sidebar 不顯示 |
| AUTH-045 | ENGINEER 直接訪問 /admin | 無權限或重導 |
| AUTH-046 | ENGINEER 不能建項目 | API 403 |
| AUTH-047 | ENGINEER 不能刪任務 | API 403 |
| AUTH-048 | ENGINEER 不能看稽核日誌 | API 403 |
| AUTH-049 | MANAGER 可建項目 | 成功 |
| AUTH-050 | MANAGER 可刪任務 | 成功 |
| AUTH-051 | MANAGER 可 Gate Review | 成功 |
| AUTH-052 | MANAGER 可匯出 Excel | 成功 |
| AUTH-053 | ENGINEER 可填工時 | 成功 |
| AUTH-054 | ENGINEER 可建任務 | 成功 |
| AUTH-055 | ENGINEER 可加評論 | 成功 |
| AUTH-056 | ENGINEER 看不到 internalNote | API 不回傳 |
| AUTH-057 | ENGINEER 不能改其他人密碼 | API 403 |
| AUTH-058 | 角色顯示正確 | topbar 顯示「主管」或「工程師」|

#### 1.5 Session 管理（12 案例）
| ID | 案例 | 預期 |
|----|------|------|
| AUTH-059 | Session timeout 警告 | 25 分鐘後顯示 modal |
| AUTH-060 | 延長 session | 點「延長」→ 重設計時 |
| AUTH-061 | 超時後自動登出 | 跳轉 /login?reason=session_timeout |
| AUTH-062 | 跨 tab 同步（延長） | Tab A 延長 → Tab B 也重設 |
| AUTH-063 | 跨 tab 同步（超時） | Tab A 超時 → Tab B 也登出 |
| AUTH-064 | 同時 2 個 web session | 允許（MAX=2）|
| AUTH-065 | 第 3 個 web session | 踢掉最舊 session |
| AUTH-066 | Mobile + Web 同時 | 允許（分開計算）|
| AUTH-067 | Cookie HttpOnly | JS 不可讀取 |
| AUTH-068 | Cookie Secure | 只走 HTTPS |
| AUTH-069 | CSRF token 驗證 | POST 無 CSRF → 403 |
| AUTH-070 | 速率限制 — 100 req/min | 第 101 次 → 429 |

#### 1.6 Mobile 認證（15 案例）
| ID | 案例 | 預期 |
|----|------|------|
| AUTH-071 | Mobile login 正確 | 回 token + refreshToken |
| AUTH-072 | Mobile login 錯誤密碼 | 401 |
| AUTH-073 | Mobile login 缺 deviceId | 400 |
| AUTH-074 | Mobile login 帳號鎖定 | 423 |
| AUTH-075 | Mobile refresh token | 新 token |
| AUTH-076 | Mobile refresh — 已撤銷 | 401 + 撤銷全部 |
| AUTH-077 | Mobile logout | 200 + token 失效 |
| AUTH-078 | Mobile logout 缺 Bearer | 401 |
| AUTH-079 | Mobile logout 無效 token | 401 |
| AUTH-080 | Mobile 版本檢查 — 過舊 | 426 Upgrade Required |
| AUTH-081 | Mobile 版本檢查 — 足夠 | 正常通過 |
| AUTH-082 | Mobile deviceId 超長 | 400 (>128) |
| AUTH-083 | Refresh token 裝置綁定 | 不同 deviceId 拒絕 |
| AUTH-084 | Concurrent mobile sessions | MAX=2 |
| AUTH-085 | Mobile login 速率限制 | 超過 → 429 |

#### 1.7 安全邊界（30 案例）
| ID | 案例 | 預期 |
|----|------|------|
| AUTH-086 | SQL injection GET | 安全 200 |
| AUTH-087 | SQL injection POST body | 安全處理 |
| AUTH-088 | XSS stored (task title) | sanitize 或 escape |
| AUTH-089 | XSS reflected (search) | escape |
| AUTH-090 | Path traversal (attachment) | 阻擋 |
| AUTH-091 | IDOR — 跨項目 risk | 403/404 |
| AUTH-092 | IDOR — 他人工時 | 403 |
| AUTH-093 | IDOR — 他人 profile | 403 |
| AUTH-094 | 超大 request body (10MB) | 413 或 400 |
| AUTH-095 | Invalid JSON body | 400 |
| AUTH-096 | 無 Content-Type header | 415 或 400 |
| AUTH-097 | 惡意 filename 上傳 | sanitize |
| AUTH-098 | Content-Disposition injection | sanitize |
| AUTH-099 | CORS 跨域請求 | 正確阻擋 |
| AUTH-100 | CSP header 存在 | 含 nonce |
| AUTH-101 | HSTS header | max-age=31536000 |
| AUTH-102 | X-Frame-Options | SAMEORIGIN |
| AUTH-103 | X-Content-Type-Options | nosniff |
| AUTH-104 | Referrer-Policy | strict-origin |
| AUTH-105 | API 回應不含 stack trace | 500 只回通用訊息 |
| AUTH-106 | 密碼 hash 不在 API 回應 | user 回應不含 password |
| AUTH-107 | JWT blacklist 有效 | 黑名單 token 被拒 |
| AUTH-108 | Cron endpoint 缺 secret | 401 |
| AUTH-109 | /api/metrics 需認證 | 非公開 |
| AUTH-110 | Audit log 記錄登入 | 團隊動態可見 |
| AUTH-111 | Audit log 記錄失敗登入 | 稽核日誌可見 |
| AUTH-112 | 密碼變更記錄 | audit 可查 |
| AUTH-113 | 管理員操作記錄 | audit 可查 |
| AUTH-114 | 無效路由 → 404 | 不洩漏資訊 |
| AUTH-115 | OPTIONS preflight | 204 |

---

### 模組 3：看板 — 任務管理（145 案例）

#### 3.1 任務 CRUD（30 案例）
| ID | 案例 | 預期 |
|----|------|------|
| TASK-001 | 建立任務 — 全欄位 | 201 + 出現在看板 |
| TASK-002 | 建立任務 — 只填標題 | 201（其他用預設）|
| TASK-003 | 建立任務 — 空標題 | 400 |
| TASK-004 | 建立任務 — 標題 200 字 | 成功（邊界）|
| TASK-005 | 建立任務 — 標題 201 字 | 400（超限）|
| TASK-006 | 建立任務 — XSS 標題 | sanitize |
| TASK-007 | 建立任務 — Markdown 描述 | 正確儲存渲染 |
| TASK-008 | 建立任務 — P0 緊急 | P0 badge 紅色 |
| TASK-009 | 建立任務 — 指派 A 角 | 負責人顯示 |
| TASK-010 | 建立任務 — 指派 A+B 角 | 兩人都顯示 |
| TASK-011 | 建立任務 — 設截止日 | 日期顯示 |
| TASK-012 | 建立任務 — 設預估工時 | 數字顯示 |
| TASK-013 | 建立任務 — 加標籤 | 標籤 badge 顯示 |
| TASK-014 | 建立任務 — 連結月度目標 | 目標關聯 |
| TASK-015 | 建立任務 — 連結項目 | 項目 badge 顯示 |
| TASK-016 | 建立任務 — 突發事件分類 | 分類正確 |
| TASK-017 | 建立任務 — 學習成長分類 | 分類正確 |
| TASK-018 | 讀取任務詳情 | 所有欄位正確 |
| TASK-019 | 編輯任務標題 | 更新成功 |
| TASK-020 | 編輯任務描述 | Markdown 正確 |
| TASK-021 | 編輯優先度 P2→P0 | badge 變紅 |
| TASK-022 | 編輯截止日 | 更新 |
| TASK-023 | 編輯預估工時 | 更新 |
| TASK-024 | 編輯指派人 | 更新 |
| TASK-025 | 刪除任務 | 從看板消失 |
| TASK-026 | 刪除後 API 返回 404 | soft delete |
| TASK-027 | 批量選取任務 | 多選 checkbox |
| TASK-028 | 預估工時 = 0 | 允許 |
| TASK-029 | 預估工時 = 9999 | 允許（邊界）|
| TASK-030 | 截止日 = 過去日期 | 允許（可設逾期）|

#### 3.2 狀態轉換（20 案例）
| ID | 案例 | 預期 |
|----|------|------|
| TASK-031 | TODO → IN_PROGRESS | ✅ |
| TASK-032 | IN_PROGRESS → IN_REVIEW | ✅ |
| TASK-033 | IN_REVIEW → DONE | ✅ |
| TASK-034 | IN_REVIEW → IN_PROGRESS（退回）| ✅ |
| TASK-035 | TODO → DONE（跳級）| ❌ 被擋 |
| TASK-036 | DONE → TODO（反轉）| ❌ 被擋 |
| TASK-037 | DONE → IN_PROGRESS | ❌ 被擋 |
| TASK-038 | BACKLOG → TODO | ✅ |
| TASK-039 | BACKLOG → IN_PROGRESS（跳級）| ❌ 被擋 |
| TASK-040 | 狀態改變 → 卡片移到對應欄 | UI 即時更新 |
| TASK-041 | 拖曳卡片改狀態 | UI + API 同步 |
| TASK-042 | 拖曳到同欄（排序）| 順序改變 |
| TASK-043 | 狀態改變寫入 AuditLog | 稽核可查 |
| TASK-044 | 狀態改變觸發通知 | 通知 bell 更新 |
| TASK-045 | Manager flagging | 標旗出現 |
| TASK-046 | Unflag | 標旗消失 |
| TASK-047 | SLA deadline 設定 | 顯示 |
| TASK-048 | SLA 逾期 | 紅色標記 |
| TASK-049 | 狀態欄位名稱可編輯 | 更改後持久 |
| TASK-050 | 並發狀態更新（樂觀鎖）| 第二個 409 |

#### 3.3 子任務（10 案例）
| ID | 案例 | 預期 |
|----|------|------|
| TASK-051 | 新增子任務 | 顯示在列表 |
| TASK-052 | 勾選子任務完成 | checkbox ✓ |
| TASK-053 | 取消勾選 | checkbox 回空 |
| TASK-054 | 刪除子任務 | 從列表消失 |
| TASK-055 | 子任務排序 | 拖曳排序 |
| TASK-056 | 空子任務標題 | 不允許 |
| TASK-057 | 子任務完成率 | 顯示 X/Y |
| TASK-058 | 全部完成 | 100% |
| TASK-059 | 子任務 XSS | sanitize |
| TASK-060 | 子任務超長文字 | 截斷或換行 |

#### 3.4 評論（10 案例）
| ID | 案例 | 預期 |
|----|------|------|
| TASK-061 | 新增評論 | 顯示在列表 |
| TASK-062 | 評論含 Markdown | 正確渲染 |
| TASK-063 | 評論含 @mention | 提及顯示 |
| TASK-064 | 評論含 XSS | sanitize |
| TASK-065 | 空評論 | 不允許 |
| TASK-066 | 超長評論（10000字）| 允許或截斷 |
| TASK-067 | 刪除評論 | 從列表消失 |
| TASK-068 | 評論時間戳 | 正確顯示 |
| TASK-069 | 評論作者頭像 | 正確顯示 |
| TASK-070 | 連續快速評論 | 不重複 |

#### 3.5 附件（10 案例）
| ID | 案例 | 預期 |
|----|------|------|
| TASK-071 | 上傳圖片（JPG） | 成功 |
| TASK-072 | 上傳 PDF | 成功 |
| TASK-073 | 上傳超過 10MB | 拒絕 |
| TASK-074 | 上傳 .exe | 拒絕（類型限制）|
| TASK-075 | 刪除附件 | 從列表消失 |
| TASK-076 | 下載附件 | 正確檔案 |
| TASK-077 | 附件預覽（圖片）| 顯示縮圖 |
| TASK-078 | 惡意 filename | sanitize |
| TASK-079 | 空檔案 | 拒絕 |
| TASK-080 | 同名檔案覆蓋 | 重新命名或拒絕 |

#### 3.6 變更管理（10 案例）
| ID | 案例 | 預期 |
|----|------|------|
| TASK-081 | 建立變更紀錄 | CHG 號碼自動產生 |
| TASK-082 | 選一般變更（需 CAB） | 正確 |
| TASK-083 | 選緊急變更（事後補單）| 正確 |
| TASK-084 | 風險等級選高 | 顯示 |
| TASK-085 | 受影響系統多筆 | tag 顯示 |
| TASK-086 | 填回滾方案 | 儲存 |
| TASK-087 | 填驗證計畫 | 儲存 |
| TASK-088 | 預定開始/結束時間 | datetime picker |
| TASK-089 | CAB 核准 | 欄位更新 |
| TASK-090 | 變更狀態流 | DRAFT→PENDING→APPROVED→... |

#### 3.7 篩選與搜尋（15 案例）
| ID | 案例 | 預期 |
|----|------|------|
| TASK-091 | 篩選負責人 — 王大明 | 只顯示王大明任務 |
| TASK-092 | 篩選優先度 — P0 | 只顯示 P0 |
| TASK-093 | 篩選分類 — INCIDENT | 只顯示事件 |
| TASK-094 | 篩選項目 — 指定項目 | 只顯示該項目任務 |
| TASK-095 | 篩選標籤 | 包含該標籤 |
| TASK-096 | 日期範圍篩選 | 截止日在範圍內 |
| TASK-097 | 多重篩選組合 | AND 邏輯 |
| TASK-098 | 清除所有篩選 | 恢復全部 |
| TASK-099 | 搜尋關鍵字 | 標題包含 |
| TASK-100 | 搜尋中文 | 正確 |
| TASK-101 | 搜尋特殊字元 | 安全 |
| TASK-102 | 搜尋無結果 | 空狀態提示 |
| TASK-103 | 近 7 天快捷 | 篩選正確 |
| TASK-104 | 近 30 天快捷 | 篩選正確 |
| TASK-105 | 近 3 個月快捷 | 篩選正確 |

#### 3.8 交付項（10 案例）
| ID | 案例 | 預期 |
|----|------|------|
| TASK-106 | 新增交付項 | 顯示 |
| TASK-107 | 交付項類型 — 文件 | badge |
| TASK-108 | 交付項類型 — 系統 | badge |
| TASK-109 | 交付項狀態更新 | DELIVERED |
| TASK-110 | 交付項驗收 | ACCEPTED |
| TASK-111~115 | （其他交付項操作）| ... |

#### 3.9 看板 UI 互動（30 案例）
| ID | 案例 | 預期 |
|----|------|------|
| TASK-116 | 拖曳卡片到其他欄 | 狀態改變 + API |
| TASK-117 | 拖曳卡片在同欄排序 | 順序改變 |
| TASK-118 | 點任務卡片開 modal | modal 正確打開 |
| TASK-119 | modal 切換「詳情」tab | 表單顯示 |
| TASK-120 | modal 切換「變更歷史」| 歷史列表 |
| TASK-121 | modal 切換「評論」 | 評論列表 |
| TASK-122 | modal 關閉（X 按鈕）| 關閉 |
| TASK-123 | modal 關閉（ESC 鍵）| 關閉 |
| TASK-124 | modal 關閉（點背景）| 關閉 |
| TASK-125 | 多選模式切換 | checkbox 出現 |
| TASK-126~145 | （鍵盤導航、scroll、responsive等）| ... |

---

### 模組 13：PMO 項目管理（190 案例）

#### 13.1 項目 CRUD（40 案例）
| ID | 案例 | 預期 |
|----|------|------|
| PMO-001 | 4 步建立 — 全欄位 | 列表出現 + 5 Gates 自動建立 |
| PMO-002 | Step 1 — 不填名稱 → 下一步 | 驗證阻擋 |
| PMO-003 | Step 1 — 不填需求部門 → 下一步 | 驗證阻擋 |
| PMO-004 | Step 1 — 名稱 200 字（邊界）| 成功 |
| PMO-005 | Step 1 — 類別下拉選項來自 API | 9 個可選 |
| PMO-006 | Step 2 — 拉效益 slider 到 25 | 顯示 25/25 |
| PMO-007 | Step 2 — 4 slider 都拉到 25 | 總分 100/100 |
| PMO-008 | Step 2 — 可行性選「不可行」 | badge 紅色 |
| PMO-009 | Step 3 — 填 10 個人天 | 合計自動加總 |
| PMO-010 | Step 3 — 人天填負數 | 不允許（min=0）|
| PMO-011 | Step 3 — 人天填小數 0.5 | 允許 |
| PMO-012 | Step 3 — 預算自動計算 | 人天×單價 |
| PMO-013 | Step 4 — 選 PM | 必填 |
| PMO-014 | Step 4 — 不選 PM → 建立 | 驗證阻擋 |
| PMO-015 | Step 4 — 填廠商 | 儲存 |
| PMO-016 | Step 4 — 填計劃日期 | 儲存 |
| PMO-017 | 建立後列表更新 | 項目出現在第一行 |
| PMO-018 | 建立後 code 自動編號 | PRJ-2026-NNN |
| PMO-019 | 點項目行 → detail panel 打開 | 9 tab 顯示 |
| PMO-020 | Detail panel 關閉（X）| 關閉 |
| PMO-021~040 | （編輯、刪除、篩選、排序、分頁等）| ... |

#### 13.2 效益評估（10 案例）
| ID | 案例 | 預期 |
|----|------|------|
| PMO-041 | 拉 slider 營收到 20 | 顯示 20/25 |
| PMO-042 | 拉 slider 法規到 25（滿分）| 顯示 25/25 |
| PMO-043 | 拉 slider 到 0 | 顯示 0/25 |
| PMO-044 | 4 slider 總分自動計算 | 正確加總 |
| PMO-045 | 修改後儲存 | API 更新成功 |
| PMO-046 | 關閉再打開 | 值持久 |
| PMO-047~050 | （效益說明、評估人、評估日期）| ... |

#### 13.3 Gate Review（25 案例）
| ID | 案例 | 預期 |
|----|------|------|
| PMO-051 | G1 顯示 7 個 checklist | 正確 |
| PMO-052 | G2 顯示 7 個 checklist | 正確 |
| PMO-053 | G3 顯示 7 個 checklist | 正確 |
| PMO-054 | G4 顯示 8 個 checklist | 正確 |
| PMO-055 | G5 顯示 9 個 checklist | 正確 |
| PMO-056 | 勾選 G1 第 1 個 checkbox | ✓ 出現 |
| PMO-057 | 取消勾選 | ✓ 消失 |
| PMO-058 | 勾完 G1 全部 7 個 | checklistPassed = true |
| PMO-059 | 點 G1「通過」 | 狀態 PENDING → PASSED |
| PMO-060 | G1 未通過時點 G2「通過」| 被擋（順序強制）|
| PMO-061 | G1 通過後點 G2「通過」| 允許 |
| PMO-062 | 點「阻擋」| 狀態 → BLOCKED |
| PMO-063 | 阻擋需填原因 | blockerNote 必填 |
| PMO-064 | 點「豁免」| 狀態 → WAIVED |
| PMO-065 | 豁免需填理由 | waiverReason 必填 |
| PMO-066 | Gate 審核人顯示 | reviewer 名稱 |
| PMO-067 | Gate 審核時間 | 時間戳 |
| PMO-068 | ENGINEER 不能審核 Gate | 按鈕不顯示或 403 |
| PMO-069 | 批次儲存 checklist | 點「儲存」一次送出 |
| PMO-070 | 未儲存離開提示 | 「未儲存的變更」|
| PMO-071~075 | （Gate 附件上傳、審核意見等）| ... |

#### 13.4 風險管理（20 案例）
| ID | 案例 | 預期 |
|----|------|------|
| PMO-076 | 新增風險 — 全欄位 | 列表出現 |
| PMO-077 | 風險 riskScore 自動計算 | probability × impact |
| PMO-078 | 風險 LOW×LOW = 1（綠）| 顏色正確 |
| PMO-079 | 風險 HIGH×CRITICAL = 12（紅）| 顏色正確 |
| PMO-080 | 風險狀態 OPEN → MITIGATING | 更新 |
| PMO-081 | 風險狀態 → CLOSED | 更新 |
| PMO-082 | 風險負責人指派 | 顯示 |
| PMO-083 | 風險空標題 | 400 |
| PMO-084 | 修改風險 | 更新成功 |
| PMO-085 | 刪除風險 | 從列表消失 |
| PMO-086 | 已封存項目不能加風險 | 400 |
| PMO-087 | 跨項目 IDOR | 拒絕 |
| PMO-088 | 風險熱力圖顯示 | 4×4 grid |
| PMO-089 | 點熱力圖 cell | 展開風險列表 |
| PMO-090 | 風險匯出 | Excel 含風險 sheet |
| PMO-091~095 | （風險緩解措施、應變計畫等）| ... |

#### 13.5 議題管理（15 案例）
| PMO-096~110 | 議題 CRUD + 狀態 + IDOR + 解決方案 | ... |

#### 13.6 利害關係人（15 案例）
| PMO-111~125 | 利害關係人 CRUD + 矩陣圖 + 影響力/關注度 | ... |

#### 13.7 後評價（10 案例）
| PMO-126~135 | 4 維度打分 + 經驗教訓 + 只有 COMPLETED 可提交 + 不可重複 | ... |

#### 13.8 Excel 匯出（15 案例）
| PMO-136 | 全量報表下載 | .xlsx 可開 |
| PMO-137 | 全量報表 — title row 正確 | 銀行標題 |
| PMO-138 | 全量報表 — 條件格式 | 逾期紅、P0 紅字 |
| PMO-139 | 全量報表 — SUM 加總列 | 正確 |
| PMO-140 | 需求摘要下載 | 不含機敏欄位 |
| PMO-141 | 季報下載 | 3 sheets |
| PMO-142 | 單項目報告書 | 5 sheets |
| PMO-143 | 空數據匯出 | 不崩潰 |
| PMO-144~150 | （大數據匯出、凍結欄、欄寬等）| ... |

#### 13.9 項目狀態流（20 案例）
| PMO-151 | PROPOSED → EVALUATING | ✅ |
| PMO-152 | EVALUATING → APPROVED | ✅ |
| PMO-153 | APPROVED → SCHEDULED | ✅ |
| PMO-154 | SCHEDULED → REQUIREMENTS | ✅ |
| PMO-155 | REQUIREMENTS → DESIGN | ✅（需 G1 通過）|
| PMO-156 | DESIGN → DEVELOPMENT | ✅（需 G2 通過）|
| PMO-157 | PROPOSED → COMPLETED（跳級）| ❌ 被擋 |
| PMO-158 | COMPLETED → PROPOSED（反轉）| ❌ 被擋 |
| PMO-159 | ON_HOLD 暫停 | 任何狀態可暫停 |
| PMO-160 | ON_HOLD → 恢復 | 回到暫停前狀態 |
| PMO-161~170 | （其他狀態轉換組合）| ... |

#### 13.10 PMO 儀表板 + 視覺化（20 案例）
| PMO-171 | 項目總數正確 | 與列表一致 |
| PMO-172 | 進行中數量正確 | 計算正確 |
| PMO-173 | 平均進度計算 | 正確 |
| PMO-174 | 風險總覽 toggle | 熱力圖展開/收合 |
| PMO-175 | 利害關係人矩陣顯示 | 4 象限正確 |
| PMO-176 | 甘特圖項目視圖 | bar 位置對日期 |
| PMO-177 | 甘特圖拖曳 bar 改日期 | API 更新 |
| PMO-178 | 甘特圖拖左邊改開始日 | plannedStart 更新 |
| PMO-179 | 甘特圖拖右邊改結束日 | plannedEnd 更新 |
| PMO-180 | 甘特圖拖曳中間移動 | 兩個日期同步移 |
| PMO-181~190 | （項目報表 tab、預算執行率等）| ... |

---

### 模組 15：跨模組 E2E 旅程（52 案例）

#### 旅程 A：主管每日工作流（12 步）
| ID | 操作 | 驗證 |
|----|------|------|
| E2E-001 | 登入 admin → Dashboard | 今日總覽 |
| E2E-002 | 看「逾期任務」→ 點一個 | 跳轉看板 + 開 detail |
| E2E-003 | 改任務狀態 IN_PROGRESS | 狀態更新 |
| E2E-004 | 加評論「已處理」 | 評論顯示 |
| E2E-005 | 到工時 → 填 2h | 格子數字 |
| E2E-006 | 到報表 → 工時摘要 | 新工時反映 |
| E2E-007 | 到項目管理 → 更新進展 | progressNote 儲存 |
| E2E-008 | 到駕駛艙 → 確認整體健康 | 數據正確 |
| E2E-009 | Cmd+K 搜尋任務 | 找到 |
| E2E-010 | 切 Dark mode | 全頁面一致 |
| E2E-011 | 查通知 bell | 通知列表 |
| E2E-012 | 登出 | 完成 |

#### 旅程 B：工程師每日工作流（10 步）
| E2E-013~022 | 登入工程師 → 看我的一天 → 看板認領任務 → 填工時 → 登出 |

#### 旅程 C：項目建立到結案完整流程（15 步）
| E2E-023~037 | 建項目 → 評估 → 排期 → Gate G1-G5 → 後評價 → 結案 |

#### 旅程 D：知識庫協作流程（8 步）
| E2E-038~045 | 建空間 → 建文件 → Markdown 編輯 → 版本歷史 → 搜尋 |

#### 旅程 E：KPI 追蹤流程（7 步）
| E2E-046~052 | 建 KPI → 設目標 → 記錄達成 → 報表驗證 → 駕駛艙反映 |

---

## 三、執行策略

### 自動化（Sonnet agent + Chrome DevTools）
- 所有 CRUD + 狀態轉換 + 篩選 = ~600 案例
- 分 10 批次，每批 60 案例
- 每批 ~20 分鐘

### 需人工驗證
- 拖曳操作（drag-and-drop）= ~30 案例
- 檔案上傳下載 = ~20 案例
- Excel 下載後打開驗證 = ~15 案例
- 跨 tab session 同步 = ~5 案例
- responsive / dark mode = ~10 案例

### 優先序
1. **P0 — 安全相關**（AUTH 模組）= 115 案例
2. **P0 — 核心業務**（Task + PMO）= 335 案例
3. **P1 — 數據正確**（Timesheet + KPI + Reports）= 270 案例
4. **P2 — 其他功能**（剩餘）= 527 案例

---

## 四、通過標準

| 指標 | 標準 |
|------|------|
| P0 案例通過率 | **100%** |
| P1 案例通過率 | **≥ 98%** |
| P2 案例通過率 | **≥ 95%** |
| 總通過率 | **≥ 97%** |
| CRITICAL bug | **0** |
| HIGH bug | **≤ 3**（需有 workaround）|
| 安全漏洞 | **0 CRITICAL / 0 HIGH** |
