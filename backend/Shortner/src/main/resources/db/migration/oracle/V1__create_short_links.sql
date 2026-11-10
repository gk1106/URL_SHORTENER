CREATE TABLE short_links (
    id VARCHAR2(36 CHAR) PRIMARY KEY,
    code VARCHAR2(32 CHAR) NOT NULL,
    destination_url VARCHAR2(2048 CHAR) NOT NULL,
    owner_id VARCHAR2(255 CHAR) NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP(6) WITH TIME ZONE,
    active NUMBER(1,0) NOT NULL,
    click_count NUMBER(19,0) DEFAULT 0 NOT NULL,
    version NUMBER(19,0) DEFAULT 0 NOT NULL,
    CONSTRAINT uk_short_links_code UNIQUE (code),
    CONSTRAINT ck_short_links_active CHECK (active IN (0,1))
);
CREATE INDEX ix_short_links_owner_created ON short_links(owner_id, created_at);
CREATE INDEX ix_short_links_expiry ON short_links(expires_at);
