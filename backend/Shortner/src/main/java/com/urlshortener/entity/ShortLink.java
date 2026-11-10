package com.urlshortener.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import jakarta.persistence.Version;
import java.time.Instant;
import java.util.UUID;

@Entity
@org.hibernate.annotations.DynamicUpdate
@Table(
    name = "short_links",
    uniqueConstraints = @UniqueConstraint(name = "uk_short_links_code", columnNames = "code"))
public class ShortLink {
  @Id
  @Column(length = 36)
  private String id;

  @Column(nullable = false, length = 32, updatable = false)
  private String code;

  @Column(name = "destination_url", nullable = false, length = 2048)
  private String destinationUrl;

  @Column(name = "owner_id", nullable = false, length = 255, updatable = false)
  private String ownerId;

  @Column(name = "created_at", nullable = false, updatable = false)
  private Instant createdAt;

  @Column(name = "updated_at", nullable = false)
  private Instant updatedAt;

  @Column(name = "expires_at")
  private Instant expiresAt;

  @Column(nullable = false)
  private boolean active;

  @Column(name = "click_count", nullable = false)
  private long clickCount;

  @Version private long version;

  protected ShortLink() {}

  public ShortLink(
      String code, String destinationUrl, String ownerId, Instant expiresAt, Instant now) {
    this.id = UUID.randomUUID().toString();
    this.code = code;
    this.destinationUrl = destinationUrl;
    this.ownerId = ownerId;
    this.expiresAt = expiresAt;
    this.createdAt = now;
    this.updatedAt = now;
    this.active = true;
  }

  public void update(Boolean active, Instant expiresAt, Instant now) {
    if (active != null) this.active = active;
    if (expiresAt != null) this.expiresAt = expiresAt;
    this.updatedAt = now;
  }

  public String getId() {
    return id;
  }

  public String getCode() {
    return code;
  }

  public String getDestinationUrl() {
    return destinationUrl;
  }

  public String getOwnerId() {
    return ownerId;
  }

  public Instant getCreatedAt() {
    return createdAt;
  }

  public Instant getUpdatedAt() {
    return updatedAt;
  }

  public Instant getExpiresAt() {
    return expiresAt;
  }

  public boolean isActive() {
    return active;
  }

  public long getClickCount() {
    return clickCount;
  }
}
