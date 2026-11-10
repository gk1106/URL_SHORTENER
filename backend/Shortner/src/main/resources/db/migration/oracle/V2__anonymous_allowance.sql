CREATE TABLE anonymous_visitors (
  token_hash varchar2(64) PRIMARY KEY,
  used_count number(10) DEFAULT 0 NOT NULL,
  CONSTRAINT ck_guest_allowance CHECK (used_count BETWEEN 0 AND 30)
);
