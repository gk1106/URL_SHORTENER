package com.urlshortener.security;

import com.urlshortener.exception.ProblemResponses;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

public class RateLimitFilter extends OncePerRequestFilter {
  private static final DefaultRedisScript<Long> SCRIPT =
      new DefaultRedisScript<>(
          "local n = redis.call('INCR', KEYS[1]); if n == 1 then redis.call('EXPIRE', KEYS[1], 60)"
              + " end; return n",
          Long.class);
  private final StringRedisTemplate redis;
  private final boolean enabled;
  private final int apiLimit;
  private final int redirectLimit;

  public RateLimitFilter(
      StringRedisTemplate redis, boolean enabled, int apiLimit, int redirectLimit) {
    this.redis = redis;
    this.enabled = enabled;
    this.apiLimit = apiLimit;
    this.redirectLimit = redirectLimit;
  }

  @Override
  protected boolean shouldNotFilter(HttpServletRequest request) {
    return !enabled
        || !(request.getRequestURI().startsWith("/api/")
            || request.getRequestURI().startsWith("/r/"));
  }

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    boolean api = request.getRequestURI().startsWith("/api/");
    var auth = SecurityContextHolder.getContext().getAuthentication();
    String identity = api && auth != null ? auth.getName() : request.getRemoteAddr();
    String key = "shortener:rate:" + (api ? "api:" : "redirect:") + hash(identity);
    try {
      Long count = redis.execute(SCRIPT, List.of(key));
      if (count == null) throw new IllegalStateException("Rate limit unavailable");
      if (count > (api ? apiLimit : redirectLimit)) {
        response.setHeader("Retry-After", "60");
        ProblemResponses.write(
            response, request, HttpStatus.TOO_MANY_REQUESTS, "Rate limit exceeded");
        return;
      }
    } catch (org.springframework.dao.DataAccessException | IllegalStateException ex) {
      // Fail closed: cache outages must not silently disable abuse protection.
      ProblemResponses.write(
          response,
          request,
          HttpStatus.SERVICE_UNAVAILABLE,
          "Rate limiting is temporarily unavailable");
      return;
    }
    chain.doFilter(request, response);
  }

  private String hash(String value) {
    try {
      return HexFormat.of()
          .formatHex(
              MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException ex) {
      throw new IllegalStateException(ex);
    }
  }
}
