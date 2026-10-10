package io.fieldiq.api.query;

/** WGS84 bounding box. Validated on construction. */
public record BBox(double minLon, double minLat, double maxLon, double maxLat) {

  public BBox {
    if (!allFinite(minLon, minLat, maxLon, maxLat)) {
      throw new InvalidRequestException("bbox values must be finite numbers");
    }
    if (minLon < -180 || maxLon > 180) {
      throw new InvalidRequestException("bbox longitude must be within -180..180");
    }
    if (minLat < -90 || maxLat > 90) {
      throw new InvalidRequestException("bbox latitude must be within -90..90");
    }
    if (minLon >= maxLon || minLat >= maxLat) {
      throw new InvalidRequestException("bbox min values must be smaller than max values");
    }
  }

  /** Parses {@code minLon,minLat,maxLon,maxLat}; returns null for a blank value. */
  public static BBox parse(String value) {
    if (value == null || value.isBlank()) {
      return null;
    }
    String[] parts = value.split(",", -1);
    if (parts.length != 4) {
      throw new InvalidRequestException("bbox must be minLon,minLat,maxLon,maxLat");
    }
    double[] n = new double[4];
    for (int i = 0; i < 4; i++) {
      try {
        n[i] = Double.parseDouble(parts[i].trim());
      } catch (NumberFormatException e) {
        throw new InvalidRequestException("bbox must contain four numbers");
      }
    }
    return new BBox(n[0], n[1], n[2], n[3]);
  }

  public boolean contains(double lon, double lat) {
    return lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
  }

  private static boolean allFinite(double... values) {
    for (double v : values) {
      if (!Double.isFinite(v)) {
        return false;
      }
    }
    return true;
  }
}
