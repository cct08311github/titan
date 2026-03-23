# OS 基線與安全強化設定

> **任務編號**: T06  
> **負責人**: DevOps  
> **估計工時**: 20h  
> **依賴**: T05  
> **適用對象**: TITAN 容器平台

---

## 1. 概述

本文檔定義 TITAN 容器平台的 OS 基線與安全強化（Hardening）設定，符合銀行業資安要求。涵蓋 Linux 基線配置、時區/NTP、最小化套件、容器資源限制及網路隔離。

---

## 2. Linux 基線配置

### 2.1 系統版本需求

| 項目 | 建議版本 | 備註 |
|------|----------|------|
| 作業系統 | Ubuntu 22.04 LTS / Debian 12 | 長期支援版本 |
| 核心版本 | 5.15+ | 支援 cgroup v2 |
| Docker | 24.0+ | 支援 compose v2 |
| 硬碟空間 | ≥ 500GB | 視資料量調整 |

### 2.2 時區與 NTP 設定

```bash
# 設定時區為 Asia/Taipei
timedatectl set-timezone Asia/Taipei

# 安裝與設定 chrony（NTP 客戶端）
apt install -y chrony

# /etc/chrony/chrony.conf
# 銀行業建議使用內部 NTP 伺服器
server ntp.twbts.gov iburst
server time.google.com iburst
server time.cloudflare.com iburst

# 啟動服務
systemctl enable chrony
systemctl start chrony
```

### 2.3 最小化套件原則

```bash
# 只安裝必要套件
apt install -y \
    curl \
    wget \
    git \
    vim \
    htop \
    net-tools \
    ca-certificates \
    gnupg \
    lsb-release

# 移除不必要的服務
systemctl disable apt-daily.timer
systemctl disable apt-daily-upgrade.timer
systemctl disable snapd
```

---

## 3. Docker 容器安全強化

### 3.1 非 Root 使用者執行

所有容器必須以非 root 使用者執行，防止權限提升攻擊。

```yaml
# docker-compose.yml 範例
services:
  postgres:
    user: postgres
  
  redis:
    user: redis
  
  outline:
    user: outline
```

### 3.2 容器資源限制（Resource Limits）

符合銀行業資安要求，防止單一容器耗盡系統資源。

| 服務 | CPU 限制 | Memory 限制 | 備註 |
|------|----------|-------------|------|
| postgres | 2 cores | 2GB | 資料庫，建議使用 SSD |
| redis | 1 core | 512MB | 快取，LRU 清除策略 |
| minio | 1.5 cores | 1GB | 物件儲存 |
| outline | 2 cores | 2GB | 文件服務 |
| homepage | 0.5 cores | 256MB | 儀表板 |

```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
    reservations:
      cpus: '0.5'
      memory: 512M
```

### 3.3 網路隔離（Network Isolation）

採用雙層網路架構：
- **titan-internal**: 內部服務間通訊，不對外開放
- **titan-external**: 允許對外服務（Homepage）

```yaml
networks:
  titan-internal:
    name: titan-internal
    driver: bridge
  titan-external:
    name: titan-external
    driver: bridge
```

### 3.4 敏感資訊保護

- 禁止在 docker-compose.yml 中明文存放密碼
- 使用 `.env` 檔案配合 Docker Secrets 或外部密鑰管理系統
- 資料庫連線字串需加密傳輸

### 3.5 映像檔安全

| 最佳實踐 | 說明 |
|----------|------|
| 使用 Alpine 映像 | 最小化攻擊面 |
| 固定版本標籤 | 避免自動更新導致相容性問題 |
| 定期漏洞掃描 | 使用 Trivy 或 Clair |
| 隔離網路部署 | 禁止直接存取公網 Registry |

---

## 4. Docker Daemon 安全設定

### 4.1 /etc/docker/daemon.json

```json
{
  "log-driver": "json-file",
  "log-opts": {
    "max-size": "10m",
    "max-file": "3"
  },
  "storage-driver": "overlay2",
  "icc": false,
  "live-restore": true,
  "userland-proxy": false,
  "default-ulimits": {
    "nofile": {
      "Name": "nofile",
      "Hard": 64000,
      "Soft": 64000
    }
  },
  "registry-mirrors": [],
  "insecure-registries": []
}
```

### 4.2 運行參數建議

```bash
# 生產環境建議的 Docker 執行參數
dockerd \
  --iptables=false \
  --ip-forward=false \
  --userland-proxy=false \
  --icc=false
```

---

## 5. 主機安全檢查清單

### 5.1 系統強化

- [ ] 啟用 UFW/Firewall，只開放必要端口
- [ ] 設定 SSH 金鑰登入，禁用密碼驗證
- [ ] 啟用 AppArmor/SELinux
- [ ] 定期安全更新（自動化）
- [ ] 啟用 Auditd 日誌審計

### 5.2 監控與告警

- [ ] 部署 Prometheus + Grafana 監控
- [ ] 設定資源使用告警閾值
- [ ] 啟用日誌集中收集（ELK/Loki）
- [ ] 設定異常行為偵測

### 5.3 備份與復原

- [ ] 自動化資料庫備份
- [ ] 定期測試復原流程
- [ ] 異地備份（冷備份）

---

## 6. 參考資源

- [Docker Security Documentation](https://docs.docker.com/engine/security/)
- [OWASP Docker Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Docker_Security_Cheat_Sheet.html)
- [CIS Docker Benchmark](https://www.cisecurity.org/benchmark/docker)

---

## 7. 版本歷史

| 版本 | 日期 | 變更說明 |
|------|------|----------|
| 1.0 | 2026-03-23 | 初始版本，符合銀行業資安要求 |
