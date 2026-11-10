package com.urlshortener.security;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.Test;
import org.springframework.data.redis.RedisConnectionFailureException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

class RateLimitFilterTest {
  @Test
  void permitsWithinQuota() throws Exception {
    var redis = mock(StringRedisTemplate.class);
    doReturn(1L).when(redis).execute(any(RedisScript.class), anyList());
    var chain = mock(FilterChain.class);
    var response = new MockHttpServletResponse();
    var request = new MockHttpServletRequest("GET", "/r/example");
    new RateLimitFilter(redis, true, 60, 300).doFilter(request, response, chain);
    verify(chain).doFilter(request, response);
  }

  @Test
  void rejectsAboveQuota() throws Exception {
    var redis = mock(StringRedisTemplate.class);
    doReturn(301L).when(redis).execute(any(RedisScript.class), anyList());
    var chain = mock(FilterChain.class);
    var response = new MockHttpServletResponse();
    new RateLimitFilter(redis, true, 60, 300)
        .doFilter(new MockHttpServletRequest("GET", "/r/example"), response, chain);
    assertThat(response.getStatus()).isEqualTo(429);
    assertThat(response.getHeader("Retry-After")).isEqualTo("60");
    verifyNoInteractions(chain);
  }

  @Test
  void redisOutageFailsClosed() throws Exception {
    var redis = mock(StringRedisTemplate.class);
    doThrow(new RedisConnectionFailureException("offline"))
        .when(redis)
        .execute(any(RedisScript.class), anyList());
    var chain = mock(FilterChain.class);
    var response = new MockHttpServletResponse();
    new RateLimitFilter(redis, true, 60, 300)
        .doFilter(new MockHttpServletRequest("GET", "/api/v1/urls"), response, chain);
    assertThat(response.getStatus()).isEqualTo(503);
    verifyNoInteractions(chain);
  }
}
