package com.urlshortener.service.impl;

import com.urlshortener.entity.ShortLink;
import com.urlshortener.exception.ApiException;
import com.urlshortener.repository.AnonymousVisitorRepository;
import com.urlshortener.service.GuestService;
import org.springframework.http.HttpStatus;
import com.urlshortener.repository.LinkRepository;
import java.time.Clock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LinkWriter {
  private final LinkRepository repository;
  private final Clock clock;
  private final AnonymousVisitorRepository visitors;

  public LinkWriter(LinkRepository repository, Clock clock, AnonymousVisitorRepository visitors) {
    this.repository = repository;
    this.clock = clock;
    this.visitors = visitors;
  }

  // A failed unique constraint invalidates its transaction, so retries need fresh transactions.
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public ShortLink insert(
      String code, String destination, String owner, java.time.Instant expiresAt) {
    if (owner.startsWith(GuestService.PREFIX)) {
      var visitor = visitors.lock(owner.substring(GuestService.PREFIX.length()))
          .orElseThrow(() -> new ApiException(HttpStatus.UNAUTHORIZED, "Browser allowance is unavailable"));
      if (visitor.getUsedCount() >= GuestService.LIMIT)
        throw new ApiException(HttpStatus.UNAUTHORIZED,
            "You have used your 30 free links. Sign in or sign up to continue.", "GUEST_LIMIT_REACHED");
      visitor.consume();
    }
    return repository.saveAndFlush(
        new ShortLink(code, destination, owner, expiresAt, clock.instant()));
  }
}
