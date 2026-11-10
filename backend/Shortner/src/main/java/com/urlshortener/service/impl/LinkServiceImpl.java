package com.urlshortener.service.impl;

import com.urlshortener.cache.RedirectCache;
import com.urlshortener.dto.CreateLinkRequest;
import com.urlshortener.dto.LinkResponse;
import com.urlshortener.dto.LinkStatsResponse;
import com.urlshortener.dto.PageResponse;
import com.urlshortener.dto.UpdateLinkRequest;
import com.urlshortener.entity.ShortLink;
import com.urlshortener.exception.ApiException;
import com.urlshortener.repository.LinkRepository;
import com.urlshortener.service.LinkService;
import com.urlshortener.validation.DestinationValidator;
import java.security.SecureRandom;
import java.time.Clock;
import java.util.Locale;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.task.TaskRejectedException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class LinkServiceImpl implements LinkService {
  private static final Logger log = LoggerFactory.getLogger(LinkServiceImpl.class);
  private static final char[] ALPHABET =
      "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".toCharArray();
  private static final Set<String> RESERVED =
      Set.of("api", "actuator", "health", "admin", "login", "logout", "error", "swagger", "docs");
  private final SecureRandom random = new SecureRandom();
  private final LinkRepository repository;
  private final LinkWriter writer;
  private final ClickRecorder clicks;
  private final RedirectCache cache;
  private final Clock clock;
  private final String baseUrl;

  public LinkServiceImpl(
      LinkRepository repository,
      LinkWriter writer,
      ClickRecorder clicks,
      RedirectCache cache,
      Clock clock,
      @Value("${app.base-url}") String baseUrl) {
    this.repository = repository;
    this.writer = writer;
    this.clicks = clicks;
    this.cache = cache;
    this.clock = clock;
    this.baseUrl = baseUrl.replaceAll("/+$", "");
  }

  @Override
  public LinkResponse create(CreateLinkRequest request, String owner) {
    String destination = DestinationValidator.validate(request.longUrl());
    if (request.expiresAt() != null && !request.expiresAt().isAfter(clock.instant()))
      throw new ApiException(HttpStatus.BAD_REQUEST, "Expiration must be in the future");
    if (request.alias() != null && RESERVED.contains(request.alias().toLowerCase(Locale.ROOT)))
      throw new ApiException(HttpStatus.BAD_REQUEST, "Alias is reserved");
    for (int attempt = 0; attempt < 5; attempt++) {
      String code = request.alias() == null ? generateCode() : request.alias();
      try {
        ShortLink link = writer.insert(code, destination, owner, request.expiresAt());
        log.info("Link created id={}", link.getId());
        return response(link);
      } catch (DataIntegrityViolationException ex) {
        // Retry only confirmed code collisions; other constraint failures must surface.
        if (repository.findByCode(code).isEmpty()) throw ex;
        if (request.alias() != null)
          throw new ApiException(HttpStatus.CONFLICT, "Alias is already in use");
      }
    }
    throw new ApiException(
        HttpStatus.SERVICE_UNAVAILABLE, "Could not allocate a short code; retry later");
  }

  @Transactional(readOnly = true)
  @Override
  public PageResponse<LinkResponse> list(String owner, int page, int size) {
    var result =
        repository.findByOwnerId(
            owner, PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "createdAt", "id")));
    return new PageResponse<>(
        result.map(this::response).getContent(),
        page,
        size,
        result.getTotalElements(),
        result.getTotalPages());
  }

  @Transactional(readOnly = true)
  @Override
  public LinkResponse get(String id, String owner) {
    return response(owned(id, owner));
  }

  @Transactional
  @Override
  public LinkResponse update(String id, String owner, UpdateLinkRequest request) {
    if (request.active() == null && request.expiresAt() == null)
      throw new ApiException(HttpStatus.BAD_REQUEST, "Provide active or expiresAt");
    ShortLink link = owned(id, owner);
    link.update(request.active(), request.expiresAt(), clock.instant());
    log.info("Link updated id={}", id);
    return response(link);
  }

  @Transactional(readOnly = true)
  @Override
  public LinkStatsResponse stats(String id, String owner) {
    ShortLink link = owned(id, owner);
    return new LinkStatsResponse(id, link.getClickCount());
  }

  @Transactional(readOnly = true)
  @Override
  public String resolve(String code) {
    return resolve(code, true);
  }

  @Transactional(readOnly = true)
  @Override
  public String resolve(String code, boolean countClick) {
    String id = cache.get(code);
    ShortLink link =
        (id == null ? repository.findByCode(code) : repository.findById(id))
            .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Link not found"));
    if (!link.getCode().equals(code))
      throw new ApiException(HttpStatus.NOT_FOUND, "Link not found");
    if (!link.isActive()
        || (link.getExpiresAt() != null && !link.getExpiresAt().isAfter(clock.instant())))
      throw new ApiException(HttpStatus.GONE, "Link is inactive or expired");
    if (id == null) cache.put(code, link.getId());
    try {
      if (countClick) clicks.record(link.getId());
    } catch (TaskRejectedException ex) {
      log.warn("Analytics queue full; click not recorded");
    }
    return link.getDestinationUrl();
  }

  private ShortLink owned(String id, String owner) {
    return repository
        .findByIdAndOwnerId(id, owner)
        .orElseThrow(() -> new ApiException(HttpStatus.NOT_FOUND, "Link not found"));
  }

  private String generateCode() {
    char[] code = new char[10];
    for (int i = 0; i < code.length; i++) code[i] = ALPHABET[random.nextInt(ALPHABET.length)];
    return new String(code);
  }

  private LinkResponse response(ShortLink link) {
    return new LinkResponse(
        link.getId(),
        link.getCode(),
        baseUrl + "/r/" + link.getCode(),
        link.getDestinationUrl(),
        link.isActive(),
        link.getExpiresAt(),
        link.getCreatedAt(),
        link.getUpdatedAt());
  }
}
