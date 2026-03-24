#!/usr/bin/env bash
# =============================================================================
# TITAN 專案 — OS 基礎強化腳本
# 任務：T06 — OS Baseline and Hardening
# 適用：Ubuntu 22.04 LTS / Debian 12+
# 作者：TITAN Team
# 版本：1.0.0
#
# 使用方式：
#   sudo ./os-harden.sh           # 實際執行
#   sudo ./os-harden.sh --dry-run # 模擬執行（不變更系統）
# =============================================================================

set -euo pipefail

# ── 顏色定義 ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'  # No Color

# ── 全域變數 ─────────────────────────────────────────────────────────────────
DRY_RUN=false
LOG_FILE="/var/log/titan-os-harden.log"
SSHD_CONFIG="/etc/ssh/sshd_config"
SYSCTL_FILE="/etc/sysctl.d/99-titan-hardening.conf"
CHRONY_CONF="/etc/chrony.conf"
PWQUALITY_CONF="/etc/security/pwquality.conf"
AUDIT_RULES="/etc/audit/rules.d/titan.rules"

# ── 解析參數 ─────────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      ;;
    --help|-h)
      echo "用法: sudo $0 [--dry-run] [--help]"
      echo "  --dry-run   模擬執行，不實際變更系統"
      echo "  --help      顯示此說明"
      exit 0
      ;;
    *)
      echo "未知參數: $arg"
      echo "使用 --help 查看說明"
      exit 1
      ;;
  esac
done

# ── 工具函數 ─────────────────────────────────────────────────────────────────
log() {
  local level="$1"
  shift
  local msg="$*"
  local timestamp
  timestamp="$(date '+%Y-%m-%d %H:%M:%S')"
  case "$level" in
    INFO)  echo -e "${GREEN}[INFO]${NC}  ${timestamp} ${msg}" ;;
    WARN)  echo -e "${YELLOW}[WARN]${NC}  ${timestamp} ${msg}" ;;
    ERROR) echo -e "${RED}[ERROR]${NC} ${timestamp} ${msg}" >&2 ;;
    STEP)  echo -e "${BLUE}[STEP]${NC}  ${timestamp} ${msg}" ;;
  esac
  if [[ "$DRY_RUN" == false ]] && [[ -w "$(dirname "$LOG_FILE")" ]]; then
    echo "[${level}] ${timestamp} ${msg}" >> "$LOG_FILE"
  fi
}

run_cmd() {
  # 執行指令，若為 dry-run 模式則僅印出
  local cmd=("$@")
  if [[ "$DRY_RUN" == true ]]; then
    echo -e "${YELLOW}[DRY-RUN]${NC} 將執行: ${cmd[*]}"
  else
    "${cmd[@]}"
  fi
}

write_file() {
  # 寫入檔案，dry-run 模式下僅顯示內容
  local filepath="$1"
  local content="$2"
  if [[ "$DRY_RUN" == true ]]; then
    echo -e "${YELLOW}[DRY-RUN]${NC} 將寫入 ${filepath}:"
    echo "---"
    echo "$content"
    echo "---"
  else
    echo "$content" > "$filepath"
    log INFO "已寫入 ${filepath}"
  fi
}

set_config_value() {
  # 設定設定檔中的特定 key，若不存在則追加
  local filepath="$1"
  local key="$2"
  local value="$3"
  if [[ "$DRY_RUN" == true ]]; then
    echo -e "${YELLOW}[DRY-RUN]${NC} 將設定 ${filepath}: ${key} = ${value}"
    return
  fi
  if grep -qE "^#?[[:space:]]*${key}[[:space:]]" "$filepath"; then
    sed -i "s|^#\?[[:space:]]*${key}[[:space:]].*|${key} ${value}|g" "$filepath"
  else
    echo "${key} ${value}" >> "$filepath"
  fi
  log INFO "已設定 ${filepath}: ${key} ${value}"
}

# ── 前置檢查 ─────────────────────────────────────────────────────────────────
check_prerequisites() {
  log STEP "=== 前置條件檢查 ==="

  # 必須以 root 執行
  if [[ $EUID -ne 0 ]]; then
    log ERROR "此腳本必須以 root 身份執行（sudo ./os-harden.sh）"
    exit 1
  fi

  # 確認作業系統
  if [[ ! -f /etc/os-release ]]; then
    log ERROR "無法識別作業系統（找不到 /etc/os-release）"
    exit 1
  fi
  # shellcheck source=/dev/null
  source /etc/os-release
  if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
    log WARN "偵測到非 Ubuntu/Debian 系統（$ID），部分設定可能不適用"
  fi
  log INFO "作業系統：${PRETTY_NAME:-$ID}"

  if [[ "$DRY_RUN" == true ]]; then
    log INFO "========================================"
    log INFO "  模擬執行模式（DRY-RUN）已啟用"
    log INFO "  所有變更僅顯示，不實際套用"
    log INFO "========================================"
  fi
}

# ── 1. 時區與 NTP 設定 ────────────────────────────────────────────────────────
setup_timezone_ntp() {
  log STEP "=== [1/7] 時區與 NTP 設定 ==="

  # 設定時區
  local current_tz
  current_tz="$(timedatectl show --property=Timezone --value 2>/dev/null || echo 'unknown')"
  if [[ "$current_tz" == "Asia/Taipei" ]]; then
    log INFO "時區已設定為 Asia/Taipei，跳過"
  else
    log INFO "目前時區：${current_tz}，設定為 Asia/Taipei"
    run_cmd timedatectl set-timezone Asia/Taipei
  fi

  # 安裝 chrony
  if dpkg -l chrony &>/dev/null; then
    log INFO "chrony 已安裝，跳過安裝"
  else
    log INFO "安裝 chrony..."
    run_cmd apt-get install -y chrony
  fi

  # 設定 chrony 使用台灣 NTP 池
  if [[ "$DRY_RUN" == false ]] && ! grep -q "tw.pool.ntp.org" "$CHRONY_CONF" 2>/dev/null; then
    log INFO "在 ${CHRONY_CONF} 加入台灣 NTP 池設定"
    run_cmd bash -c "echo 'pool tw.pool.ntp.org iburst maxsources 4' >> ${CHRONY_CONF}"
  elif [[ "$DRY_RUN" == true ]]; then
    echo -e "${YELLOW}[DRY-RUN]${NC} 將加入台灣 NTP 池設定至 ${CHRONY_CONF}"
  else
    log INFO "台灣 NTP 池設定已存在，跳過"
  fi

  run_cmd systemctl enable --now chrony
  run_cmd systemctl restart chrony
  log INFO "時區與 NTP 設定完成"
}

# ── 2. 最小化套件 ─────────────────────────────────────────────────────────────
minimize_packages() {
  log STEP "=== [2/7] 移除不必要套件 ==="

  local remove_pkgs=(
    telnet rsh-client rsh-redone-client nis yp-tools
    talk talkd xinetd inetutils-telnetd
  )

  local to_remove=()
  for pkg in "${remove_pkgs[@]}"; do
    if dpkg -l "$pkg" &>/dev/null; then
      to_remove+=("$pkg")
    fi
  done

  if [[ ${#to_remove[@]} -eq 0 ]]; then
    log INFO "無需移除的套件，跳過"
  else
    log INFO "將移除：${to_remove[*]}"
    run_cmd apt-get purge -y "${to_remove[@]}"
    run_cmd apt-get autoremove -y
  fi

  # 停用不必要服務
  local disable_services=(avahi-daemon cups bluetooth)
  for svc in "${disable_services[@]}"; do
    if systemctl list-unit-files "${svc}.service" &>/dev/null; then
      log INFO "停用服務：${svc}"
      run_cmd systemctl disable --now "$svc" 2>/dev/null || true
    fi
  done

  # 安裝 unattended-upgrades
  if ! dpkg -l unattended-upgrades &>/dev/null; then
    log INFO "安裝 unattended-upgrades..."
    run_cmd apt-get install -y unattended-upgrades apt-listchanges
  else
    log INFO "unattended-upgrades 已安裝，跳過"
  fi

  log INFO "套件最小化完成"
}

# ── 3. 防火牆設定（UFW）───────────────────────────────────────────────────────
setup_firewall() {
  log STEP "=== [3/7] 防火牆設定（UFW） ==="

  if ! dpkg -l ufw &>/dev/null; then
    log INFO "安裝 UFW..."
    run_cmd apt-get install -y ufw
  fi

  # 重置並設定預設政策
  run_cmd ufw --force reset
  run_cmd ufw default deny incoming
  run_cmd ufw default allow outgoing

  # 設定 Docker 橋接轉發
  if [[ "$DRY_RUN" == false ]]; then
    if grep -q "DEFAULT_FORWARD_POLICY" /etc/default/ufw; then
      sed -i 's/DEFAULT_FORWARD_POLICY="DROP"/DEFAULT_FORWARD_POLICY="ACCEPT"/' /etc/default/ufw
    fi
  else
    echo -e "${YELLOW}[DRY-RUN]${NC} 將設定 /etc/default/ufw: DEFAULT_FORWARD_POLICY=ACCEPT"
  fi

  # 允許必要連接埠
  run_cmd ufw allow 22/tcp    # SSH
  run_cmd ufw allow 80/tcp    # HTTP
  run_cmd ufw allow 443/tcp   # HTTPS

  # 啟用防火牆
  run_cmd ufw --force enable
  log INFO "防火牆設定完成"
}

# ── 4. SSH 強化 ────────────────────────────────────────────────────────────────
harden_ssh() {
  log STEP "=== [4/7] SSH 強化設定 ==="

  if [[ ! -f "$SSHD_CONFIG" ]]; then
    log ERROR "找不到 ${SSHD_CONFIG}，跳過 SSH 設定"
    return
  fi

  # 備份原始設定
  if [[ "$DRY_RUN" == false ]] && [[ ! -f "${SSHD_CONFIG}.bak" ]]; then
    run_cmd cp "$SSHD_CONFIG" "${SSHD_CONFIG}.bak"
    log INFO "已備份 ${SSHD_CONFIG} 至 ${SSHD_CONFIG}.bak"
  fi

  local ssh_settings=(
    "PermitRootLogin no"
    "PasswordAuthentication no"
    "ChallengeResponseAuthentication no"
    "X11Forwarding no"
    "AllowAgentForwarding no"
    "AllowTcpForwarding no"
    "MaxAuthTries 3"
    "MaxSessions 4"
    "LoginGraceTime 60"
    "ClientAliveInterval 300"
    "ClientAliveCountMax 2"
    "PrintMotd no"
    "LogLevel VERBOSE"
    "Protocol 2"
  )

  for setting in "${ssh_settings[@]}"; do
    local key value
    key="$(echo "$setting" | awk '{print $1}')"
    value="$(echo "$setting" | awk '{$1=""; print $0}' | sed 's/^ //')"
    set_config_value "$SSHD_CONFIG" "$key" "$value"
  done

  # 語法檢查
  if [[ "$DRY_RUN" == false ]]; then
    if sshd -t; then
      run_cmd systemctl reload sshd
      log INFO "SSH 設定已套用"
    else
      log ERROR "SSH 設定語法錯誤！正在還原備份..."
      cp "${SSHD_CONFIG}.bak" "$SSHD_CONFIG"
      exit 1
    fi
  else
    echo -e "${YELLOW}[DRY-RUN]${NC} 將執行 sshd -t 語法檢查並重新載入 sshd"
  fi

  log INFO "SSH 強化完成"
}

# ── 5. 帳號與密碼政策 ─────────────────────────────────────────────────────────
setup_account_policies() {
  log STEP "=== [5/7] 帳號與密碼政策 ==="

  # 安裝 libpam-pwquality
  if ! dpkg -l libpam-pwquality &>/dev/null; then
    log INFO "安裝 libpam-pwquality..."
    run_cmd apt-get install -y libpam-pwquality
  fi

  # 設定密碼複雜度
  if [[ "$DRY_RUN" == false ]]; then
    cat > "$PWQUALITY_CONF" <<'PWEOF'
# TITAN OS Hardening — 密碼複雜度政策
minlen = 12
minclass = 4
ucredit = -1
lcredit = -1
dcredit = -1
ocredit = -1
usercheck = 1
enforcing = 1
PWEOF
    log INFO "已寫入密碼複雜度設定至 ${PWQUALITY_CONF}"
  else
    echo -e "${YELLOW}[DRY-RUN]${NC} 將寫入密碼複雜度設定至 ${PWQUALITY_CONF}"
  fi

  # 設定 login.defs 密碼有效期
  local login_defs="/etc/login.defs"
  set_config_value "$login_defs" "PASS_MAX_DAYS" "90"
  set_config_value "$login_defs" "PASS_MIN_DAYS" "1"
  set_config_value "$login_defs" "PASS_WARN_AGE" "7"

  # 確認沒有空白密碼帳號
  if [[ "$DRY_RUN" == false ]]; then
    local empty_pw
    empty_pw="$(awk -F: '($2 == "" ) { print $1 }' /etc/shadow 2>/dev/null || true)"
    if [[ -n "$empty_pw" ]]; then
      log WARN "偵測到空白密碼帳號：${empty_pw}，請手動處理"
    else
      log INFO "無空白密碼帳號"
    fi
  fi

  log INFO "帳號政策設定完成"
}

# ── 6. 核心參數（sysctl）─────────────────────────────────────────────────────
setup_kernel_params() {
  log STEP "=== [6/7] 核心參數調整（Docker 相容） ==="

  local sysctl_content='# TITAN OS Hardening — 核心參數設定
# 由 os-harden.sh 自動產生，請勿手動編輯

# ── 網路安全 ────────────────────────────────────────────────
net.ipv4.ip_forward = 1
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 4096
net.ipv4.tcp_synack_retries = 2
net.ipv4.icmp_echo_ignore_broadcasts = 1
net.ipv4.icmp_ignore_bogus_error_responses = 1
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1
net.ipv4.conf.all.accept_redirects = 0
net.ipv4.conf.default.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.accept_source_route = 0
net.ipv4.conf.default.accept_source_route = 0
net.ipv4.conf.all.log_martians = 1
net.ipv4.conf.default.log_martians = 1

# ── 核心安全 ────────────────────────────────────────────────
kernel.sysrq = 0
kernel.dmesg_restrict = 1
fs.suid_dumpable = 0
kernel.core_uses_pid = 1
kernel.randomize_va_space = 2

# ── Docker / 容器相容 ────────────────────────────────────────
net.bridge.bridge-nf-call-iptables = 1
net.bridge.bridge-nf-call-ip6tables = 1
net.netfilter.nf_conntrack_max = 1048576

# ── 效能調整 ────────────────────────────────────────────────
fs.file-max = 2097152
net.core.somaxconn = 65535
net.ipv4.tcp_tw_reuse = 1'

  write_file "$SYSCTL_FILE" "$sysctl_content"

  if [[ "$DRY_RUN" == false ]]; then
    # 載入 br_netfilter 模組（Docker bridge 需要）
    modprobe br_netfilter 2>/dev/null || true
    if ! grep -q "br_netfilter" /etc/modules-load.d/*.conf 2>/dev/null; then
      echo "br_netfilter" > /etc/modules-load.d/titan-br_netfilter.conf
    fi
    sysctl --system
    log INFO "核心參數已套用"
  else
    echo -e "${YELLOW}[DRY-RUN]${NC} 將執行 sysctl --system 套用核心參數"
  fi

  log INFO "核心參數設定完成"
}

# ── 7. 稽核設定（auditd）──────────────────────────────────────────────────────
setup_auditd() {
  log STEP "=== [7/7] 稽核與日誌設定（auditd） ==="

  if ! dpkg -l auditd &>/dev/null; then
    log INFO "安裝 auditd..."
    run_cmd apt-get install -y auditd audispd-plugins
  fi

  run_cmd systemctl enable --now auditd

  local audit_rules_content='-w /etc/passwd -p wa -k identity
-w /etc/shadow -p wa -k identity
-w /etc/group -p wa -k identity
-w /etc/ssh/sshd_config -p wa -k sshd
-w /var/log/sudo.log -p wa -k sudo_log
-w /etc/sudoers -p wa -k sudoers
-a always,exit -F arch=b64 -S execve -F euid=0 -k root_cmd
-w /etc/network/ -p wa -k network_cfg'

  if [[ "$DRY_RUN" == false ]]; then
    mkdir -p "$(dirname "$AUDIT_RULES")"
  fi
  write_file "$AUDIT_RULES" "$audit_rules_content"

  if [[ "$DRY_RUN" == false ]]; then
    run_cmd systemctl restart auditd
    log INFO "auditd 稽核規則已套用"
  else
    echo -e "${YELLOW}[DRY-RUN]${NC} 將重啟 auditd 並套用規則"
  fi

  # 設定 journald 永久保留日誌
  if [[ "$DRY_RUN" == false ]]; then
    sed -i 's/^#Storage=auto/Storage=persistent/' /etc/systemd/journald.conf 2>/dev/null || true
    systemctl restart systemd-journald
    log INFO "journald 已設定為永久保留日誌"
  else
    echo -e "${YELLOW}[DRY-RUN]${NC} 將設定 journald Storage=persistent"
  fi

  log INFO "稽核設定完成"
}

# ── 完成摘要 ─────────────────────────────────────────────────────────────────
print_summary() {
  echo ""
  echo -e "${GREEN}================================================================${NC}"
  if [[ "$DRY_RUN" == true ]]; then
    echo -e "${GREEN}  TITAN OS 強化腳本 — 模擬執行完成（未實際變更系統）${NC}"
  else
    echo -e "${GREEN}  TITAN OS 強化腳本 — 執行完成${NC}"
  fi
  echo -e "${GREEN}================================================================${NC}"
  echo ""
  echo "已完成步驟："
  echo "  [1] 時區設定（Asia/Taipei）+ chrony NTP"
  echo "  [2] 移除不必要套件 + unattended-upgrades"
  echo "  [3] UFW 防火牆（預設拒絕入站，開放 22/80/443）"
  echo "  [4] SSH 強化（禁止 root 登入、禁止密碼認證）"
  echo "  [5] 密碼複雜度政策（12 字元、4 類別）"
  echo "  [6] 核心參數（SYN cookie、ASLR、Docker 橋接）"
  echo "  [7] auditd 稽核規則 + journald 永久日誌"
  echo ""
  if [[ "$DRY_RUN" == false ]]; then
    echo -e "${YELLOW}建議後續步驟：${NC}"
    echo "  1. 執行 scripts/os-verify.sh 驗證設定"
    echo "  2. 確認可以使用 SSH 金鑰登入後，再完全停用密碼認證"
    echo "  3. 依專案需求調整 UFW 規則（如需開放其他 port）"
    echo "  4. 完整日誌請查看 ${LOG_FILE}"
  fi
  echo ""
}

# ── 主程式 ────────────────────────────────────────────────────────────────────
main() {
  check_prerequisites
  setup_timezone_ntp
  minimize_packages
  setup_firewall
  harden_ssh
  setup_account_policies
  setup_kernel_params
  setup_auditd
  print_summary
}

main "$@"
