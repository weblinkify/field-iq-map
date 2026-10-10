package io.fieldiq.api.query;

/** Client error (HTTP 400 / GraphQL BAD_REQUEST). */
public class InvalidRequestException extends RuntimeException {

  public InvalidRequestException(String message) {
    super(message);
  }
}
