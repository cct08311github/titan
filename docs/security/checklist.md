# 安全強化檢查清單

> **任務編號**: T06  
> **創建日期**: 2026-03-23  

---

## 每日檢查

- [ ] 容器健康狀態檢查：`docker ps --format "table {{.Names}}\t{{.Status}}"`
- [ ] 資源使用監控：CPU/Memory 不超過 80%
- [ ] 日誌錯誤檢查：`docker compose logs --tail=50 --since=15m`

## 每週檢查

- [ ] 安全更新檢查：`apt list --upgradable`
- [ ] 容器映像漏洞掃描（使用 Trivy）
- [ ] 磁碟空間檢查：`df -h`
- [ ] 備份完整性驗證

## 每月檢查

- [ ] OS 基線合規性審查
- [ ] 存取日誌審計
- [ ] 密碼更換（服務帳戶）
- [ ] 效能趨勢分析

## 季度檢查

- [ ] 滲透測試
- [ ] 災難復原演練
- [ ] 資安政策審視
- [ ] 合規性報告

---

## 緊急應變流程

1. **隔離受影響容器**: `docker compose stop <service>`
2. **保存日誌**: `docker compose logs > incident-$(date +%Y%m%d).log`
3. **分析根本原因**
4. **修補後重新部署**
5. **事件回顧報告**