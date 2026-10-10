package io.fieldiq.api.domain;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(enumAsRef = true)
public enum SensorStatus {
  ONLINE,
  OFFLINE,
  ALERT,
  LOW_BATTERY
}
