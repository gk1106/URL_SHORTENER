package com.urlshortener.security;

import com.urlshortener.exception.ProblemResponses;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletException;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import jakarta.servlet.http.HttpServletResponse;
import java.io.BufferedReader;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.UUID;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestFilter extends OncePerRequestFilter {
  private static final int MAX_BODY_BYTES = 16 * 1024;

  @Override
  protected void doFilterInternal(
      HttpServletRequest request, HttpServletResponse response, FilterChain chain)
      throws ServletException, IOException {
    String id = UUID.randomUUID().toString();
    request.setAttribute("requestId", id);
    response.setHeader("X-Request-ID", id);
    MDC.put("requestId", id);
    try {
      if (request.getContentLengthLong() > MAX_BODY_BYTES) {
        ProblemResponses.write(
            response, request, HttpStatus.CONTENT_TOO_LARGE, "Request body exceeds 16 KiB");
        return;
      }
      // Bound chunked bodies too, rather than trusting Content-Length.
      if ("POST".equals(request.getMethod())
          || "PATCH".equals(request.getMethod())
          || "PUT".equals(request.getMethod())) {
        byte[] body = request.getInputStream().readNBytes(MAX_BODY_BYTES + 1);
        if (body.length > MAX_BODY_BYTES) {
          ProblemResponses.write(
              response, request, HttpStatus.CONTENT_TOO_LARGE, "Request body exceeds 16 KiB");
          return;
        }
        chain.doFilter(
            new HttpServletRequestWrapper(request) {
              @Override
              public ServletInputStream getInputStream() {
                ByteArrayInputStream input = new ByteArrayInputStream(body);
                return new ServletInputStream() {
                  public int read() {
                    return input.read();
                  }

                  public boolean isFinished() {
                    return input.available() == 0;
                  }

                  public boolean isReady() {
                    return true;
                  }

                  public void setReadListener(ReadListener listener) {
                    throw new UnsupportedOperationException();
                  }
                };
              }

              @Override
              public BufferedReader getReader() {
                return new BufferedReader(
                    new InputStreamReader(
                        getInputStream(), java.nio.charset.StandardCharsets.UTF_8));
              }
            },
            response);
      } else chain.doFilter(request, response);
    } finally {
      MDC.clear();
    }
  }
}
