package com.urlshortener.service;

import com.urlshortener.entity.AnonymousVisitor;
import com.urlshortener.exception.ApiException;
import com.urlshortener.repository.AnonymousVisitorRepository;
import com.urlshortener.repository.LinkRepository;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.HexFormat;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class GuestService {
  public static final int LIMIT = 30;
  public static final String PREFIX = "guest:";
  private final AnonymousVisitorRepository visitors;
  private final LinkRepository links;
  private final SecureRandom random = new SecureRandom();
  public GuestService(AnonymousVisitorRepository visitors, LinkRepository links) {
    this.visitors = visitors; this.links = links;
  }
  public record Allowance(int limit, int used, int remaining) {}
  public String newToken() { byte[] bytes = new byte[32]; random.nextBytes(bytes); return HexFormat.of().formatHex(bytes); }
  public String hash(String token) {
    if (token == null || !token.matches("[a-f0-9]{64}")) return null;
    try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8))); }
    catch (NoSuchAlgorithmException ex) { throw new IllegalStateException(ex); }
  }
  @Transactional
  public void initialize(String token) { visitors.saveAndFlush(new AnonymousVisitor(hash(token))); }
  public boolean exists(String token) { String hash = hash(token); return hash != null && visitors.existsById(hash); }
  public String owner(String token) {
    if (!exists(token)) throw new ApiException(HttpStatus.UNAUTHORIZED, "Initialize your browser allowance before creating a link");
    return PREFIX + hash(token);
  }
  public Allowance allowance(String token) {
    owner(token);
    int used = visitors.findById(hash(token)).orElseThrow().getUsedCount();
    return new Allowance(LIMIT, used, LIMIT - used);
  }
  @Transactional
  public void claim(String token, String account) {
    String hash = hash(token);
    if (hash != null && visitors.lock(hash).isPresent()) links.claimGuest(PREFIX + hash, account);
  }
}
