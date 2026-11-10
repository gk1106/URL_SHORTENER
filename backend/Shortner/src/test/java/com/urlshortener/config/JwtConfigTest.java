package com.urlshortener.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.security.oauth2.jwt.Jwt;

class JwtConfigTest {
  @Test
  void requiresAudienceSubjectAndExpiry() {
    for (String subject : List.of("alice", "", "x".repeat(256))) {
      var jwt =
          Jwt.withTokenValue("token")
              .header("alg", "RS256")
              .subject(subject)
              .audience(List.of("shortener-api"))
              .expiresAt(Instant.now().plusSeconds(60))
              .build();
      assertThat(JwtConfig.claimsValidator("shortener-api").validate(jwt).hasErrors())
          .isEqualTo(!subject.equals("alice"));
    }
    var wrongAudience =
        Jwt.withTokenValue("token")
            .header("alg", "RS256")
            .subject("alice")
            .audience(List.of("another-api"))
            .expiresAt(Instant.now().plusSeconds(60))
            .build();
    assertThat(JwtConfig.claimsValidator("shortener-api").validate(wrongAudience).hasErrors())
        .isTrue();
    var noExpiry =
        Jwt.withTokenValue("token")
            .header("alg", "RS256")
            .subject("alice")
            .audience(List.of("shortener-api"))
            .build();
    assertThat(JwtConfig.claimsValidator("shortener-api").validate(noExpiry).hasErrors()).isTrue();
    var noAudience =
        Jwt.withTokenValue("token")
            .header("alg", "RS256")
            .subject("alice")
            .expiresAt(Instant.now().plusSeconds(60))
            .build();
    assertThat(JwtConfig.claimsValidator("shortener-api").validate(noAudience).hasErrors())
        .isTrue();
  }
}
