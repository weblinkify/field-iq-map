package io.fieldiq.api.rest;

import io.fieldiq.api.query.InvalidRequestException;
import io.fieldiq.api.query.NotFoundException;
import java.net.URI;
import org.springframework.http.HttpStatus;
import org.springframework.http.ProblemDetail;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseEntityExceptionHandler;

/** RFC 7807 problem+json for every REST error. */
@RestControllerAdvice(basePackages = "io.fieldiq.api.rest")
public class ApiExceptionHandler extends ResponseEntityExceptionHandler {

  static final URI INVALID_REQUEST = URI.create("https://fieldiq.dev/problems/invalid-request");
  static final URI NOT_FOUND = URI.create("https://fieldiq.dev/problems/not-found");

  @ExceptionHandler(InvalidRequestException.class)
  ProblemDetail invalid(InvalidRequestException e) {
    ProblemDetail p = ProblemDetail.forStatusAndDetail(HttpStatus.BAD_REQUEST, e.getMessage());
    p.setType(INVALID_REQUEST);
    p.setTitle("Invalid request");
    return p;
  }

  @ExceptionHandler(NotFoundException.class)
  ProblemDetail notFound(NotFoundException e) {
    ProblemDetail p = ProblemDetail.forStatusAndDetail(HttpStatus.NOT_FOUND, e.getMessage());
    p.setType(NOT_FOUND);
    p.setTitle("Not found");
    return p;
  }
}
