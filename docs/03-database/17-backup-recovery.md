# 17. Backup & Disaster Recovery

## 22.3 Recovery Objectives (SLOs)
| Tier | RPO (Data Loss) | RTO (Downtime) |
| :--- | :--- | :--- |
| **Critical DB** | 5 Minutes | 1 Hour |
| **Non-Prod** | 24 Hours | 8 Hours |

## 22.4 Backup Strategy
1. **Continuous**: WAL (Write-Ahead Log) archiving for Point-in-Time Recovery (PITR).
2. **Daily**: Full snapshots stored in geo-redundant storage.
3. **Immutability**: Backups stored in WORM (Write-Once-Read-Many) storage to protect against ransomware.

## 22.8 Restoration Drills
Monthly restoration tests to verify backup integrity. A backup that hasn't been tested for restoration is not a backup.

## 22.10 Disaster Recovery
Hot-standby replicas in a secondary region with automated failover for critical production environments.
