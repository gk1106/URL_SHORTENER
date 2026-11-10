package com.urlshortener.dto;

import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.Instant;

public record CreateLinkRequest(
    @NotBlank @Size(max = 2048) String longUrl,
    @Pattern(regexp = "[A-Za-z0-9_-]{4,32}") String alias,
    @Future Instant expiresAt) {}
