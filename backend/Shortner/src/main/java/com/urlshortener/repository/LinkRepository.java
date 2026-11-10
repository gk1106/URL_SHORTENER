package com.urlshortener.repository;

import com.urlshortener.entity.ShortLink;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LinkRepository extends JpaRepository<ShortLink, String> {
  Optional<ShortLink> findByCode(String code);

  Optional<ShortLink> findByIdAndOwnerId(String id, String ownerId);

  Page<ShortLink> findByOwnerId(String ownerId, Pageable pageable);

  @Modifying
  @Query("update ShortLink l set l.ownerId = :account, l.version = l.version + 1 where l.ownerId = :guest")
  int claimGuest(@Param("guest") String guest, @Param("account") String account);

  @Modifying
  @Query("update ShortLink l set l.clickCount = l.clickCount + 1 where l.id = :id")
  int incrementClicks(@Param("id") String id);
}
