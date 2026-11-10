CREATE TABLE anonymous_visitors (
  token_hash varchar(64) PRIMARY KEY,
  used_count integer DEFAULT 0 NOT NULL,
  CONSTRAINT ck_guest_allowance CHECK (used_count BETWEEN 0 AND 30)
);
