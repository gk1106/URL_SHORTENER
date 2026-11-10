package com.urlshortener.controller;

import com.urlshortener.service.LinkService;
import java.net.URI;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class RedirectController {
  private final LinkService service;

  public RedirectController(LinkService service) {
    this.service = service;
  }

  @GetMapping("/r/{code:[A-Za-z0-9_-]{4,32}}")
  public ResponseEntity<Void> redirect(
      @PathVariable String code, jakarta.servlet.http.HttpServletRequest request) {
    return ResponseEntity.status(HttpStatus.FOUND)
        .location(URI.create(service.resolve(code, !"HEAD".equals(request.getMethod()))))
        .cacheControl(CacheControl.noStore())
        .build();
  }
}
