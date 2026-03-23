#!/bin/bash
set -e

echo "🚀 銀行 IT 團隊協作平台 - 一鍵部署腳本"
echo "========================================"

# 檢查 Docker
if ! command -v docker &> /dev/null; then
    echo "❌ 錯誤：請先安裝 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ 錯誤：請先安裝 docker-compose"
    exit 1
fi

# 建立必要目錄
echo "📁 建立資料目錄..."
mkdir -p nginx/ssl nginx/conf.d homepage/config plane/uploads outline/data outline/uploads gitea/data gitea/repos nodered/data postgres/data redis/data

# 複製環境範例檔案
if [ ! -f .env ]; then
    echo "📝 建立環境變數檔案..."
    cp .env.example .env
fi

# 啟動服務
echo "▶️ 啟動所有服務..."
docker-compose up -d

# 等待服務就緒
echo "⏳ 等待服務就緒..."
sleep 30

# 顯示狀態
echo ""
echo "✅ 部署完成！服務狀態："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
docker-compose ps

echo ""
echo "📌 訪問入口："
echo "   - 統一入口：http://localhost"
echo "   - 任務管理：http://localhost/plane"
echo "   - 知識庫：http://localhost/wiki"
echo "   - 程式碼：http://localhost/code"
echo "   - 自動化：http://localhost:1880"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "💡 下一步：請編輯 .env 檔案設定 SECRET_KEY 等安全參數"