package com.urlshortener.repository;

import com.urlshortener.entity.AnonymousVisitor;
import jakarta.persistence.LockModeType;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface AnonymousVisitorRepository extends JpaRepository<AnonymousVisitor, String> {
  @Lock(LockModeType.PESSIMISTIC_WRITE)
  @Query("select v from AnonymousVisitor v where v.tokenHash = :hash")
  Optional<AnonymousVisitor> lock(@Param("hash") String hash);
}
