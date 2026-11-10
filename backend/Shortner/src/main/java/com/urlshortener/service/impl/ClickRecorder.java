package com.urlshortener.service.impl;

import com.urlshortener.repository.LinkRepository;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ClickRecorder {
  private final LinkRepository repository;

  public ClickRecorder(LinkRepository repository) {
    this.repository = repository;
  }

  @Async("analyticsExecutor")
  @Transactional
  public void record(String id) {
    repository.incrementClicks(id);
  }
}
