#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════════
# TITAN 離線部署封包腳本
# 任務：Issue #1302 — Air-Gapped Offline Deployment Package
# ═══════════════════════════════════════════════════════════════════════════════
# 用途：將 TITAN 所有 Docker 映像打包成單一壓縮檔，供封閉網路環境部署使用
#   1. 建構 titan-app:latest 與 titan-migrate:latest（可跳過）
#   2. 拉取所有第三方映像
#   3. 匯出所有映像為單一壓縮 tarball
#   4. 產生 manifest 檔案（映像清單 + SHA256）
#   5. 輸出至 dist/titan-offline-<date>.tar.gz 與 .manifest
#
# 使用方式：
#   bash scripts/package-offline.sh              # 完整封包（含建構）
#   bash scripts/package-offline.sh --skip-build # 跳過 titan-app 重建（使用現有映像）
#   bash scripts/package-offline.sh --load <tarball>  # 在目標機器載入封包
#
# 環境變數（可選覆蓋）：
#   OUTPUT_DIR   — 輸出目錄（預設：dist/）
# ═══════════════════════════════════════════════════════════════════════════════

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"

# ── 顏色輸出 ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()    { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()      { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()    { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_error()   { echo -e "${RED}[ERROR]${NC} $*" >&2; }
log_section() { echo -e "\n${CYAN}══════════════════════════════════════${NC}"; echo -e "${CYAN}  $*${NC}"; echo -e "${CYAN}══════════════════════════════════════${NC}"; }

# ── 參數解析 ──────────────────────────────────────────────────────────────────
SKIP_BUILD=false
LOAD_MODE=false
LOAD_TARBALL=""

for arg in "$@"; do
  case "${arg}" in
    --skip-build) SKIP_BUILD=true ;;
    --load)
      LOAD_MODE=true
      ;;
    --help|-h)
      echo "用法：bash scripts/package-offline.sh [選項]"
      echo ""
      echo "選項："
      echo "  --skip-build         跳過 titan-app / titan-migrate 重建（使用現有映像）"
      echo "  --load <tarball>     在目標機器載入封包（air-gapped 環境使用）"
      echo "  --help, -h           顯示此說明"
      echo ""
      echo "範例："
      echo "  bash scripts/package-offline.sh                    # 完整封包"
      echo "  bash scripts/package-offline.sh --skip-build       # 跳過重建"
      echo "  bash scripts/package-offline.sh --load dist/titan-offline-20260407.tar.gz"
      exit 0
      ;;
    *)
      # 如果前一個參數是 --load，則此參數為 tarball 路徑
      if [[ "${LOAD_MODE}" == "true" ]] && [[ -z "${LOAD_TARBALL}" ]]; then
        LOAD_TARBALL="${arg}"
      else
        log_error "未知參數：${arg}（使用 --help 查看說明）"
        exit 1
      fi
      ;;
  esac
done

# ── 映像清單 ──────────────────────────────────────────────────────────────────
# 第三方映像（固定版本，確保離線環境一致性）
THIRD_PARTY_IMAGES=(
  "postgres:16-alpine"
  "redis:7-alpine"
  "minio/minio:latest"
  "outlinewiki/outline:1.6.1"
  "tecnativa/docker-socket-proxy:0.2"
  "gethomepage/homepage:v0.9.13"
  "prom/prometheus:v2.48.1"
  "prom/node-exporter:v1.7.0"
  "gcr.io/cadvisor/cadvisor:v0.47.2"
)

# 本地建構映像
LOCAL_IMAGES=(
  "titan-app:latest"
  "titan-migrate:latest"
)

# 所有映像（第三方 + 本地）
ALL_IMAGES=("${THIRD_PARTY_IMAGES[@]}" "${LOCAL_IMAGES[@]}")

# ── 輸出路徑 ──────────────────────────────────────────────────────────────────
OUTPUT_DIR="${OUTPUT_DIR:-${PROJECT_DIR}/dist}"
DATE_STAMP=$(date +%Y%m%d)
OUTPUT_TARBALL="${OUTPUT_DIR}/titan-offline-${DATE_STAMP}.tar.gz"
OUTPUT_MANIFEST="${OUTPUT_DIR}/titan-offline-${DATE_STAMP}.manifest"

# ── --load 模式：在目標機器載入封包 ──────────────────────────────────────────

load_images() {
  log_section "載入模式：從 tarball 載入 Docker 映像"

  if [[ -z "${LOAD_TARBALL}" ]]; then
    log_error "請指定 tarball 路徑：bash scripts/package-offline.sh --load <tarball>"
    exit 1
  fi

  if [[ ! -f "${LOAD_TARBALL}" ]]; then
    log_error "找不到 tarball：${LOAD_TARBALL}"
    exit 1
  fi

  # 確認 Docker daemon 執行中
  if ! docker info &>/dev/null; then
    log_error "Docker daemon 未執行，請先啟動 Docker"
    exit 1
  fi

  local size
  size=$(du -h "${LOAD_TARBALL}" | cut -f1)
  log_info "載入 tarball：${LOAD_TARBALL}（${size}）"
  log_info "這可能需要幾分鐘，請耐心等候..."

  docker load < "${LOAD_TARBALL}" 2>&1

  log_ok "所有映像已載入完成"
  echo ""
  log_info "已載入的映像："
  docker images --format "  {{.Repository}}:{{.Tag}}\t{{.Size}}" | grep -E "$(IFS='|'; echo "${ALL_IMAGES[*]}" | sed 's|[./]|\\&|g; s/:.*//g' | tr '|' '|')" 2>/dev/null || docker images --format "  {{.Repository}}:{{.Tag}}\t{{.Size}}"
  echo ""

  # 嘗試尋找對應的 manifest 檔案
  local manifest_file="${LOAD_TARBALL%.tar.gz}.manifest"
  if [[ -f "${manifest_file}" ]]; then
    log_info "找到對應 manifest：${manifest_file}"
    echo ""
    cat "${manifest_file}"
  fi

  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  映像載入完成！可繼續執行部署                                 ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo "  後續操作："
  echo "    1. 確認 .env 已設定：cp .env.example .env && vim .env"
  echo "    2. 啟動服務：docker compose up -d"
  echo "    3. 執行 DB Migration：bash scripts/first-deploy.sh（或手動執行 migrate）"
  echo ""
}

# ── Step 1: 前置條件檢查 ──────────────────────────────────────────────────────

check_prerequisites() {
  log_section "Step 1: 前置條件檢查"

  local missing=0

  # Docker
  if ! command -v docker &>/dev/null; then
    log_error "找不到 'docker'，請先安裝 Docker Engine"
    missing=$((missing + 1))
  else
    log_ok "docker: $(docker --version | head -1)"
  fi

  # Docker daemon
  if ! docker info &>/dev/null; then
    log_error "Docker daemon 未執行，請先啟動 Docker"
    missing=$((missing + 1))
  else
    log_ok "Docker daemon 執行中"
  fi

  # Node.js + npm（建構映像需要）
  if [[ "${SKIP_BUILD}" == "false" ]]; then
    if ! command -v node &>/dev/null; then
      log_error "找不到 'node'，請安裝 Node.js 20+"
      missing=$((missing + 1))
    else
      log_ok "node: $(node --version)"
    fi

    if ! command -v npm &>/dev/null; then
      log_error "找不到 'npm'，請安裝 Node.js 20+"
      missing=$((missing + 1))
    else
      log_ok "npm: $(npm --version)"
    fi
  else
    log_warn "跳過 Node.js 檢查（--skip-build）"
  fi

  # gzip（壓縮需要）
  if ! command -v gzip &>/dev/null; then
    log_error "找不到 'gzip'"
    missing=$((missing + 1))
  else
    log_ok "gzip: $(gzip --version 2>/dev/null | head -1)"
  fi

  # sha256sum / shasum（摘要需要）
  if command -v sha256sum &>/dev/null; then
    SHA256_CMD="sha256sum"
    log_ok "sha256sum: 可用"
  elif command -v shasum &>/dev/null; then
    SHA256_CMD="shasum -a 256"
    log_ok "shasum -a 256: 可用"
  else
    log_error "找不到 sha256sum 或 shasum"
    missing=$((missing + 1))
  fi

  # 磁碟空間檢查（封包通常需要 10–20 GB）
  local avail_gb
  avail_gb=$(df -P "${PROJECT_DIR}" 2>/dev/null \
    | awk 'NR==2 { printf "%.0f", $4 / 1048576 }')
  if [[ -n "${avail_gb}" && ${avail_gb} -lt 20 ]]; then
    log_warn "可用磁碟空間約 ${avail_gb} GB，建議至少 20 GB（映像封包可能較大）"
  else
    log_ok "磁碟可用空間：${avail_gb:-unknown} GB"
  fi

  if [[ ${missing} -gt 0 ]]; then
    log_error "前置條件不滿足，請修正上述問題後重新執行"
    exit 1
  fi

  log_ok "前置條件檢查通過"
}

# ── Step 2: 建構本地映像 ──────────────────────────────────────────────────────

build_local_images() {
  log_section "Step 2: 建構本地 Docker 映像"

  if [[ "${SKIP_BUILD}" == "true" ]]; then
    log_warn "跳過建構（--skip-build），使用現有映像"

    # 確認本地映像存在
    local missing_images=0
    for img in "${LOCAL_IMAGES[@]}"; do
      if docker image inspect "${img}" &>/dev/null; then
        local img_id
        img_id=$(docker image inspect "${img}" --format '{{.Id}}' | head -c 19)
        log_ok "映像存在：${img}（${img_id}…）"
      else
        log_error "找不到映像：${img}。請先建構或移除 --skip-build"
        missing_images=$((missing_images + 1))
      fi
    done

    if [[ ${missing_images} -gt 0 ]]; then
      exit 1
    fi
    return 0
  fi

  cd "${PROJECT_DIR}"

  # 保留舊映像作為回滾備份
  if docker image inspect titan-app:latest &>/dev/null; then
    log_info "標記舊映像為 titan-app:previous..."
    docker tag titan-app:latest titan-app:previous 2>/dev/null || true
  fi

  # 安裝依賴
  log_info "安裝 Node.js 依賴..."
  npm ci --prefer-offline 2>&1 | tail -3

  # Prisma generate
  log_info "產生 Prisma client..."
  npx prisma generate 2>&1

  # Next.js build（產生 .next/standalone）
  log_info "建構 Next.js（standalone 模式）..."
  npm run build 2>&1 | tail -5

  if [[ ! -d ".next/standalone" ]]; then
    log_error "Next.js 建構失敗：找不到 .next/standalone 目錄"
    exit 1
  fi

  # 拍平 standalone 輸出（Next.js 會將 server.js 複製到完整絕對路徑下）
  local standalone_server
  standalone_server=$(find ".next/standalone" -name "server.js" -not -path "*/node_modules/*" | head -1)
  if [[ -n "${standalone_server}" ]] && [[ "${standalone_server}" != ".next/standalone/server.js" ]]; then
    local standalone_src
    standalone_src=$(dirname "${standalone_server}")
    log_info "拍平 standalone 輸出：${standalone_src} → .next/standalone/"
    cp -rn "${standalone_src}/." ".next/standalone/"
    local nested_top
    nested_top=$(echo "${standalone_src#.next/standalone/}" | cut -d/ -f1)
    [[ -n "${nested_top}" ]] && rm -rf ".next/standalone/${nested_top}"
  fi

  # 補充 Linux Prisma binaries 到 standalone
  # Next.js standalone 僅追蹤 host native binary；Linux target binaries 需手動複製
  local prisma_src="node_modules/.prisma/client"
  local prisma_dst=".next/standalone/node_modules/.prisma/client"
  if [[ -d "${prisma_src}" ]] && [[ -d "${prisma_dst}" ]]; then
    log_info "補充 Linux Prisma binaries 到 standalone..."
    for f in "${prisma_src}"/libquery_engine-*.so.node; do
      [[ -f "${f}" ]] && cp -n "${f}" "${prisma_dst}/" && log_info "  已複製 $(basename "${f}")"
    done
  fi

  # 建構 titan-app 映像
  log_info "建構 Docker 映像 titan-app:latest..."
  docker build -t titan-app:latest . 2>&1 | tail -5

  # 建構 titan-migrate 映像（預下載 Linux Prisma binary，供 air-gapped 環境使用）
  log_info "建構 Prisma migration 映像 titan-migrate:latest..."
  docker build -f Dockerfile.migrate -t titan-migrate:latest . 2>&1 | tail -5

  log_ok "本地映像建構完成"
}

# ── Step 3: 拉取第三方映像 ────────────────────────────────────────────────────

pull_third_party_images() {
  log_section "Step 3: 拉取第三方映像"

  local failed=0

  for img in "${THIRD_PARTY_IMAGES[@]}"; do
    log_info "拉取 ${img}..."
    if docker pull "${img}" 2>&1 | tail -3; then
      log_ok "已取得：${img}"
    else
      log_error "拉取失敗：${img}"
      failed=$((failed + 1))
    fi
  done

  if [[ ${failed} -gt 0 ]]; then
    log_error "${failed} 個映像拉取失敗，請確認網路連線後重試"
    exit 1
  fi

  log_ok "所有第三方映像已就緒（共 ${#THIRD_PARTY_IMAGES[@]} 個）"
}

# ── Step 4: 確認所有映像存在 ──────────────────────────────────────────────────

verify_images() {
  log_section "Step 4: 確認映像完整性"

  local missing=0

  for img in "${ALL_IMAGES[@]}"; do
    if docker image inspect "${img}" &>/dev/null; then
      local size
      size=$(docker image inspect "${img}" --format '{{.Size}}' | awk '{ printf "%.1f MB", $1/1048576 }')
      log_ok "  ${img}（${size}）"
    else
      log_error "  找不到映像：${img}"
      missing=$((missing + 1))
    fi
  done

  if [[ ${missing} -gt 0 ]]; then
    log_error "${missing} 個映像缺失，無法繼續封包"
    exit 1
  fi

  log_ok "所有映像確認完成（共 ${#ALL_IMAGES[@]} 個）"
}

# ── Step 5: 匯出映像為 tarball ────────────────────────────────────────────────

export_images() {
  log_section "Step 5: 匯出映像為 tarball"

  mkdir -p "${OUTPUT_DIR}"

  log_info "輸出路徑：${OUTPUT_TARBALL}"
  log_info "映像清單："
  for img in "${ALL_IMAGES[@]}"; do
    echo "    - ${img}"
  done
  echo ""

  log_info "執行 docker save（這可能需要 10–30 分鐘，視映像大小而定）..."

  # 使用 gzip 壓縮輸出，管道方式避免暫存未壓縮的超大 tar
  docker save "${ALL_IMAGES[@]}" | gzip > "${OUTPUT_TARBALL}"

  if [[ ! -f "${OUTPUT_TARBALL}" ]]; then
    log_error "tarball 產生失敗：${OUTPUT_TARBALL}"
    exit 1
  fi

  local size
  size=$(du -h "${OUTPUT_TARBALL}" | cut -f1)
  log_ok "tarball 產生完成：${OUTPUT_TARBALL}（${size}）"
}

# ── Step 6: 產生 manifest ──────────────────────────────────────────────────────

generate_manifest() {
  log_section "Step 6: 產生 manifest 檔案"

  local build_time
  build_time=$(date '+%Y-%m-%d %H:%M:%S %Z')

  local git_ref="unknown"
  if git -C "${PROJECT_DIR}" rev-parse --short HEAD &>/dev/null; then
    git_ref=$(git -C "${PROJECT_DIR}" rev-parse --short HEAD)
  fi

  {
    echo "# TITAN 離線部署封包 manifest"
    echo "# 產生時間：${build_time}"
    echo "# Git Ref：${git_ref}"
    echo "# 封包檔案：$(basename "${OUTPUT_TARBALL}")"
    echo ""
    echo "## 映像清單"
    echo ""
    printf "%-55s %s\n" "IMAGE" "IMAGE_ID"
    printf "%-55s %s\n" "-----" "--------"
    for img in "${ALL_IMAGES[@]}"; do
      local img_id
      img_id=$(docker image inspect "${img}" --format '{{.Id}}' 2>/dev/null | sed 's/sha256://' | head -c 12)
      printf "%-55s %s\n" "${img}" "${img_id}"
    done
    echo ""
    echo "## Tarball SHA256"
    echo ""
    ${SHA256_CMD} "${OUTPUT_TARBALL}" | awk '{ print $1 }' | xargs -I{} echo "sha256:{}"
    echo ""
    echo "## 使用方式（目標機器）"
    echo ""
    echo "  # 1. 將 tarball 與 manifest 複製至目標機器"
    echo "  scp $(basename "${OUTPUT_TARBALL}") $(basename "${OUTPUT_MANIFEST}") user@target-host:/path/to/titan/"
    echo ""
    echo "  # 2. 載入映像"
    echo "  bash scripts/package-offline.sh --load $(basename "${OUTPUT_TARBALL}")"
    echo "  # 或直接："
    echo "  docker load < $(basename "${OUTPUT_TARBALL}")"
    echo ""
    echo "  # 3. 部署"
    echo "  cp .env.example .env && vim .env   # 填寫密鑰"
    echo "  docker compose up -d"
    echo "  bash scripts/first-deploy.sh       # DB migration + seed"
  } > "${OUTPUT_MANIFEST}"

  log_ok "manifest 已寫入：${OUTPUT_MANIFEST}"

  # 顯示 SHA256
  log_info "tarball SHA256："
  ${SHA256_CMD} "${OUTPUT_TARBALL}"
}

# ── 完成摘要 ──────────────────────────────────────────────────────────────────

print_summary() {
  local tarball_size
  tarball_size=$(du -h "${OUTPUT_TARBALL}" | cut -f1)

  local tarball_sha256
  tarball_sha256=$(${SHA256_CMD} "${OUTPUT_TARBALL}" | awk '{ print $1 }')

  echo ""
  echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
  echo -e "${GREEN}║  TITAN 離線封包完成！                                         ║${NC}"
  echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
  echo ""
  echo "  封包資訊："
  echo "    tarball：  ${OUTPUT_TARBALL}"
  echo "    manifest： ${OUTPUT_MANIFEST}"
  echo "    大小：     ${tarball_size}"
  echo "    SHA256：   ${tarball_sha256}"
  echo "    映像數量： ${#ALL_IMAGES[@]} 個"
  echo ""
  echo -e "  ${CYAN}目標機器使用方式：${NC}"
  echo ""
  echo "    # 步驟 1：傳輸封包"
  echo "    scp dist/$(basename "${OUTPUT_TARBALL}") dist/$(basename "${OUTPUT_MANIFEST}") \\"
  echo "        user@target-host:/opt/titan/"
  echo ""
  echo "    # 步驟 2：載入映像（在目標機器執行）"
  echo "    cd /opt/titan"
  echo "    bash scripts/package-offline.sh --load $(basename "${OUTPUT_TARBALL}")"
  echo ""
  echo "    # 步驟 3：部署"
  echo "    cp .env.example .env"
  echo "    # 編輯 .env 填入必要密鑰"
  echo "    docker compose up -d"
  echo ""
  echo -e "  ${YELLOW}注意事項：${NC}"
  echo "    - 傳輸前請驗證 SHA256 確保封包完整性"
  echo "    - manifest 記錄了所有映像版本，可用於稽核"
  echo "    - 目標機器需安裝 Docker Engine（無需網路連線）"
  echo ""
}

# ── 主流程 ────────────────────────────────────────────────────────────────────

main() {
  echo ""
  echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
  echo -e "${CYAN}  TITAN 平台 — 離線部署封包腳本${NC}"
  echo -e "${CYAN}════════════════════════════════════════════════════════════${NC}"
  echo ""

  # --load 模式直接執行載入後退出
  if [[ "${LOAD_MODE}" == "true" ]]; then
    if ! docker info &>/dev/null; then
      log_error "Docker daemon 未執行，請先啟動 Docker"
      exit 1
    fi
    load_images
    exit 0
  fi

  check_prerequisites
  build_local_images
  pull_third_party_images
  verify_images
  export_images
  generate_manifest
  print_summary

  log_ok "離線封包流程完成！"
}

main "$@"
