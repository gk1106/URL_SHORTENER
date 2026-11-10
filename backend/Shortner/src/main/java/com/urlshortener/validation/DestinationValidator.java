package com.urlshortener.validation;

import com.urlshortener.exception.ApiException;
import java.net.URI;
import java.net.URISyntaxException;
import org.springframework.http.HttpStatus;

public final class DestinationValidator {
  private DestinationValidator() {}

  public static String validate(String input) {
    try {
      URI uri = new URI(input);
      if (!("https".equalsIgnoreCase(uri.getScheme()) || "http".equalsIgnoreCase(uri.getScheme()))
          || uri.getHost() == null
          || uri.getUserInfo() != null
          || (uri.getPort() != -1 && (uri.getPort() < 1 || uri.getPort() > 65535))) {
        throw new URISyntaxException(input, "Invalid HTTP destination");
      }
      String destination = uri.toASCIIString();
      if (destination.length() > 2048) throw new URISyntaxException(input, "Destination too long");
      return destination;
    } catch (URISyntaxException | NullPointerException ex) {
      throw new ApiException(
          HttpStatus.BAD_REQUEST,
          "Destination must be an absolute HTTP or HTTPS URL without credentials");
    }
  }
}
