package com.urlshortener.controller;

import com.urlshortener.dto.CreateLinkRequest;
import com.urlshortener.dto.LinkResponse;
import com.urlshortener.dto.LinkStatsResponse;
import com.urlshortener.dto.PageResponse;
import com.urlshortener.dto.UpdateLinkRequest;
import com.urlshortener.service.LinkService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.net.URI;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/urls")
public class LinkController {
  private final LinkService service;

  public LinkController(LinkService service) {
    this.service = service;
  }

  @PostMapping
  public ResponseEntity<LinkResponse> create(
      @Valid @RequestBody CreateLinkRequest request, @AuthenticationPrincipal Jwt jwt) {
    LinkResponse response = service.create(request, jwt.getSubject());
    return ResponseEntity.created(URI.create("/api/v1/urls/" + response.id())).body(response);
  }

  @GetMapping
  public PageResponse<LinkResponse> list(
      @AuthenticationPrincipal Jwt jwt,
      @RequestParam(defaultValue = "0") @Min(0) int page,
      @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
    return service.list(jwt.getSubject(), page, size);
  }

  @GetMapping("/{id}")
  public LinkResponse get(@PathVariable String id, @AuthenticationPrincipal Jwt jwt) {
    return service.get(id, jwt.getSubject());
  }

  @PatchMapping("/{id}")
  public LinkResponse update(
      @PathVariable String id,
      @Valid @RequestBody UpdateLinkRequest request,
      @AuthenticationPrincipal Jwt jwt) {
    return service.update(id, jwt.getSubject(), request);
  }

  @GetMapping("/{id}/stats")
  public LinkStatsResponse stats(@PathVariable String id, @AuthenticationPrincipal Jwt jwt) {
    return service.stats(id, jwt.getSubject());
  }
}
