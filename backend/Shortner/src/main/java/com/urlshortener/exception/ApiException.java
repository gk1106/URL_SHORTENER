package com.urlshortener.exception;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {
  private final HttpStatus status;
  private final String code;

  public ApiException(HttpStatus status, String message) {
    this(status, message, null);
  }

  public ApiException(HttpStatus status, String message, String code) {
    super(message);
    this.code = code;
    this.status = status;
  }

  public String code() { return code; }

  public HttpStatus status() {
    return status;
  }
}
