package com.urlshortener.integration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.head;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.urlshortener.dto.CreateLinkRequest;
import com.urlshortener.entity.ShortLink;
import com.urlshortener.exception.ApiException;
import com.urlshortener.repository.LinkRepository;
import com.urlshortener.service.LinkService;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.Callable;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("dev")
class LinkIntegrationTest {
  @Autowired MockMvc mvc;
  @Autowired LinkService service;
  @Autowired LinkRepository repository;
  @Autowired org.springframework.transaction.PlatformTransactionManager transactions;
  @MockitoBean JwtDecoder decoder;

  @Test
  void guestAllowanceIsAtomicAndClaimedByAccount() throws Exception {
    var session = mvc.perform(get("/api/v1/guest/session")).andExpect(status().isOk())
        .andExpect(jsonPath("$.remaining").value(30)).andReturn();
    String token = session.getResponse().getHeader("Set-Cookie").split(";", 2)[0].split("=", 2)[1];
    var cookie = new jakarta.servlet.http.Cookie("gkgo_visitor", token);
    mvc.perform(post("/api/v1/urls").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
        .content("{\"longUrl\":\"invalid\"}")).andExpect(status().isBadRequest());
    var pool = Executors.newFixedThreadPool(8);
    try {
      List<Callable<Integer>> calls = new ArrayList<>();
      for (int i = 0; i < 36; i++) calls.add(() -> mvc.perform(post("/api/v1/urls").cookie(cookie)
          .contentType(MediaType.APPLICATION_JSON).content("{\"longUrl\":\"https://example.com/guest\"}"))
          .andReturn().getResponse().getStatus());
      var results = pool.invokeAll(calls);
      long created = 0, denied = 0;
      for (var result : results) { int code = result.get(); if (code == 201) created++; else if (code == 401) denied++; }
      assertThat(created).isEqualTo(30); assertThat(denied).isEqualTo(6);
    } finally { pool.shutdownNow(); }
    mvc.perform(get("/api/v1/guest/session").cookie(cookie)).andExpect(jsonPath("$.remaining").value(0));
    mvc.perform(post("/api/v1/urls").cookie(cookie).contentType(MediaType.APPLICATION_JSON)
        .content("{\"longUrl\":\"https://example.com\"}")).andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.code").value("GUEST_LIMIT_REACHED"));
    mvc.perform(get("/api/v1/urls").cookie(cookie)).andExpect(status().isUnauthorized());
    mvc.perform(post("/api/v1/guest/claim").cookie(cookie).with(jwt().jwt(j -> j.subject("guest-claim-test"))))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/v1/urls").with(jwt().jwt(j -> j.subject("guest-claim-test"))))
        .andExpect(jsonPath("$.totalElements").value(30));
    mvc.perform(get("/api/v1/guest/links").cookie(cookie)).andExpect(jsonPath("$.totalElements").value(0));
    mvc.perform(post("/api/v1/urls").cookie(cookie).with(jwt().jwt(j -> j.subject("guest-claim-test")))
        .contentType(MediaType.APPLICATION_JSON).content("{\"longUrl\":\"https://example.com/account\"}"))
        .andExpect(status().isCreated());
  }

  @Test
  void createsPersistsAndRedirects() throws Exception {
    mvc.perform(
            post("/api/v1/urls")
                .with(jwt().jwt(j -> j.subject("alice")))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"longUrl\":\"https://example.com/a?q=1\",\"alias\":\"demo-link\"}"))
        .andExpect(status().isCreated())
        .andExpect(header().exists("Location"))
        .andExpect(jsonPath("$.shortUrl").value("http://localhost:8080/r/demo-link"));
    mvc.perform(get("/r/demo-link"))
        .andExpect(status().isFound())
        .andExpect(header().string("Location", "https://example.com/a?q=1"))
        .andExpect(header().string("Cache-Control", "no-store"));
    assertThat(repository.findByCode("demo-link")).isPresent();
  }

  @Test
  void managementRequiresAuthentication() throws Exception {
    mvc.perform(
            post("/api/v1/urls")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"longUrl\":\"https://example.com\"}"))
        .andExpect(status().isUnauthorized())
        .andExpect(content().contentTypeCompatibleWith("application/problem+json"))
        .andExpect(header().exists("X-Request-ID"));
  }

  @Test
  void ownerIsolation() throws Exception {
    var link = service.create(new CreateLinkRequest("https://example.com", null, null), "alice");
    for (String suffix : List.of("", "/stats")) {
      mvc.perform(get("/api/v1/urls/" + link.id() + suffix).with(jwt().jwt(j -> j.subject("bob"))))
          .andExpect(status().isNotFound());
    }
    mvc.perform(
            patch("/api/v1/urls/" + link.id())
                .with(jwt().jwt(j -> j.subject("bob")))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
        .andExpect(status().isNotFound());
    mvc.perform(get("/api/v1/urls").with(jwt().jwt(j -> j.subject("bob"))))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totalElements").value(0));
  }

  @Test
  void aliasConflictReturns409() throws Exception {
    service.create(new CreateLinkRequest("https://example.com", "taken-alias", null), "alice");
    mvc.perform(
            post("/api/v1/urls")
                .with(jwt().jwt(j -> j.subject("alice")))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"longUrl\":\"https://example.org\",\"alias\":\"taken-alias\"}"))
        .andExpect(status().isConflict());
  }

  @Test
  void disabledAndExpiredLinksReturn410() throws Exception {
    var link = service.create(new CreateLinkRequest("https://example.com", null, null), "alice");
    mvc.perform(
            patch("/api/v1/urls/" + link.id())
                .with(jwt().jwt(j -> j.subject("alice")))
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"active\":false}"))
        .andExpect(status().isOk());
    mvc.perform(get("/r/" + link.code())).andExpect(status().isGone());
    ShortLink expired =
        repository.saveAndFlush(
            new ShortLink(
                "expired-test",
                "https://example.com",
                "alice",
                Instant.now().minusSeconds(1),
                Instant.now().minusSeconds(60)));
    mvc.perform(get("/r/" + expired.getCode())).andExpect(status().isGone());
  }

  @Test
  void invalidInputsReturn400() throws Exception {
    for (String body :
        List.of(
            "{}",
            "{\"longUrl\":\"javascript:alert(1)\"}",
            "{\"longUrl\":\"https://user:pass@example.com\"}",
            "{\"longUrl\":\"https://example.com\",\"alias\":\"a b c\"}",
            "{\"longUrl\":\"https://example.com\",\"alias\":\"admin\"}",
            "{\"longUrl\":\"https://example.com\",\"expiresAt\":\"2020-01-01T00:00:00Z\"}",
            "{broken")) {
      mvc.perform(
              post("/api/v1/urls")
                  .with(jwt().jwt(j -> j.subject("alice")))
                  .contentType(MediaType.APPLICATION_JSON)
                  .content(body))
          .andExpect(status().isBadRequest())
          .andExpect(content().contentTypeCompatibleWith("application/problem+json"));
    }
    mvc.perform(get("/api/v1/urls?size=101").with(jwt())).andExpect(status().isBadRequest());
  }

  @Test
  void unknownCodeReturns404() throws Exception {
    mvc.perform(get("/r/unknown-code")).andExpect(status().isNotFound());
  }

  @Test
  void oversizedBodyReturns413() throws Exception {
    mvc.perform(
            post("/api/v1/urls")
                .with(jwt())
                .contentType(MediaType.APPLICATION_JSON)
                .content("x".repeat(17000)))
        .andExpect(status().isContentTooLarge());
  }

  @Test
  void editsDoNotOverwriteConcurrentClickCounts() throws Exception {
    var link = service.create(new CreateLinkRequest("https://example.com", null, null), "alice");
    var tx = new org.springframework.transaction.support.TransactionTemplate(transactions);
    tx.executeWithoutResult(
        status -> {
          var stale = repository.findById(link.id()).orElseThrow();
          var independent =
              new org.springframework.transaction.support.TransactionTemplate(transactions);
          independent.setPropagationBehavior(
              org.springframework.transaction.TransactionDefinition.PROPAGATION_REQUIRES_NEW);
          independent.executeWithoutResult(s -> repository.incrementClicks(link.id()));
          stale.update(false, null, Instant.now());
        });
    assertThat(service.stats(link.id(), "alice").clickCount()).isEqualTo(1);
  }

  @Test
  void headDoesNotCountAsClick() throws Exception {
    var link = service.create(new CreateLinkRequest("https://example.com", null, null), "alice");
    mvc.perform(head("/r/" + link.code())).andExpect(status().isFound());
    assertThat(service.stats(link.id(), "alice").clickCount()).isZero();
  }

  @Test
  void metricsRequireSpecificScope() throws Exception {
    mvc.perform(get("/actuator/metrics").with(jwt())).andExpect(status().isForbidden());
    mvc.perform(
            get("/actuator/metrics")
                .with(
                    jwt()
                        .authorities(
                            new org.springframework.security.core.authority.SimpleGrantedAuthority(
                                "SCOPE_metrics.read"))))
        .andExpect(status().isOk());
  }

  @Test
  void invalidBearerTokenReturns401() throws Exception {
    org.mockito.Mockito.when(decoder.decode("invalid-token"))
        .thenThrow(new org.springframework.security.oauth2.jwt.BadJwtException("Invalid token"));
    mvc.perform(get("/api/v1/urls").header("Authorization", "Bearer invalid-token"))
        .andExpect(status().isUnauthorized())
        .andExpect(jsonPath("$.status").value(401));
  }

  @Test
  void concurrentClicksDoNotLoseIncrements() throws Exception {
    var link =
        service.create(new CreateLinkRequest("https://example.com", null, null), "counter-owner");
    ExecutorService executor = Executors.newFixedThreadPool(6);
    try {
      List<Callable<String>> tasks = new ArrayList<>();
      for (int i = 0; i < 30; i++) tasks.add(() -> service.resolve(link.code()));
      for (Future<String> result : executor.invokeAll(tasks))
        assertThat(result.get()).isEqualTo("https://example.com");
      long deadline = System.nanoTime() + TimeUnit.SECONDS.toNanos(10);
      while (service.stats(link.id(), "counter-owner").clickCount() != 30
          && System.nanoTime() < deadline) Thread.sleep(20);
      assertThat(service.stats(link.id(), "counter-owner").clickCount()).isEqualTo(30);
    } finally {
      executor.shutdownNow();
    }
  }

  @Test
  void concurrentAliasClaimsHaveSingleWinner() throws Exception {
    ExecutorService executor = Executors.newFixedThreadPool(4);
    try {
      List<Callable<Boolean>> tasks = new ArrayList<>();
      for (int i = 0; i < 4; i++)
        tasks.add(
            () -> {
              try {
                service.create(
                    new CreateLinkRequest("https://example.com", "race-alias", null), "alice");
                return true;
              } catch (ApiException ex) {
                assertThat(ex.status().value()).isEqualTo(409);
                return false;
              }
            });
      int wins = 0;
      for (var result : executor.invokeAll(tasks)) if (result.get()) wins++;
      assertThat(wins).isEqualTo(1);
    } finally {
      executor.shutdownNow();
    }
  }
}
