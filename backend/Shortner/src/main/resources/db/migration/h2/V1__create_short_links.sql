CREATE TABLE short_links (
    id VARCHAR(36) PRIMARY KEY,
    code VARCHAR(32) NOT NULL,
    destination_url VARCHAR(2048) NOT NULL,
    owner_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    updated_at TIMESTAMP(6) WITH TIME ZONE NOT NULL,
    expires_at TIMESTAMP(6) WITH TIME ZONE,
    active BOOLEAN NOT NULL,
    click_count BIGINT DEFAULT 0 NOT NULL,
    version BIGINT DEFAULT 0 NOT NULL,
    CONSTRAINT uk_short_links_code UNIQUE (code)
);
CREATE INDEX ix_short_links_owner_created ON short_links(owner_id, created_at);
CREATE INDEX ix_short_links_expiry ON short_links(expires_at);
