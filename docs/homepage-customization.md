# Homepage 外觀自訂指南

> 任務：T14 — Homepage 視覺與導覽設定
> 適用版本：Homepage v0.9.x+
> 最後更新：2026-03-23

---

## 目錄

1. [架構概覽](#1-架構概覽)
2. [套用深色主題 CSS](#2-套用深色主題-css)
3. [調整站台名稱與 Logo](#3-調整站台名稱與-logo)
4. [新增或修改服務卡片](#4-新增或修改服務卡片)
5. [導覽分組設定](#5-導覽分組設定)
6. [書籤設定](#6-書籤設定)
7. [小工具（Widgets）設定](#7-小工具widgets設定)
8. [常見問題排除](#8-常見問題排除)

---

## 1. 架構概覽

Homepage 的設定完全由 `config/homepage/` 下的 YAML 檔控制，無需重建映像。

```
config/homepage/
├── settings.yaml       # 全域設定（站台名稱、主題、CSS 路徑）
├── services.yaml       # 服務卡片定義
├── bookmarks.yaml      # 快速書籤
├── widgets.yaml        # 頂部資訊小工具
├── docker.yaml         # Docker 狀態整合設定
└── custom.css          # 自訂樣式（T14 新增）
```

設定修改後，Homepage 會在數秒內自動熱載入，**無需重啟容器**。

---

## 2. 套用深色主題 CSS

### 2.1 掛載 CSS 檔

確認 `docker-compose.yml` 中 Homepage 容器的 volume 掛載已包含：

```yaml
services:
  homepage:
    volumes:
      - ./config/homepage:/app/config
```

若 `config/homepage/` 已整體掛載，則 `custom.css` 已自動可用。

### 2.2 在 settings.yaml 中啟用

編輯 `config/homepage/settings.yaml`：

```yaml
title: TITAN Portal
description: 銀行 IT 服務入口
theme: dark          # 啟用 Homepage 內建深色底色
color: slate         # 基底色板（dark 主題下效果最佳）
customCSS: /app/config/custom.css   # 指向自訂樣式
```

### 2.3 主題色彩變數說明

`custom.css` 使用 CSS 自訂屬性（Custom Properties），方便統一調整：

| 變數名稱                | 預設值      | 用途               |
|-------------------------|-------------|---------------------|
| `--titan-bg-primary`    | `#0f1117`   | 主背景              |
| `--titan-bg-secondary`  | `#1a1d27`   | 卡片背景            |
| `--titan-accent`        | `#4a6cf7`   | 主要強調色（連結、標題）|
| `--titan-success`       | `#22c55e`   | 服務正常狀態色       |
| `--titan-warning`       | `#f59e0b`   | 服務降級狀態色       |
| `--titan-danger`        | `#ef4444`   | 服務異常狀態色       |

修改方式：直接編輯 `custom.css` 中 `:root { }` 區塊內的對應數值。

---

## 3. 調整站台名稱與 Logo

### settings.yaml 完整範例

```yaml
title: TITAN Portal
description: 銀行資訊部 — 內部服務入口
theme: dark
color: slate
favicon: /app/config/favicon.png    # 放入 config/homepage/favicon.png
background:
  image: /app/config/background.jpg  # 可選：背景圖片
  blur: sm
  opacity: 10                         # 背景圖透明度 (%)
customCSS: /app/config/custom.css
layout:
  - 核心服務:
      style: row
      columns: 4
  - 開發工具:
      style: row
      columns: 3
  - 監控告警:
      style: row
      columns: 3
  - 快速連結:
      style: row
      columns: 6
```

---

## 4. 新增或修改服務卡片

### services.yaml 結構

```yaml
- 核心服務:
    - Plane 任務管理:
        icon: plane.png                        # 圖示（mdi:xxxx 或自訂 PNG）
        href: http://plane.titan.internal
        description: 專案與任務追蹤
        ping: http://plane.titan.internal      # 健康檢查 URL
        target: _blank
    - Outline 知識庫:
        icon: outline.png
        href: http://outline.titan.internal
        description: 團隊知識管理
        ping: http://outline.titan.internal
        target: _blank
    - Gitea 程式碼庫:
        icon: gitea.png
        href: http://gitea.titan.internal
        description: 版本控制與 CI/CD
        ping: http://gitea.titan.internal/api/healthz
        target: _blank

- 監控告警:
    - Grafana:
        icon: grafana.png
        href: http://grafana.titan.internal
        description: 系統指標儀表板
        ping: http://grafana.titan.internal/api/health
        widget:
          type: grafana
          url: http://grafana.titan.internal
          username: viewer
          password: "{{GRAFANA_VIEWER_PASSWORD}}"
```

### 欄位說明

| 欄位          | 必填 | 說明                                      |
|---------------|------|-------------------------------------------|
| `icon`        | 否   | 圖示名稱（支援 Material Design Icons）    |
| `href`        | 是   | 點擊後跳轉的 URL                          |
| `description` | 否   | 顯示在服務名稱下方的說明文字              |
| `ping`        | 否   | 健康檢查 URL（回傳 2xx 則顯示綠燈）       |
| `target`      | 否   | `_blank`（新分頁）或 `_self`（同頁跳轉）  |
| `widget`      | 否   | 服務狀態小工具（Grafana、Prometheus 等）  |

---

## 5. 導覽分組設定

Homepage 支援以分組（Group）方式呈現服務，分組名稱需與 `settings.yaml` 中的 `layout` 對應。

### 分組排序

在 `settings.yaml` 的 `layout` 中定義分組順序：

```yaml
layout:
  - 核心服務:
      style: row
      columns: 4
  - 開發工具:
      style: row
      columns: 3
  - 監控告警:
      style: row
      columns: 3
```

`columns` 表示該分組一行顯示幾個卡片。

### TITAN 建議分組結構

| 分組名稱   | 服務                                  | columns |
|------------|---------------------------------------|---------|
| 核心服務   | Plane、Outline、Gitea、Harbor         | 4       |
| 開發工具   | Jenkins、SonarQube、Nexus             | 3       |
| 監控告警   | Grafana、Prometheus、Alertmanager     | 3       |
| 系統管理   | Portainer、Keycloak、MinIO Console    | 3       |
| 快速連結   | 書籤區塊（另見 bookmarks.yaml）       | 6       |

---

## 6. 書籤設定

`bookmarks.yaml` 提供快速連結區塊，無狀態指示燈，適合放置文件、常用工具連結。

```yaml
- 常用文件:
    - TITAN Wiki:
        - abbr: TW
          href: http://outline.titan.internal/collection/titan
    - 標準作業程序:
        - abbr: SOP
          href: http://outline.titan.internal/collection/sop

- 外部資源:
    - Docker Hub Mirror:
        - abbr: DH
          href: http://harbor.titan.internal
    - 資安公告:
        - abbr: SA
          href: http://intranet.bank.internal/security
```

---

## 7. 小工具（Widgets）設定

`widgets.yaml` 定義顯示在頁面頂部的全域資訊列。

```yaml
- resources:
    cpu: true
    memory: true
    disk: /
    label: 系統資源

- search:
    provider: custom
    url: http://outline.titan.internal/search?q=
    target: _blank
    suggestionUrl: null
    placeholder: 搜尋知識庫...

- datetime:
    text_size: xl
    format:
      timeStyle: short
      dateStyle: short
      hour12: false
```

---

## 8. 常見問題排除

### Q1: CSS 修改後沒有生效

1. 確認 `settings.yaml` 中 `customCSS` 路徑正確（容器內路徑）
2. 強制重新整理瀏覽器快取：`Ctrl+Shift+R`（Windows/Linux）或 `Cmd+Shift+R`（macOS）
3. 檢查容器 log：`docker compose logs homepage`

### Q2: 服務卡片顯示紅燈（異常）但服務實際正常

- 確認 `ping` URL 從 Homepage 容器可達（注意 Docker 網路隔離）
- 使用容器名稱或 DNS 而非 `localhost`
- 部分服務需加上特定路徑（例如 `/api/health`）才會回傳 200

### Q3: 分組排序不符預期

- `services.yaml` 中的分組名稱必須與 `settings.yaml` `layout` 中的名稱**完全一致**（含空格、大小寫）

### Q4: 中文顯示異常

- 確認系統已安裝 Noto Sans TC 字型，或調整 `custom.css` 中 `font-family` 為可用的中文字型
- 容器環境可考慮掛載字型目錄或使用 Google Fonts 的本地鏡像

---

## 參考資源

- [Homepage 官方文件](https://gethomepage.dev/latest/)
- [Homepage Docker 整合](https://gethomepage.dev/latest/widgets/services/docker/)
- [Material Design Icons](https://materialdesignicons.com/)
- T13 Outline 範本：`templates/outline/`
- TITAN 服務清單：`config/homepage/services.yaml`
