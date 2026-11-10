package com.urlshortener.service.impl;

import com.urlshortener.entity.ShortLink;
import com.urlshortener.repository.LinkRepository;
import java.time.Clock;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LinkWriter {
  private final LinkRepository repository;
  private final Clock clock;

  public LinkWriter(LinkRepository repository, Clock clock) {
    this.repository = repository;
    this.clock = clock;
  }

  // A failed unique constraint invalidates its transaction, so retries need fresh transactions.
  @Transactional(propagation = Propagation.REQUIRES_NEW)
  public ShortLink insert(
      String code, String destination, String owner, java.time.Instant expiresAt) {
    return repository.saveAndFlush(
        new ShortLink(code, destination, owner, expiresAt, clock.instant()));
  }
}
