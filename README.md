# 🏦 銀行 IT 團隊綜合作業系統提案

> **提案單位**：IT 團隊  
> **提案日期**：2026-03-23  
> **版本**：v1.0

---

## 📋 執行摘要

本提案旨在為本行 IT 團隊（5人）打造一套綜合作業系統，將目前散落於 Email、Excel、紙本的 工作資訊進行整合，實現任務追蹤、知識管理、流程自動化的統一作業平台。

**核心方案**：採用「Open Source 核心組件 + 自開發膠水層」的混合架構，確保系統彈性與維護可控性。

| 項目 | 內容 |
|------|------|
| **目標使用者** | IT 團隊 5 位工程師 |
| **部署環境** | 封閉網路（內網） |
| **預估上線時程** | 4 週（MVP） |
| **預估成本** | 硬體除外，全部免費（Open Source） |

---

## 🔍 現況分析

### 目前痛點

| 痛點 | 現況描述 | 影響程度 |
|------|----------|----------|
| **訊息散落** | 任務討論在 Email、檔案在硬碟、各類文件散落 | 🔴 高 |
| **追蹤困難** | 用 Excel 管理任務，版本混亂、多人編輯衝突 | 🔴 高 |
| **搜尋不易** | 找不到歷史文件、不知道誰負責什麼 | 🟠 中 |
| **流程不透明** | CR 變更流程靠口頭/Email，缺乏系統化管理 | 🟠 中 |
| **重工耗時** | 週報/月報要手動從各處彙整 | 🟡 低 |

### 現有工具使用狀況

```
┌─────────────────────────────────────────────────────────┐
│                    現有工作流                              │
├─────────────────────────────────────────────────────────┤
│  Email (討論) ─→ Excel (記錄) ─→ 文件 (儲存) ─→ 找不到...  │
└─────────────────────────────────────────────────────────┘
```

**問題**：資訊流動性高但缺乏結構化管理，導致搜尋困難、交接不易、效率低落。

---

## 🎯 目標與效益

### 量化效益（預估）

| 指標 | 改善前 | 改善後 | 改善幅度 |
|------|--------|--------|----------|
| 任務搜尋時間 | ~30 分鐘 | ~1 分鐘 | **95%↓** |
| 週報彙整時間 | ~2 小時 | ~10 分鐘 | **92%↓** |
| 文件版本衝突 | 常發生 | 消除 | **100%↓** |
| 跨系統資訊取得 | 5+ 处 | 1 個入口 | **80%↓** |

### 質化效益

- ✅ **單一真相來源**：所有任務、文件、溝通集中在同一平台
- ✅ **知識傳承**：新人入職可直接查看歷史文件與任務脈絡
- ✅ **流程標準化**：CR 變更有明確的審批流程與軌跡
- ✅ **未來可擴充**：架構支持後續加入 AI 自動化、監控系統

---

## 🏗️ 系統架構

### 整體架構圖

```
┌────────────────────────────────────────────────────────────────────────┐
│                           統一入口 (Homepage)                            │
│                    http://it-portal.internal                            │
└────────────────────────────────────────────────────────────────────────┘
         │              │              │              │              │
         ▼              ▼              ▼              ▼              ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│   Plane     │  │  Outline    │  │   Gitea    │  │ Mattermost  │  │  自開發層   │
│ (任務管理)   │  │ (知識庫)    │  │ (Git/CR)   │  │ (溝通)      │  │ (膠水自動化)│
└─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘  └─────────────┘
         │              │              │              │
         ▼              ▼              ▼              ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Docker Swarm / Compose                            │
│                     (一鍵部署，統一管理)                                   │
└────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Linux 伺服器 (內網)                                 │
│                  Ubuntu 22.04 LTS + Docker 24+                         │
└────────────────────────────────────────────────────────────────────────┘
```

### 工具選型說明

| 類別 | 工具 | 理由 |
|------|------|------|
| **任務管理** | **Plane** | 類似 Jira，支援看板+清單，自架免費，API 完善 |
| **知識庫** | **Outline** | 類似 Notion，協作友善，搜尋強大 |
| **程式碼/Git** | **Gitea** | 輕量 Git 伺服器，適合內網，CR 可用 PR 流程 |
| **即時溝通** | **Mattermost** | 類似 Slack，完全自架，保護資安 |
| **統一入口** | **Homepage** | Dashboard，一頁看到所有工具 |
| **膠水層** | **自開發** | 整合 AD 登入、自動化流程、週報產生 |

### 技術規格

- **作業系統**：Ubuntu 22.04 LTS
- **容器平台**：Docker 24+ / Docker Compose
- **硬體需求**（估）：4核心 CPU / 8GB RAM / 500GB SSD
- **網段**：僅開放內網 IP，嚴格防火牆管制

---

## 📅 實施計畫

### 分階段時程

```
Week 1     Week 2     Week 3     Week 4     Week 5-8    Week 9+
│          │          │          │          │            │
├──────────┼──────────┼──────────┼──────────┼────────────┼────────────┤
│          │          │          │          │            │
▼          ▼          ▼          ▼          ▼            ▼
MVP 階段                              進階階段         優化階段
┌─────────┐ ┌─────────┐ ┌─────────┐ ┌────────┐ ┌────────┐ ┌─────────┐
│ 部署    │ │ 遷移    │ │ 試用    │ │ 正式   │ │ Git/CR │ │ AI/LLM │
│ Plane   │ │ Excel   │ │ 收集    │ │ 上線   │ │ 整合   │ │ 自動化 │
│ Outline │ │ 任務    │ │ 回饋    │ │ 培訓   │ │ 膠水層 │ │        │
│ Home    │ │ 文件    │ │        │ │        │ │       │ │        │
└─────────┘ └─────────┘ └─────────┘ └────────┘ └────────┘ └─────────┘
```

### 詳細里程碑

| 階段 | 週次 | 里程碑 | 交付物 |
|------|------|--------|--------|
| **Phase 1** | Week 1 | MVP 部署完成 | Docker Compose 配置、Plane/Outline 上線 |
| **Phase 1** | Week 2 | 資料遷移 | Excel 任務匯入、文件遷移、帳號設定 |
| **Phase 1** | Week 3 | 試用調整 | 收集回饋、流程優化、功能調整 |
| **Phase 1** | Week 4 | 正式上線 | 培訓、文件、SOP 發布 |
| **Phase 2** | Week 5-6 | Gitea 部署 | Git 環境、CR 流程設定 |
| **Phase 2** | Week 7-8 | 膠水層開發 | AD 整合、自動化流程、週報產生 |
| **Phase 3** | Week 9+ | AI 助手（可選） | 本地 LLM 部署、文件摘要 |

---

## 🐳 Docker Compose 配置

### 一鍵部署脚本

建立 `docker-compose.yml`：

```yaml
version: '3.8'

services:
  # 統一入口 Dashboard
  homepage:
    image: gethomepage/homepage:latest
    container_name: it-portal
    ports:
      - "3000:3000"
    volumes:
      - ./homepage:/app/config
    restart: unless-stopped

  # 任務管理
  plane:
    image: plane/plane-backend:latest
    container_name: plane
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db:5432/plane
      - REDIS_URL=redis://redis:6379
    depends_on:
      - db
      - redis
    restart: unless-stopped

  # 知識庫
  outline:
    image: outline/outline:latest
    container_name: outline
    ports:
      - "3001:3000"
    environment:
      - DATABASE_URL=postgresql://postgres:password@db2:5432/outline
      - SECRET_KEY=your-secret-key
    depends_on:
      - db2
    restart: unless-stopped

  # Git 伺服器
  gitea:
    image: gitea/gitea:latest
    container_name: gitea
    ports:
      - "3002:3000"
    volumes:
      - ./gitea-data:/data
    environment:
      - USER_UID=1000
      - USER_GID=1000
    restart: unless-stopped

  # 即時溝通
  mattermost:
    image: mattermost/mattermost-team-edition:latest
    container_name: mattermost
    ports:
      - "3003:8065"
    volumes:
      - ./mattermost-data:/var/lib/mattermost
    environment:
      - MM_SERVICESETTINGS_SITEURL=http://内网IP:3003
    restart: unless-stopped

  # PostgreSQL (共用)
  db:
    image: postgres:15-alpine
    container_name: plane-db
    volumes:
      - ./postgres-data:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=password
    restart: unless-stopped

  db2:
    image: postgres:15-alpine
    container_name: outline-db
    volumes:
      - ./postgres-outline:/var/lib/postgresql/data
    environment:
      - POSTGRES_PASSWORD=password
    restart: unless-stopped

  # Redis
  redis:
    image: redis:7-alpine
    container_name: redis
    volumes:
      - ./redis-data:/data
    restart: unless-stopped

networks:
  default:
    name: it-internal-network
```

### 部署指令

```bash
# 1. 建立目錄
mkdir -p /opt/it-portal && cd /opt/it-portal

# 2. 建立 docker-compose.yml (內容如上)

# 3. 一鍵啟動
docker compose up -d

# 4. 檢查狀態
docker compose ps
```

---

## 💰 成本分析

### 預估成本

| 項目 | 預估費用 | 說明 |
|------|----------|------|
| **軟體授權** | **0** | 全部使用 Open Source，無授權費 |
| **雲端/網路費用** | **0** | 內網部署，無外部依賴 |
| **硬體** | 自有或公司提供 | 現有伺服器即可 |
| **開發人力** | AI 輔助開發 | 我們協助架設，團隊可自行維護 |
| **維護成本** | 低 | Docker 自動化管理 |

### 對比商業方案

| 方案 | 授權費（/年） | 總成本（5人） |
|------|--------------|---------------|
| **本提案** | **0** | **硬體 + 維護** |
| Jira (Cloud) | ~$750 | $3,750 |
| Confluence | ~$550 | $2,750 |
| Notion (Team) | $800 | $4,000 |

**預估每年節省：$3,000-4,000+**

---

## 🔐 資安與合規考量

### 銀行業特殊需求對應

| 需求 | 對應措施 |
|------|----------|
| **網段隔離** | 部署在內網 DMZ，所有服務不對外 |
| **存取控制** | 整合 AD/LDAP，權限分群管理 |
| **操作紀錄** | 所有系統提供審計日誌，可追蹤 |
| **資料不出網** | 全部資料存在內網伺服器，無外部傳輸 |
| **備份機制** | 定期備份 Docker Volume，原則異地儲存 |
| **漏洞修補** | 定期更新 Docker Image（內網可作業） |

### 部署安全檢核清單

- [ ] 伺服器放置於內網防火牆後
- [ ] 只開放必要連接埠（80/443/SSH）
- [ ] 啟用 HTTPS（自簽憑證或內部 CA）
- [ ] 設定強密碼原則
- [ ] 啟用各系統審計日誌
- [ ] 定期備份機制
- [ ] 定期弱點掃描（內網工具）

---

## ✅ 效益對照表

### Before vs After

| 場景 | Before（現在） | After（未來） |
|------|---------------|---------------|
| **派發任務** | Email / Line 口頭交代 | Plane 直接建立，指定人 + 期限 |
| **追蹤進度** | 打電話問 Excel 更新 | 看板即時看，狀態一目了然 |
| **找文件** | 翻硬碟/Email 附件 | Outline 搜尋，1秒找到 |
| **寫週報** | 手動彙整 2 小時 | 系統自動拉數據，10 分鐘 |
| **CR 流程** | Email 來回審批 | Gitea PR 流程，軌跡完整 |
| **知識傳承** | 口耳相傳 + 散落文件 | 集中知識庫，新人直接查 |

---

## 🚀 下一步行動

| 項目 | 負責人 | 時程 |
|------|--------|------|
| 提案確認 | 主管 | 本週 |
| 硬體準備 | IT | 1 週 |
| 環境部署 | 我們協助 | 1 週 |
| 試運行 | 團隊 | 2 週 |
| 正式上線 | 全團隊 | 4 週 |

---

## 📎 附錄

### 推薦閱讀

- Plane 官方文檔：https://docs.plane.so
- Outline 官方文檔：https://docs.getoutline.com
- Gitea 官方文檔：https://docs.gitea.io
- Homepage 官方文檔：https://gethomepage.dev

### 聯絡我們

如有任何問題，歡迎在「創意發想區」討論，或直接聯繫我們協助部署。

---

> *本提案由 IT 團隊與 AI 助手共同編製，採用 Open Source 技術，目標在有限的預算與封閉的網路環境下，為團隊打造現代化的協作平台。*