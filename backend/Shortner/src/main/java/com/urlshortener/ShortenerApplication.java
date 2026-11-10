package com.urlshortener;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableAsync
public class ShortenerApplication {
  public static void main(String[] args) {
    SpringApplication.run(ShortenerApplication.class, args);
  }
}
