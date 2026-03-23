#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# TITAN 平台 — 自簽 SSL 憑證產生腳本
# 任務：T08 — Nginx Reverse Proxy and TLS
# ─────────────────────────────────────────────────────────────────────────
# 用途：為 MVP 環境產生自簽 TLS 憑證，供 Nginx 使用
#       正式上線時，以銀行內部 CA 核發憑證取代（請參閱 docs/nginx-setup.md）
#
# 使用方式：
#   bash scripts/generate-ssl-cert.sh
#
# 輸出：
#   config/nginx/certs/server.crt  — 自簽憑證（PEM 格式）
#   config/nginx/certs/server.key  — 私鑰（PEM 格式，2048 bit RSA）
# ═══════════════════════════════════════════════════════════════════════════

set -euo pipefail

# ── 設定區 ─────────────────────────────────────────────────────────────────
DOMAIN="${TITAN_DOMAIN:-titan.bank.local}"
CERT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/config/nginx/certs"
CERT_FILE="${CERT_DIR}/server.crt"
KEY_FILE="${CERT_DIR}/server.key"
DAYS=3650          # 憑證有效期 10 年（MVP 內部使用）
KEY_BITS=2048      # RSA 金鑰長度
COUNTRY="TW"
STATE="Taipei"
CITY="Taipei"
ORG="TITAN Bank Internal"
OU="IT Operations"

# ── 顏色輸出 ────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_success() { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }

# ── 前置檢查 ────────────────────────────────────────────────────────────────
check_prerequisites() {
    log_info "檢查必要工具..."
    if ! command -v openssl &>/dev/null; then
        log_error "未找到 openssl，請先安裝："
        log_error "  Debian/Ubuntu: sudo apt-get install -y openssl"
        log_error "  RHEL/CentOS:   sudo yum install -y openssl"
        exit 1
    fi
    log_success "openssl $(openssl version | awk '{print $2}') 已就緒"
}

# ── 建立輸出目錄 ────────────────────────────────────────────────────────────
prepare_directory() {
    log_info "建立憑證目錄：${CERT_DIR}"
    mkdir -p "${CERT_DIR}"
    chmod 700 "${CERT_DIR}"
    log_success "目錄已就緒"
}

# ── 確認是否覆寫既有憑證 ────────────────────────────────────────────────────
check_existing_cert() {
    if [[ -f "${CERT_FILE}" || -f "${KEY_FILE}" ]]; then
        log_warn "偵測到既有憑證："
        [[ -f "${CERT_FILE}" ]] && log_warn "  ${CERT_FILE}"
        [[ -f "${KEY_FILE}"  ]] && log_warn "  ${KEY_FILE}"

        if [[ "${FORCE:-}" != "1" ]]; then
            read -r -p "是否覆寫既有憑證？[y/N] " confirm
            if [[ "${confirm,,}" != "y" ]]; then
                log_info "操作取消，未覆寫憑證"
                exit 0
            fi
        else
            log_warn "FORCE=1，強制覆寫既有憑證"
        fi
    fi
}

# ── 產生自簽憑證 ────────────────────────────────────────────────────────────
generate_certificate() {
    log_info "產生自簽 TLS 憑證..."
    log_info "  網域名稱：${DOMAIN}"
    log_info "  有效期限：${DAYS} 天（約 $(( DAYS / 365 )) 年）"
    log_info "  RSA 金鑰：${KEY_BITS} bit"

    # 建立 SAN (Subject Alternative Names) 設定檔
    local san_conf
    san_conf="$(mktemp)"
    cat > "${san_conf}" <<EOF
[req]
default_bits       = ${KEY_BITS}
prompt             = no
default_md         = sha256
distinguished_name = dn
req_extensions     = req_ext
x509_extensions    = v3_ca

[dn]
C  = ${COUNTRY}
ST = ${STATE}
L  = ${CITY}
O  = ${ORG}
OU = ${OU}
CN = ${DOMAIN}

[req_ext]
subjectAltName = @alt_names

[v3_ca]
subjectKeyIdentifier   = hash
authorityKeyIdentifier = keyid:always,issuer
basicConstraints       = critical, CA:false
keyUsage               = critical, digitalSignature, keyEncipherment
extendedKeyUsage       = serverAuth
subjectAltName         = @alt_names

[alt_names]
DNS.1 = ${DOMAIN}
DNS.2 = titan.local
DNS.3 = localhost
IP.1  = 127.0.0.1
EOF

    # 一次性產生私鑰與自簽憑證
    openssl req \
        -x509 \
        -nodes \
        -newkey "rsa:${KEY_BITS}" \
        -keyout "${KEY_FILE}" \
        -out    "${CERT_FILE}" \
        -days   "${DAYS}" \
        -config "${san_conf}" \
        2>/dev/null

    rm -f "${san_conf}"

    # 設定安全權限
    chmod 600 "${KEY_FILE}"    # 私鑰：僅擁有者可讀
    chmod 644 "${CERT_FILE}"   # 憑證：其他人可讀

    log_success "憑證已產生"
}

# ── 驗證憑證內容 ────────────────────────────────────────────────────────────
verify_certificate() {
    log_info "驗證憑證..."

    local subject validity san
    subject=$(openssl x509 -noout -subject -in "${CERT_FILE}" 2>/dev/null)
    validity=$(openssl x509 -noout -dates  -in "${CERT_FILE}" 2>/dev/null)
    san=$(openssl x509 -noout -ext subjectAltName -in "${CERT_FILE}" 2>/dev/null | tail -1)

    log_success "憑證主旨：${subject#*=}"
    log_info "  有效期間：$(echo "${validity}" | grep notAfter | cut -d= -f2)"
    log_info "  SAN：${san}"
    log_info "  憑證路徑：${CERT_FILE}"
    log_info "  私鑰路徑：${KEY_FILE}"
}

# ── 顯示後續操作說明 ────────────────────────────────────────────────────────
print_next_steps() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║  憑證產生完成！後續步驟：                                    ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo "  1. 重新啟動 Nginx 服務："
    echo "     docker compose restart nginx"
    echo ""
    echo "  2. 在測試機器加入 /etc/hosts："
    echo "     <SERVER_IP>  titan.bank.local"
    echo ""
    echo "  3. 瀏覽器信任自簽憑證（開發測試用）："
    echo "     macOS:   sudo security add-trusted-cert -d -r trustRoot \\"
    echo "              -k /Library/Keychains/System.keychain ${CERT_FILE}"
    echo "     Ubuntu:  sudo cp ${CERT_FILE} /usr/local/share/ca-certificates/"
    echo "              sudo update-ca-certificates"
    echo ""
    echo -e "${YELLOW}  ⚠  正式上線請以銀行內部 CA 憑證取代，詳見 docs/nginx-setup.md${NC}"
    echo ""
}

# ── 主流程 ──────────────────────────────────────────────────────────────────
main() {
    echo ""
    echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  TITAN 平台 — 自簽 SSL 憑證產生腳本                   ${NC}"
    echo -e "${BLUE}════════════════════════════════════════════════════════${NC}"
    echo ""

    check_prerequisites
    prepare_directory
    check_existing_cert
    generate_certificate
    verify_certificate
    print_next_steps
}

main "$@"
