package com.urlshortener.exception;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.http.MediaType;
import org.springframework.http.ProblemDetail;

public final class ProblemResponses {
  private ProblemResponses() {}

  public static ProblemDetail detail(
      HttpStatusCode status, String message, HttpServletRequest request) {
    ProblemDetail detail = ProblemDetail.forStatusAndDetail(status, message);
    detail.setInstance(URI.create(request.getRequestURI()));
    detail.setProperty("requestId", request.getAttribute("requestId"));
    return detail;
  }

  public static void write(
      HttpServletResponse response, HttpServletRequest request, HttpStatus status, String message)
      throws IOException {
    response.setStatus(status.value());
    response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
    // Messages are application constants; requestId is generated internally.
    response
        .getWriter()
        .write(
            "{\"type\":\"about:blank\",\"title\":\""
                + status.getReasonPhrase()
                + "\",\"status\":"
                + status.value()
                + ",\"detail\":\""
                + message
                + "\",\"requestId\":\""
                + request.getAttribute("requestId")
                + "\"}");
  }
}
