# Tech Evaluation: pnpm vs npm

> Issue: #402
> Date: 2026-03-25
> Status: Evaluation
> **Decision: REJECTED** — npm 已足夠，遷移 pnpm 的投入/產出比不適合 5 人團隊封閉環境。

## 1. 現況

TITAN 使用 npm 作為套件管理工具：
- `package-lock.json`: 14,109 行 / 509 KB
- `Dockerfile`: `npm ci` 安裝依賴
- CI/CD: 假設使用 `npm ci`
- 依賴數: 33 (dependencies) + 18 (devDependencies)

## 2. 比較

| 面向 | npm (現況) | pnpm |
|------|-----------|------|
| 安裝速度（冷啟動） | 基準 | 快 2-3 倍（content-addressable store + hard links） |
| 安裝速度（有快取） | 基準 | 快 3-5 倍 |
| 磁碟用量 | 每個專案完整複製所有依賴 | 全域 store + hard link，多專案共用 |
| Lock file | `package-lock.json` | `pnpm-lock.yaml` |
| Strict mode | 否（幽靈依賴可存取） | 是（只能存取直接宣告的依賴） |
| Monorepo 支援 | workspaces（基本） | workspaces（成熟，`pnpm -r`, `--filter`） |
| Node.js 相容性 | 原生 | 需額外安裝（`corepack enable` 或獨立安裝） |
| Docker 整合 | 原生 | 需在 Dockerfile 安裝 pnpm |
| Next.js 官方支援 | 預設 | 官方文件有 pnpm 範例 |
| Corepack 整合 | 不需要 | 推薦透過 Corepack 管理版本 |

## 3. 基準估算

以 TITAN 51 個依賴的規模：

| 指標 | npm ci | pnpm install --frozen-lockfile |
|------|--------|-------------------------------|
| 冷啟動安裝（CI） | ~25-35s | ~10-15s |
| 有快取安裝（CI） | ~15-20s | ~3-5s |
| node_modules 大小 | ~250-350 MB | ~200-280 MB（symbolic links to store） |
| Lock file 大小 | 509 KB | ~400 KB |
| Docker layer cache hit | `npm ci` 整層重做 | `pnpm install` 差異安裝更快 |

> 注意：上述為經驗估算值。建議在實際環境執行 benchmark 確認。

## 4. TITAN 特殊考量

### 4.1 Docker 部署（主要考量）
TITAN 使用 multi-stage Docker build。pnpm 需修改 Dockerfile：

```dockerfile
# pnpm Dockerfile 改動範例
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
```

### 4.2 銀行內網環境
- npm registry mirror 通常已設定 → pnpm 可使用相同 mirror（`.npmrc` 相容）
- pnpm 的 content-addressable store 在 CI runner 間共用時效益更大
- 離線安裝：pnpm 支援 `pnpm store prune` + 離線 store

### 4.3 Strict 依賴解析
pnpm 預設不允許存取未直接宣告的依賴（幽靈依賴）。這可能暴露 TITAN 中隱含依賴問題：
- 例如：如果某個 `.ts` 檔案 import 了一個沒有在 `package.json` 中宣告的套件（由其他套件間接安裝），pnpm 會報錯
- 這是一件好事——修復後依賴關係更明確

### 4.4 Prisma 相容性
Prisma 與 pnpm 完全相容。`prisma generate` 在 pnpm 環境下正常運作。

## 5. 建議

**推薦：遷移至 pnpm**

理由：
1. **安裝速度提升明顯** — CI/CD 每次 build 節省 15-25 秒（累積可觀）
2. **Strict 模式** — 消除幽靈依賴，依賴關係更明確、更安全
3. **磁碟用量更低** — 開發機器和 CI runner 上的空間節省
4. **Next.js 官方支援** — 無相容性風險
5. **業界趨勢** — Next.js、Turbo、大部分現代 monorepo 已採用 pnpm

風險低：
- TITAN 不是 monorepo，遷移路徑簡單
- 回滾容易：保留 `package-lock.json` 一段時間，隨時可切回 npm

## 6. 遷移步驟

### Step 1 — 環境準備
```bash
# 啟用 Corepack（Node.js 內建）
corepack enable
corepack prepare pnpm@latest --activate

# 確認版本
pnpm --version
```

### Step 2 — 匯入現有 lockfile
```bash
# pnpm 可從 package-lock.json 匯入
pnpm import

# 這會產生 pnpm-lock.yaml
```

### Step 3 — 驗證安裝
```bash
# 移除 node_modules 重新安裝
rm -rf node_modules
pnpm install

# 執行 build 驗證
pnpm run build

# 執行測試
pnpm test
```

### Step 4 — 修復幽靈依賴（如有）
pnpm strict mode 可能會暴露隱含依賴。逐一加入 `package.json`：
```bash
pnpm add <missing-package>
```

### Step 5 — 更新 Dockerfile
```dockerfile
FROM node:20-alpine AS deps
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile --prod=false
```

### Step 6 — 更新 CI/CD
- 將 `npm ci` 改為 `pnpm install --frozen-lockfile`
- 將 `npm run xxx` 改為 `pnpm xxx`
- 加入 pnpm store 快取路徑

### Step 7 — 清理
```bash
# 確認 pnpm 運作正常後
rm package-lock.json
# 在 .gitignore 中可選擇忽略 package-lock.json
```

### Step 8 — 設定 packageManager 欄位
在 `package.json` 中加入：
```json
{
  "packageManager": "pnpm@10.x.x"
}
```
Corepack 會自動根據此欄位使用正確版本。

## 7. 風險與回滾

| 風險 | 緩解 |
|------|------|
| 幽靈依賴導致 build 失敗 | 逐一修復，這是改善而非問題 |
| Docker build 失敗 | 測試環境先驗證，rollback 改回 npm ci |
| 團隊不熟悉 pnpm | pnpm CLI 與 npm 幾乎相同（`pnpm install`, `pnpm add`, `pnpm run`） |
| CI runner 沒有 pnpm | Corepack 內建於 Node.js 20+，`corepack enable` 即可 |

**回滾方案**: 保留 `package-lock.json` 直到確認 pnpm 穩定。如需回滾：
```bash
rm pnpm-lock.yaml
npm install
```
