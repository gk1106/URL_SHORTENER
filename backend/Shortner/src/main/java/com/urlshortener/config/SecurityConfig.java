package com.urlshortener.config;

import com.urlshortener.exception.ProblemResponses;
import com.urlshortener.security.RateLimitFilter;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

@Configuration
public class SecurityConfig {
  @Bean
  SecurityFilterChain securityFilterChain(
      HttpSecurity http,
      StringRedisTemplate redis,
      @Value("${app.rate-limit.enabled:true}") boolean rateLimit,
      @Value("${app.rate-limit.api-per-minute:60}") int apiLimit,
      @Value("${app.rate-limit.redirect-per-minute:300}") int redirectLimit)
      throws Exception {
    return http
        // Only Authorization bearer tokens are accepted; no cookie authentication.
        .csrf(csrf -> csrf.disable())
        .cors(Customizer.withDefaults())
        .sessionManagement(
            session -> session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
        .requestCache(cache -> cache.disable())
        .authorizeHttpRequests(
            auth ->
                auth.requestMatchers(
                        HttpMethod.GET, "/r/**", "/actuator/health", "/actuator/health/**")
                    .permitAll()
                    .requestMatchers(
                        HttpMethod.HEAD, "/r/**", "/actuator/health", "/actuator/health/**")
                    .permitAll()
                    .requestMatchers(HttpMethod.GET, "/actuator/metrics", "/actuator/metrics/**")
                    .hasAuthority("SCOPE_metrics.read")
                    .requestMatchers("/api/**")
                    .authenticated()
                    .anyRequest()
                    .denyAll())
        .oauth2ResourceServer(
            oauth ->
                oauth
                    .jwt(Customizer.withDefaults())
                    .authenticationEntryPoint(
                        (req, res, ex) -> {
                          res.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
                          ProblemResponses.write(
                              res,
                              req,
                              HttpStatus.UNAUTHORIZED,
                              "Valid bearer authentication is required");
                        }))
        .exceptionHandling(
            errors ->
                errors
                    .authenticationEntryPoint(
                        (req, res, ex) -> {
                          res.setHeader(HttpHeaders.WWW_AUTHENTICATE, "Bearer");
                          ProblemResponses.write(
                              res,
                              req,
                              HttpStatus.UNAUTHORIZED,
                              "Valid bearer authentication is required");
                        })
                    .accessDeniedHandler(
                        (req, res, ex) ->
                            ProblemResponses.write(
                                res, req, HttpStatus.FORBIDDEN, "Access denied")))
        .headers(
            headers ->
                headers.contentSecurityPolicy(
                    csp -> csp.policyDirectives("default-src 'none'; frame-ancestors 'none'")))
        .addFilterAfter(
            new RateLimitFilter(redis, rateLimit, apiLimit, redirectLimit),
            BearerTokenAuthenticationFilter.class)
        .build();
  }

  @Bean
  CorsConfigurationSource corsConfigurationSource(
      @Value("${app.cors.allowed-origins}") List<String> origins) {
    CorsConfiguration cors = new CorsConfiguration();
    cors.setAllowedOrigins(origins);
    cors.setAllowedMethods(List.of("GET", "HEAD", "POST", "PATCH", "OPTIONS"));
    cors.setAllowedHeaders(List.of("Authorization", "Content-Type"));
    cors.setExposedHeaders(List.of("Location", "X-Request-ID"));
    cors.setAllowCredentials(false);
    cors.setMaxAge(3600L);
    UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
    source.registerCorsConfiguration("/api/**", cors);
    return source;
  }
}
