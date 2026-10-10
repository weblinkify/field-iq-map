package io.fieldiq.api.query;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

/** Opaque pagination cursor: base64 of {@code sensor:<id>} (same encoding as the mock API). */
public final class Cursor {

  private static final String PREFIX = "sensor:";

  private Cursor() {}

  public static String encode(String sensorId) {
    return Base64.getEncoder().encodeToString((PREFIX + sensorId).getBytes(StandardCharsets.UTF_8));
  }

  /** Returns the sensor id, or null for a null cursor. */
  public static String decode(String cursor) {
    if (cursor == null) {
      return null;
    }
    try {
      String raw = new String(Base64.getDecoder().decode(cursor), StandardCharsets.UTF_8);
      if (raw.startsWith(PREFIX) && raw.length() > PREFIX.length()) {
        return raw.substring(PREFIX.length());
      }
    } catch (IllegalArgumentException e) {
      // fall through
    }
    throw new InvalidRequestException("Invalid cursor");
  }
}
