package com.urlshortener.cache;

import java.time.Duration;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class RedirectCache {
  private static final Logger log = LoggerFactory.getLogger(RedirectCache.class);
  private final StringRedisTemplate redis;
  private final boolean enabled;

  public RedirectCache(
      StringRedisTemplate redis, @Value("${app.cache.enabled:true}") boolean enabled) {
    this.redis = redis;
    this.enabled = enabled;
  }

  // Cache only code -> ID. Always check authoritative state so disabling/expiration is immediate.
  public String get(String code) {
    if (!enabled) return null;
    try {
      return redis.opsForValue().get("shortener:redirect:" + code);
    } catch (org.springframework.dao.DataAccessException ex) {
      log.warn("Redirect cache unavailable");
      return null;
    }
  }

  public void put(String code, String id) {
    if (!enabled) return;
    try {
      redis.opsForValue().set("shortener:redirect:" + code, id, Duration.ofMinutes(5));
    } catch (org.springframework.dao.DataAccessException ex) {
      log.warn("Redirect cache unavailable");
    }
  }
}
