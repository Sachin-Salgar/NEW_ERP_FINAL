# Appendix: Standard SQL Templates

## B.2 Master Table Template
```sql
CREATE TABLE module_name.entity_name (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    is_deleted BOOLEAN DEFAULT FALSE,
    version_number INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT now(),
    created_by UUID,
    updated_at TIMESTAMPTZ,
    updated_by UUID,
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    
    CONSTRAINT uk_entity_code UNIQUE (tenant_id, code) WHERE is_deleted = FALSE
);
```

## B.3 Transaction Header Template
```sql
CREATE TABLE module_name.transaction_header (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
    tenant_id UUID NOT NULL,
    organization_id UUID NOT NULL,
    branch_id UUID NOT NULL,
    financial_year_id UUID NOT NULL,
    document_number VARCHAR(50) NOT NULL,
    document_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL, -- Draft, Posted, etc.
    version_number INTEGER DEFAULT 1,
    -- Audit columns ...
    
    CONSTRAINT uk_transaction_doc_no UNIQUE (tenant_id, organization_id, document_number)
);
```
