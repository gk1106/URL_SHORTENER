package com.urlshortener.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "anonymous_visitors")
public class AnonymousVisitor {
  @Id @Column(name = "token_hash", length = 64) private String tokenHash;
  @Column(name = "used_count", nullable = false) private int usedCount;
  protected AnonymousVisitor() {}
  public AnonymousVisitor(String tokenHash) { this.tokenHash = tokenHash; }
  public int getUsedCount() { return usedCount; }
  public void consume() { usedCount++; }
}
