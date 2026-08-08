# 16. Security Architecture

## 23.3 Defense in Depth
Security is enforced at multiple layers: Network -> IAM -> App Logic -> Database RLS.

## 23.7 Encryption
- **In Transit**: Mandatory TLS 1.3 for all database connections.
- **At Rest**: Storage-level encryption (TDE or Cloud Provider encryption).
- **Sensitive Fields**: Application-level encryption for PII, API Keys, or Credentials.

## 23.9 Password Policy
Passwords must **never** be stored in the database. Use `argon2id` or `bcrypt` hashes.

## 23.10 SQL Injection
- Mandatory use of Parameterized Queries (via Drizzle ORM).
- Direct string concatenation in SQL is strictly prohibited.

## 23.13 Administrative Access
- Production DB access requires **Break-glass** protocols.
- No shared accounts.
- Audit logging enabled for all `SUPERUSER` actions.
