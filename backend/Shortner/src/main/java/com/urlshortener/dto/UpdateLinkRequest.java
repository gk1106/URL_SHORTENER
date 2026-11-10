package com.urlshortener.dto;

import jakarta.validation.constraints.Future;
import java.time.Instant;

public record UpdateLinkRequest(Boolean active, @Future Instant expiresAt) {}
