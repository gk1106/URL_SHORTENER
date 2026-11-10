package com.urlshortener.dto;

import java.time.Instant;

public record LinkResponse(
    String id,
    String code,
    String shortUrl,
    String longUrl,
    boolean active,
    Instant expiresAt,
    Instant createdAt,
    Instant updatedAt) {}
