-- ═══════════════════════════════════════════════════════════
-- PostgreSQL 初始化腳本
-- 任務: T09 — 資料庫與儲存規劃
-- 用途：建立共用資料庫使用者、擴展、功能
-- ═══════════════════════════════════════════════════════════

-- 建立 Outline 專用資料庫（與 TITAN App 的 titan DB 分離）
SELECT 'CREATE DATABASE outline'
  WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'outline')\gexec

-- 建立應用程式專用使用者（非超級使用者）
-- 注意：實際建立使用者時，請確保使用強密碼
DO $$
BEGIN
    -- 檢查是否已存在應用程式使用者
    IF NOT EXISTS (
        SELECT FROM pg_catalog.pg_roles
        WHERE  rolname = '${POSTGRES_APP_USER:-titan_app}'
    ) THEN
        CREATE ROLE ${POSTGRES_APP_USER:-titan_app} WITH LOGIN PASSWORD '${POSTGRES_APP_PASSWORD:-}';
        GRANT CONNECT ON DATABASE ${POSTGRES_DB:-titan} TO ${POSTGRES_APP_USER:-titan_app};
        GRANT USAGE ON SCHEMA public TO ${POSTGRES_APP_USER:-titan_app};
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ${POSTGRES_APP_USER:-titan_app};
        ALTER ROLE ${POSTGRES_APP_USER:-titan_app} SET search_path TO public;
        RAISE NOTICE 'Created user: titan_app';
    ELSE
        RAISE NOTICE 'User titan_app already exists';
    END IF;
END
$$;

-- 啟用必要的 PostgreSQL 擴展（視需求啟用）
-- 範例：啟用 UUID 產生器
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 範例：啟用 pg_trgm（全文檢索支援）
-- CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 預設表格結構（預留給未來服務使用）
-- CREATE TABLE IF NOT EXISTS public.service_registry (
--     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
--     service_name VARCHAR(100) NOT NULL UNIQUE,
--     service_type VARCHAR(50) NOT NULL,
--     endpoint VARCHAR(255),
--     status VARCHAR(20) DEFAULT 'active',
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- 建立通用序列（供未來 ID 使用）
-- CREATE SEQUENCE IF NOT EXISTS public.global_id_seq;

-- 記錄初始化完成
DO $$
BEGIN
    RAISE NOTICE 'PostgreSQL initialization completed at %', NOW();
END
$$;
