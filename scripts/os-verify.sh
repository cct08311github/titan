#!/usr/bin/env bash
# =============================================================================
# TITAN 專案 — OS 強化驗證腳本
# 任務：T06 — OS Baseline and Hardening
# 適用：Ubuntu 22.04 LTS / Debian 12+
#
# 使用方式：
#   sudo ./os-verify.sh           # 完整驗證
#   sudo ./os-verify.sh --quiet   # 僅顯示失敗項目
# =============================================================================

set -euo pipefail

# ── 顏色定義 ─────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# ── 全域統計 ─────────────────────────────────────────────────────────────────
PASS=0
FAIL=0
WARN=0
QUIET=false

# ── 解析參數 ─────────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --quiet|-q) QUIET=true ;;
    --help|-h)
      echo "用法: sudo $0 [--quiet] [--help]"
      echo "  --quiet   僅顯示失敗與警告項目"
      echo "  --help    顯示此說明"
      exit 0
      ;;
    *)
      echo "未知參數: $arg"
      exit 1
      ;;
  esac
done

# ── 工具函數 ─────────────────────────────────────────────────────────────────
pass() {
  PASS=$((PASS + 1))
  if [[ "$QUIET" == false ]]; then
    echo -e "  ${GREEN}[PASS]${NC} $*"
  fi
}

fail() {
  FAIL=$((FAIL + 1))
  echo -e "  ${RED}[FAIL]${NC} $*"
}

warn() {
  WARN=$((WARN + 1))
  echo -e "  ${YELLOW}[WARN]${NC} $*"
}

section() {
  echo ""
  echo -e "${BLUE}── $* ──────────────────────────────────────────────────────────${NC}"
}

check_cmd_exists() {
  local cmd="$1"
  if command -v "$cmd" &>/dev/null; then
    pass "指令存在：${cmd}"
    return 0
  else
    fail "指令不存在：${cmd}"
    return 1
  fi
}

check_service_active() {
  local svc="$1"
  if systemctl is-active --quiet "$svc" 2>/dev/null; then
    pass "服務運行中：${svc}"
    return 0
  else
    fail "服務未運行：${svc}"
    return 1
  fi
}

check_service_enabled() {
  local svc="$1"
  if systemctl is-enabled --quiet "$svc" 2>/dev/null; then
    pass "服務已啟用（開機自啟）：${svc}"
    return 0
  else
    fail "服務未設為開機自啟：${svc}"
    return 1
  fi
}

# ── 前置檢查 ─────────────────────────────────────────────────────────────────
check_prerequisites() {
  if [[ $EUID -ne 0 ]]; then
    echo -e "${RED}錯誤：此腳本必須以 root 身份執行（sudo ./os-verify.sh）${NC}"
    exit 1
  fi
}

# ── 1. 時區與 NTP 驗證 ────────────────────────────────────────────────────────
verify_timezone_ntp() {
  section "1. 時區與 NTP"

  # 時區
  local tz
  tz="$(timedatectl show --property=Timezone --value 2>/dev/null || timedatectl | awk '/Time zone/{print $3}')"
  if [[ "$tz" == "Asia/Taipei" ]]; then
    pass "時區：${tz}"
  else
    fail "時區不正確：${tz}（期望：Asia/Taipei）"
  fi

  # NTP 同步狀態
  local ntp_sync
  ntp_sync="$(timedatectl show --property=NTPSynchronized --value 2>/dev/null || echo 'unknown')"
  if [[ "$ntp_sync" == "yes" ]]; then
    pass "NTP 時間已同步"
  else
    warn "NTP 尚未同步（${ntp_sync}），請確認網路連線與 chrony 服務"
  fi

  # chrony 服務
  check_service_active chrony
  check_service_enabled chrony

  # chrony 追蹤狀態
  if command -v chronyc &>/dev/null; then
    local stratum
    stratum="$(chronyc tracking 2>/dev/null | awk '/Stratum/{print $3}' || echo '0')"
    if [[ -n "$stratum" ]] && [[ "$stratum" -gt 0 ]] 2>/dev/null; then
      pass "chrony 已同步，Stratum：${stratum}"
    else
      warn "chrony 同步狀態不確定（Stratum: ${stratum}）"
    fi
  fi
}

# ── 2. 套件驗證 ───────────────────────────────────────────────────────────────
verify_packages() {
  section "2. 套件與服務"

  # 確認危險套件已移除
  local danger_pkgs=(telnet rsh-client xinetd)
  for pkg in "${danger_pkgs[@]}"; do
    if ! dpkg -l "$pkg" &>/dev/null; then
      pass "套件已移除：${pkg}"
    else
      fail "危險套件仍存在：${pkg}（應移除）"
    fi
  done

  # unattended-upgrades
  if dpkg -l unattended-upgrades &>/dev/null; then
    pass "unattended-upgrades 已安裝"
  else
    warn "unattended-upgrades 未安裝，建議安裝以啟用自動安全更新"
  fi
}

# ── 3. 防火牆驗證 ─────────────────────────────────────────────────────────────
verify_firewall() {
  section "3. 防火牆（UFW）"

  if ! command -v ufw &>/dev/null; then
    fail "UFW 未安裝"
    return
  fi

  local ufw_status
  ufw_status="$(ufw status | head -1)"
  if echo "$ufw_status" | grep -qi "active"; then
    pass "UFW 防火牆：已啟用"
  else
    fail "UFW 防火牆：未啟用（${ufw_status}）"
  fi

  # 檢查預設政策
  local default_in
  default_in="$(ufw status verbose 2>/dev/null | awk '/Default.*incoming/{print $2}' || echo 'unknown')"
  if [[ "$default_in" == "deny" ]]; then
    pass "UFW 預設入站政策：deny（正確）"
  else
    fail "UFW 預設入站政策：${default_in}（期望：deny）"
  fi

  # 檢查必要 port
  local ufw_rules
  ufw_rules="$(ufw status numbered 2>/dev/null || echo '')"
  for port in 22 80 443; do
    if echo "$ufw_rules" | grep -q "${port}/tcp\|${port} "; then
      pass "UFW 允許 port ${port}/tcp"
    else
      warn "UFW 未明確允許 port ${port}/tcp，請確認是否需要"
    fi
  done

  # Docker 轉發設定
  local forward_policy
  forward_policy="$(grep '^DEFAULT_FORWARD_POLICY' /etc/default/ufw 2>/dev/null | cut -d'"' -f2 || echo 'unknown')"
  if [[ "$forward_policy" == "ACCEPT" ]]; then
    pass "UFW Docker 橋接轉發：ACCEPT（正確）"
  else
    warn "UFW DEFAULT_FORWARD_POLICY=${forward_policy}（Docker 可能需要 ACCEPT）"
  fi
}

# ── 4. SSH 驗證 ───────────────────────────────────────────────────────────────
verify_ssh() {
  section "4. SSH 強化設定"

  if ! command -v sshd &>/dev/null; then
    warn "sshd 未安裝，跳過 SSH 驗證"
    return
  fi

  # 讀取 sshd 有效設定（包含 Include 檔案）
  local sshd_runtime
  sshd_runtime="$(sshd -T 2>/dev/null || echo '')"

  check_sshd_setting() {
    local key="$1"
    local expected="$2"
    local actual
    actual="$(echo "$sshd_runtime" | awk -v k="${key,,}" 'tolower($1)==k{print tolower($2); exit}')"
    if [[ "$actual" == "${expected,,}" ]]; then
      pass "sshd ${key}：${actual}（正確）"
    else
      fail "sshd ${key}：${actual}（期望：${expected}）"
    fi
  }

  check_sshd_setting "PermitRootLogin"          "no"
  check_sshd_setting "PasswordAuthentication"   "no"
  check_sshd_setting "X11Forwarding"            "no"
  check_sshd_setting "AllowAgentForwarding"     "no"
  check_sshd_setting "AllowTcpForwarding"       "no"
  check_sshd_setting "LogLevel"                 "verbose"

  # MaxAuthTries 不應超過 5
  local max_auth_tries
  max_auth_tries="$(echo "$sshd_runtime" | awk 'tolower($1)=="maxauthtries"{print $2}')"
  if [[ -n "$max_auth_tries" ]] && [[ "$max_auth_tries" -le 5 ]] 2>/dev/null; then
    pass "sshd MaxAuthTries：${max_auth_tries}（≤5，正確）"
  else
    fail "sshd MaxAuthTries：${max_auth_tries:-未設定}（期望：≤5）"
  fi

  # sshd 服務運行狀態
  check_service_active sshd || check_service_active ssh
}

# ── 5. 帳號政策驗證 ───────────────────────────────────────────────────────────
verify_account_policies() {
  section "5. 帳號與密碼政策"

  # login.defs
  local login_defs="/etc/login.defs"
  check_login_defs() {
    local key="$1"
    local expected="$2"
    local actual
    actual="$(awk -v k="$key" '$1==k{print $2}' "$login_defs" 2>/dev/null || echo '')"
    if [[ "$actual" == "$expected" ]]; then
      pass "${login_defs} ${key}：${actual}（正確）"
    else
      fail "${login_defs} ${key}：${actual}（期望：${expected}）"
    fi
  }

  check_login_defs "PASS_MAX_DAYS" "90"
  check_login_defs "PASS_MIN_DAYS" "1"
  check_login_defs "PASS_WARN_AGE" "7"

  # libpam-pwquality
  if dpkg -l libpam-pwquality &>/dev/null; then
    pass "libpam-pwquality 已安裝"
    local minlen
    minlen="$(awk -F'=' '/^minlen/{gsub(/ /,"",$2); print $2}' /etc/security/pwquality.conf 2>/dev/null || echo '')"
    if [[ -n "$minlen" ]] && [[ "$minlen" -ge 12 ]] 2>/dev/null; then
      pass "密碼最小長度：${minlen}（≥12，正確）"
    else
      fail "密碼最小長度：${minlen:-未設定}（期望：≥12）"
    fi
  else
    fail "libpam-pwquality 未安裝"
  fi

  # 空白密碼帳號
  local empty_pw
  empty_pw="$(awk -F: '($2 == "" ) { print $1 }' /etc/shadow 2>/dev/null || echo '')"
  if [[ -z "$empty_pw" ]]; then
    pass "無空白密碼帳號"
  else
    fail "偵測到空白密碼帳號：${empty_pw}"
  fi
}

# ── 6. 核心參數驗證 ───────────────────────────────────────────────────────────
verify_kernel_params() {
  section "6. 核心參數（sysctl）"

  check_sysctl() {
    local key="$1"
    local expected="$2"
    local actual
    actual="$(sysctl -n "$key" 2>/dev/null || echo 'N/A')"
    if [[ "$actual" == "$expected" ]]; then
      pass "${key}：${actual}（正確）"
    else
      fail "${key}：${actual}（期望：${expected}）"
    fi
  }

  # 網路安全
  check_sysctl "net.ipv4.tcp_syncookies"                   "1"
  check_sysctl "net.ipv4.icmp_echo_ignore_broadcasts"      "1"
  check_sysctl "net.ipv4.conf.all.accept_redirects"        "0"
  check_sysctl "net.ipv4.conf.all.send_redirects"          "0"
  check_sysctl "net.ipv4.conf.all.accept_source_route"     "0"
  check_sysctl "net.ipv4.conf.all.log_martians"            "1"
  check_sysctl "net.ipv4.conf.all.rp_filter"               "1"

  # 核心安全
  check_sysctl "kernel.sysrq"                              "0"
  check_sysctl "kernel.dmesg_restrict"                     "1"
  check_sysctl "kernel.randomize_va_space"                 "2"
  check_sysctl "fs.suid_dumpable"                          "0"

  # Docker 相關
  check_sysctl "net.ipv4.ip_forward"                       "1"

  # 設定檔存在
  if [[ -f "/etc/sysctl.d/99-titan-hardening.conf" ]]; then
    pass "sysctl 設定檔存在：/etc/sysctl.d/99-titan-hardening.conf"
  else
    warn "未找到 TITAN sysctl 設定檔（/etc/sysctl.d/99-titan-hardening.conf）"
  fi
}

# ── 7. 稽核驗證 ───────────────────────────────────────────────────────────────
verify_auditd() {
  section "7. 稽核（auditd）"

  check_service_active auditd
  check_service_enabled auditd

  # 稽核規則
  local audit_rules
  audit_rules="$(auditctl -l 2>/dev/null || echo '')"

  check_audit_rule() {
    local desc="$1"
    local pattern="$2"
    if echo "$audit_rules" | grep -q "$pattern"; then
      pass "稽核規則存在：${desc}"
    else
      fail "稽核規則缺失：${desc}"
    fi
  }

  check_audit_rule "/etc/passwd 監控"      "/etc/passwd"
  check_audit_rule "/etc/shadow 監控"      "/etc/shadow"
  check_audit_rule "sshd_config 監控"      "sshd_config"
  check_audit_rule "sudoers 監控"          "sudoers"

  # journald 持久化
  local journald_storage
  journald_storage="$(awk -F'=' '/^Storage/{gsub(/ /,"",$2); print $2}' /etc/systemd/journald.conf 2>/dev/null || echo 'auto')"
  if [[ "$journald_storage" == "persistent" ]]; then
    pass "journald Storage：persistent（日誌永久保留）"
  else
    warn "journald Storage：${journald_storage}（建議設為 persistent）"
  fi
}

# ── 8. 額外安全檢查 ───────────────────────────────────────────────────────────
verify_extra() {
  section "8. 額外安全檢查"

  # 監聽埠檢查（非預期的開放 port）
  if command -v ss &>/dev/null; then
    local listening_ports
    listening_ports="$(ss -tlnp 2>/dev/null | awk 'NR>1{print $4}' | sort -u || echo '')"
    local unexpected_ports=()
    while IFS= read -r addr; do
      local port
      port="$(echo "$addr" | rev | cut -d: -f1 | rev)"
      case "$port" in
        22|80|443|25|587|3306|5432|6379|8080|8443) ;;  # 已知服務
        *)
          if [[ -n "$port" ]] && [[ "$port" =~ ^[0-9]+$ ]]; then
            unexpected_ports+=("$port")
          fi
          ;;
      esac
    done <<< "$listening_ports"

    if [[ ${#unexpected_ports[@]} -eq 0 ]]; then
      pass "無意外開放的監聽埠"
    else
      warn "偵測到非預期監聽埠：${unexpected_ports[*]}，請確認是否必要"
    fi
  fi

  # SUID/SGID 檔案數量（警戒值）
  local suid_count
  suid_count="$(find / -xdev \( -perm -4000 -o -perm -2000 \) -type f 2>/dev/null | wc -l || echo '0')"
  if [[ "$suid_count" -le 50 ]]; then
    pass "SUID/SGID 檔案數量：${suid_count}（≤50，正常）"
  else
    warn "SUID/SGID 檔案數量：${suid_count}（建議手動審查）"
  fi

  # 確認 /tmp 掛載選項（若為獨立分割區）
  if mount | grep -q " on /tmp "; then
    local tmp_opts
    tmp_opts="$(mount | awk '$3=="/tmp"{print $6}')"
    if echo "$tmp_opts" | grep -q "noexec"; then
      pass "/tmp 掛載含 noexec 選項"
    else
      warn "/tmp 未設定 noexec 掛載選項，建議評估是否需要"
    fi
  fi
}

# ── 彙整報告 ─────────────────────────────────────────────────────────────────
print_report() {
  local total=$((PASS + FAIL + WARN))
  echo ""
  echo -e "${BLUE}================================================================${NC}"
  echo -e "${BLUE}  TITAN OS 強化驗證報告${NC}"
  echo -e "${BLUE}================================================================${NC}"
  printf "  %-12s %s\n" "主機名稱：" "$(hostname)"
  printf "  %-12s %s\n" "驗證時間：" "$(date '+%Y-%m-%d %H:%M:%S %Z')"
  printf "  %-12s %s\n" "執行身份：" "$(id)"
  echo ""
  printf "  ${GREEN}%-10s %d${NC}\n" "通過：" "$PASS"
  printf "  ${RED}%-10s %d${NC}\n" "失敗：" "$FAIL"
  printf "  ${YELLOW}%-10s %d${NC}\n" "警告：" "$WARN"
  printf "  %-10s %d\n" "總計：" "$total"
  echo ""

  if [[ "$FAIL" -eq 0 ]]; then
    echo -e "${GREEN}  [結論] 所有強制項目均通過，系統符合 TITAN OS 強化基準${NC}"
    if [[ "$WARN" -gt 0 ]]; then
      echo -e "${YELLOW}  [提醒] 有 ${WARN} 個警告項目，建議評估處理${NC}"
    fi
  else
    echo -e "${RED}  [結論] 有 ${FAIL} 個項目不符合強化基準，請執行 scripts/os-harden.sh 修復${NC}"
  fi
  echo -e "${BLUE}================================================================${NC}"
  echo ""

  # 以結果決定退出碼
  [[ "$FAIL" -eq 0 ]]
}

# ── 主程式 ────────────────────────────────────────────────────────────────────
main() {
  check_prerequisites

  echo ""
  echo -e "${BLUE}TITAN OS 強化驗證腳本 — 開始執行${NC}"
  echo -e "${BLUE}時間：$(date '+%Y-%m-%d %H:%M:%S %Z')${NC}"

  verify_timezone_ntp
  verify_packages
  verify_firewall
  verify_ssh
  verify_account_policies
  verify_kernel_params
  verify_auditd
  verify_extra
  print_report
}

main "$@"
