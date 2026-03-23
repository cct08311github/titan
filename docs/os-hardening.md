# OS 基礎強化指南（Linux Baseline Hardening）

> 適用系統：Ubuntu 22.04 LTS / Debian 12+
> 時區設定：Asia/Taipei
> 最後更新：2026-03-23

---

## 目錄

1. [時區與時間同步（NTP）](#1-時區與時間同步ntp)
2. [最小化套件安裝原則](#2-最小化套件安裝原則)
3. [防火牆規則（UFW）](#3-防火牆規則ufw)
4. [SSH 強化設定](#4-ssh-強化設定)
5. [帳號與密碼政策](#5-帳號與密碼政策)
6. [核心參數調整（Docker 相容）](#6-核心參數調整docker-相容)
7. [稽核與日誌設定](#7-稽核與日誌設定)
8. [驗證清單](#8-驗證清單)

---

## 1. 時區與時間同步（NTP）

### 1.1 設定時區為 Asia/Taipei

```bash
timedatectl set-timezone Asia/Taipei
timedatectl status
```

預期輸出包含：`Time zone: Asia/Taipei (CST, +0800)`

### 1.2 安裝並啟用 chrony（NTP 時間同步）

```bash
apt-get install -y chrony
systemctl enable --now chrony
chronyc tracking
```

建議 `/etc/chrony.conf` 設定使用台灣 NTP 池：

```
pool tw.pool.ntp.org iburst maxsources 4
```

套用後重啟：

```bash
systemctl restart chrony
chronyc sources -v
```

---

## 2. 最小化套件安裝原則

### 2.1 移除不必要套件

```bash
apt-get purge -y telnet rsh-client rsh-redone-client nis yp-tools \
  talk talkd xinetd inetutils-telnetd
apt-get autoremove -y
apt-get autoclean
```

### 2.2 停用不必要服務

```bash
systemctl disable --now avahi-daemon cups bluetooth 2>/dev/null || true
```

### 2.3 定期安全更新

設定無人值守安全更新（`unattended-upgrades`）：

```bash
apt-get install -y unattended-upgrades apt-listchanges
dpkg-reconfigure --priority=low unattended-upgrades
```

設定檔 `/etc/apt/apt.conf.d/50unattended-upgrades`，確認以下項目啟用：

```
Unattended-Upgrade::Automatic-Reboot "false";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
```

---

## 3. 防火牆規則（UFW）

### 3.1 安裝並啟用 UFW

```bash
apt-get install -y ufw
ufw --force reset
```

### 3.2 預設政策（白名單原則）

```bash
ufw default deny incoming
ufw default allow outgoing
```

### 3.3 允許必要連接埠

| 服務 | 連接埠 | 通訊協定 | 說明 |
|------|--------|----------|------|
| SSH | 22 | TCP | 遠端管理（建議改為非預設 port） |
| HTTP | 80 | TCP | Web 服務（若有 Nginx） |
| HTTPS | 443 | TCP | Web 服務（TLS） |

```bash
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
```

> 若 SSH 已改為自訂 port（例如 2222），請相應調整，並確認先允許新 port 再停用 22。

### 3.4 Docker 橋接網路放行

Docker 使用 `172.17.0.0/16` 等內部網路。UFW 不干預 Docker iptables 規則，但需確認 `/etc/default/ufw` 中：

```
DEFAULT_FORWARD_POLICY="ACCEPT"
```

### 3.5 啟用防火牆

```bash
ufw --force enable
ufw status verbose
```

---

## 4. SSH 強化設定

編輯 `/etc/ssh/sshd_config`，套用以下設定：

### 4.1 核心安全設定

```sshd_config
# 禁止 root 直接登入
PermitRootLogin no

# 禁止密碼認證，僅允許金鑰
PasswordAuthentication no
ChallengeResponseAuthentication no
UsePAM yes

# 限制 SSH 協定版本
Protocol 2

# 限制允許登入的使用者（替換為實際使用者）
AllowUsers deploy admin

# 連線逾時設定
ClientAliveInterval 300
ClientAliveCountMax 2
LoginGraceTime 60

# 限制最大認證嘗試次數
MaxAuthTries 3
MaxSessions 4

# 停用不必要功能
X11Forwarding no
AllowAgentForwarding no
AllowTcpForwarding no
PrintMotd no

# 限制 SSH 監聽介面（視情況調整）
# ListenAddress 0.0.0.0

# 記錄級別
LogLevel VERBOSE
```

### 4.2 套用設定

```bash
sshd -t                          # 語法檢查
systemctl reload sshd
```

> **重要**：套用前確認已有可用的 SSH 金鑰及 sudo 存取，避免鎖死。

### 4.3 SSH 金鑰設定建議

```bash
# 產生 ED25519 金鑰（更安全，更小）
ssh-keygen -t ed25519 -C "deploy@titan"

# 授權金鑰存放位置
~/.ssh/authorized_keys  # 權限必須為 600
```

---

## 5. 帳號與密碼政策

### 5.1 密碼複雜度（PAM）

安裝 `libpam-pwquality`：

```bash
apt-get install -y libpam-pwquality
```

編輯 `/etc/security/pwquality.conf`：

```ini
# 最小長度 12 字元
minlen = 12

# 至少包含 1 個大寫、1 個小寫、1 個數字、1 個特殊字元
minclass = 4
ucredit = -1
lcredit = -1
dcredit = -1
ocredit = -1

# 禁止與使用者名稱相同
usercheck = 1

# 禁止重複使用最近 5 個密碼（在 /etc/pam.d/common-password 中設定 remember=5）
```

### 5.2 帳號有效期限（/etc/login.defs）

```bash
# 編輯 /etc/login.defs
PASS_MAX_DAYS   90     # 密碼最長有效 90 天
PASS_MIN_DAYS   1      # 密碼修改最短間隔 1 天
PASS_WARN_AGE   7      # 到期前 7 天警告
```

套用至現有使用者（以 `deploy` 為例）：

```bash
chage -M 90 -m 1 -W 7 deploy
chage -l deploy    # 確認設定
```

### 5.3 停用不必要系統帳號

```bash
# 鎖定不使用的帳號
passwd -l games
passwd -l news
passwd -l mail

# 確認沒有空白密碼帳號
awk -F: '($2 == "" ) { print $1 }' /etc/shadow
```

### 5.4 sudo 設定

```bash
# 建議使用 sudoers.d 目錄管理
visudo -f /etc/sudoers.d/titan-admins
```

範例內容（限制指令）：

```sudoers
# 允許 deploy 使用者執行特定指令而不需密碼
deploy ALL=(ALL) NOPASSWD: /usr/bin/docker, /usr/bin/docker-compose, /bin/systemctl
```

---

## 6. 核心參數調整（Docker 相容）

建立 `/etc/sysctl.d/99-titan-hardening.conf`：

```ini
# ============================================================
# 網路安全強化
# ============================================================

# 停用 IP 轉發（Docker 需要時設為 1）
net.ipv4.ip_forward = 1

# 停用 IPv6（若不使用）
net.ipv6.conf.all.disable_ipv6 = 1
net.ipv6.conf.default.disable_ipv6 = 1

# 防止 SYN Flood 攻擊
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.tcp_synack_retries = 2

# 禁止回應 ICMP 廣播（Smurf 攻擊防護）
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1

# 啟用反向路徑過濾（防 IP 偽造）
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# 禁止接受 ICMP 重定向（防止路由攻擊）
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv6.conf.all.accept_redirects = 0

# 禁止接受 Source Route 封包
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0

# 記錄偽造、不完整的封包
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1

# ============================================================
# 記憶體與核心安全
# ============================================================

# 停用 Magic SysRq 鍵（防止意外操作）
kernel.sysrq = 0

# 限制核心訊息讀取（非 root 使用者）
kernel.dmesg_restrict = 1

# 防止 core dump 洩漏敏感資訊
fs.suid_dumpable = 0
kernel.core_uses_pid = 1

# 位址空間隨機化（ASLR）—— 設為最高
kernel.randomize_va_space = 2

# 禁止掛載 user namespace（視 Docker 需求調整）
# kernel.unprivileged_userns_clone = 0

# ============================================================
# Docker / 容器相關
# ============================================================

# 允許 Docker 橋接網路
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1

# 增加最大連線追蹤數
net.netfilter.nf_conntrack_max = 1048576

# ============================================================
# 效能調整
# ============================================================

# 增加檔案描述符上限（Docker 容器需要）
fs.file-max = 2097152

# TCP 連線最佳化
net.core.somaxconn = 65535
net.ipv4.tcp_tw_reuse = 1
```

套用設定：

```bash
sysctl --system
# 或僅套用特定檔案
sysctl -p /etc/sysctl.d/99-titan-hardening.conf
```

---

## 7. 稽核與日誌設定

### 7.1 安裝 auditd

```bash
apt-get install -y auditd audispd-plugins
systemctl enable --now auditd
```

### 7.2 基本稽核規則 `/etc/audit/rules.d/titan.rules`

```
# 監控 /etc/passwd 和 /etc/shadow 變更
-w /etc/passwd -p wa -k identity
-w /etc/shadow -p wa -k identity
-w /etc/group -p wa -k identity

# 監控 SSH 設定變更
-w /etc/ssh/sshd_config -p wa -k sshd

# 監控 sudo 使用
-w /var/log/sudo.log -p wa -k sudo_log
-w /etc/sudoers -p wa -k sudoers

# 監控特權指令
-a always,exit -F arch=b64 -S execve -F euid=0 -k root_cmd

# 監控網路設定變更
-w /etc/network/ -p wa -k network_cfg
```

套用規則：

```bash
auditctl -R /etc/audit/rules.d/titan.rules
systemctl restart auditd
```

### 7.3 日誌集中保留

```bash
# 設定 journald 永久保留
sed -i 's/#Storage=auto/Storage=persistent/' /etc/systemd/journald.conf
systemctl restart systemd-journald
```

---

## 8. 驗證清單

完成設定後，執行 `scripts/os-verify.sh` 進行自動驗證。

手動檢查項目：

- [ ] `timedatectl` 顯示 `Asia/Taipei` 時區且 NTP 已同步
- [ ] `ufw status` 顯示 active，且只開放必要 port
- [ ] `sshd -T | grep permitrootlogin` 顯示 `no`
- [ ] `sshd -T | grep passwordauthentication` 顯示 `no`
- [ ] `sysctl net.ipv4.tcp_syncookies` 顯示 `1`
- [ ] `sysctl kernel.randomize_va_space` 顯示 `2`
- [ ] `systemctl is-active auditd` 顯示 `active`
- [ ] `chronyc tracking` 顯示時間已同步

---

> 本文件由 TITAN 專案 T06 任務產生。如有異動請同步更新 `scripts/os-harden.sh`。
