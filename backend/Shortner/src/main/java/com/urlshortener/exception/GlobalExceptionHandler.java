package com.urlshortener.exception;

import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.ProblemDetail;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

@RestControllerAdvice
public class GlobalExceptionHandler extends ResponseEntityExceptionHandler {
  private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

  @ExceptionHandler(ApiException.class)
  public ProblemDetail application(ApiException ex, HttpServletRequest request) {
    return ProblemResponses.detail(ex.status(), ex.getMessage(), request);
  }

  @ExceptionHandler(OptimisticLockingFailureException.class)
  public ProblemDetail conflict(HttpServletRequest request) {
    return ProblemResponses.detail(
        HttpStatus.CONFLICT, "Link changed concurrently; reload and retry", request);
  }

  @ExceptionHandler(Exception.class)
  public ProblemDetail unexpected(Exception ex, HttpServletRequest request) {
    // Avoid logging exception messages that can contain SQL parameters or destination URLs.
    log.error("Request failed exceptionType={}", ex.getClass().getName());
    return ProblemResponses.detail(
        HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred", request);
  }

  @Override
  protected ResponseEntity<Object> handleExceptionInternal(
      Exception ex, Object body, HttpHeaders headers, HttpStatusCode status, WebRequest request) {
    ProblemDetail problem =
        ProblemDetail.forStatusAndDetail(
            status,
            status.value() == 400
                ? "Invalid request; check JSON, parameters and validation constraints"
                : "Request could not be processed");
    problem.setProperty("requestId", request.getAttribute("requestId", WebRequest.SCOPE_REQUEST));
    return super.handleExceptionInternal(ex, problem, headers, status, request);
  }
}
