package com.urlshortener.controller;

import com.urlshortener.dto.LinkResponse;
import com.urlshortener.dto.PageResponse;
import com.urlshortener.service.GuestService;
import com.urlshortener.service.LinkService;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/guest")
public class GuestController {
  public static final String COOKIE = "gkgo_visitor";
  private final GuestService guests;
  private final LinkService links;
  private final boolean secure;
  public GuestController(GuestService guests, LinkService links, @Value("${app.guest.cookie-secure:true}") boolean secure) {
    this.guests = guests; this.links = links; this.secure = secure;
  }
  @GetMapping("/session")
  public GuestService.Allowance session(@CookieValue(name=COOKIE, required=false) String token, HttpServletResponse response) {
    response.setHeader("Cache-Control", "no-store");
    if (!guests.exists(token)) {
      token = guests.newToken(); guests.initialize(token);
      response.addHeader(HttpHeaders.SET_COOKIE, ResponseCookie.from(COOKIE, token).httpOnly(true).secure(secure)
          .sameSite("Lax").path("/api/v1").maxAge(java.time.Duration.ofDays(365)).build().toString());
    }
    return guests.allowance(token);
  }
  @GetMapping("/links")
  public PageResponse<LinkResponse> list(@CookieValue(name=COOKIE, required=false) String token,
      @RequestParam(defaultValue="0") @Min(0) int page, @RequestParam(defaultValue="10") @Min(1) @Max(100) int size) {
    return links.list(guests.owner(token), page, size);
  }
  @PostMapping("/claim")
  public ResponseEntity<Void> claim(@CookieValue(name=COOKIE, required=false) String token, @AuthenticationPrincipal Jwt jwt) {
    guests.claim(token, jwt.getSubject()); return ResponseEntity.noContent().build();
  }
}
