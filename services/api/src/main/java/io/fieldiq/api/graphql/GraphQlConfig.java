package io.fieldiq.api.graphql;

import graphql.GraphQLContext;
import graphql.GraphQLError;
import graphql.GraphqlErrorBuilder;
import graphql.execution.CoercedVariables;
import graphql.language.StringValue;
import graphql.language.Value;
import graphql.schema.Coercing;
import graphql.schema.CoercingParseLiteralException;
import graphql.schema.CoercingParseValueException;
import graphql.schema.CoercingSerializeException;
import graphql.schema.DataFetchingEnvironment;
import graphql.schema.GraphQLScalarType;
import io.fieldiq.api.query.InvalidRequestException;
import io.fieldiq.api.query.NotFoundException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.Locale;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.graphql.execution.DataFetcherExceptionResolverAdapter;
import org.springframework.graphql.execution.ErrorType;
import org.springframework.graphql.execution.RuntimeWiringConfigurer;

@Configuration(proxyBeanMethods = false)
public class GraphQlConfig {

  /** ISO-8601 UTC timestamps with second precision, e.g. {@code 2026-10-10T12:00:00Z}. */
  static final GraphQLScalarType DATE_TIME =
      GraphQLScalarType.newScalar()
          .name("DateTime")
          .description("ISO-8601 timestamp in UTC")
          .coercing(
              new Coercing<Instant, String>() {
                @Override
                public String serialize(Object value, GraphQLContext ctx, Locale locale) {
                  if (value instanceof Instant i) {
                    return i.truncatedTo(ChronoUnit.SECONDS).toString();
                  }
                  throw new CoercingSerializeException("Expected an Instant but got " + value);
                }

                @Override
                public Instant parseValue(Object input, GraphQLContext ctx, Locale locale) {
                  if (input instanceof String s) {
                    return parse(s);
                  }
                  throw new CoercingParseValueException("DateTime must be a string");
                }

                @Override
                public Instant parseLiteral(
                    Value<?> input, CoercedVariables vars, GraphQLContext ctx, Locale locale) {
                  if (input instanceof StringValue s) {
                    return parse(s.getValue());
                  }
                  throw new CoercingParseLiteralException("DateTime must be a string");
                }

                private Instant parse(String s) {
                  try {
                    return OffsetDateTime.parse(s).toInstant();
                  } catch (DateTimeParseException e) {
                    throw new CoercingParseValueException("Invalid DateTime: " + s);
                  }
                }
              })
          .build();

  @Bean
  RuntimeWiringConfigurer scalars() {
    return wiring -> wiring.scalar(DATE_TIME);
  }

  @Bean
  DataFetcherExceptionResolverAdapter domainErrors() {
    return new DataFetcherExceptionResolverAdapter() {
      @Override
      protected GraphQLError resolveToSingleError(Throwable ex, DataFetchingEnvironment env) {
        ErrorType type =
            ex instanceof InvalidRequestException
                ? ErrorType.BAD_REQUEST
                : ex instanceof NotFoundException ? ErrorType.NOT_FOUND : null;
        if (type == null) {
          return null;
        }
        return GraphqlErrorBuilder.newError(env).errorType(type).message(ex.getMessage()).build();
      }
    };
  }
}
