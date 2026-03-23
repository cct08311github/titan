# T07: 容器平台建置

## 概述
本任務完成 Titan 專案的 Docker Compose 基礎設施建置。

## 已完成
- [x] PostgreSQL 15 配置（資料持久化）
- [x] Redis 7 配置（附 healthcheck）
- [x] 私有 Registry 匯入策略文件
- [x] 環境變數範本 (.env.example)

## 使用方式

### 1. 複製環境變數範本
```bash
cp .env.example .env
# 編輯 .env 填入實際值
```

### 2. 啟動服務
```bash
docker-compose up -d
```

### 3. 驗證服務狀態
```bash
docker-compose ps
docker-compose logs -f
```

### 4. 停止服務
```bash
docker-compose down
```

## 私有 Registry 策略

### 使用外部私有 Registry（如 Harbor）
1. 登入 Registry：
   ```bash
   echo "$HARBOR_PASSWORD" | docker login harbor.titan.internal --username="$HARBOR_USER" --password-stdin
   ```
2. 在 docker-compose.override.yml 中覆寫 image：
   ```yaml
   services:
     app:
       image: harbor.titan.internal/myapp:latest
   ```

### 本地 Registry（可選）
若需建立本地私有 Registry：
```bash
docker run -d -p 5000:5000 --name registry -v registry-data:/var/lib/registry registry:2
```

## 依賴
- T06: 需先完成基礎設施規劃

## 維運
- 資料 volume 預設掛載至 Docker 無名 volume
- 生產環境建議使用具名 volume 或 bind mount
