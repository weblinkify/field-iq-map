package io.fieldiq.api.query;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;

class CursorTest {

  @Test
  void roundTrips() {
    String cursor = Cursor.encode("FIQ-00042");
    assertThat(cursor).isEqualTo("c2Vuc29yOkZJUS0wMDA0Mg==");
    assertThat(Cursor.decode(cursor)).isEqualTo("FIQ-00042");
    assertThat(Cursor.decode(null)).isNull();
  }

  @Test
  void rejectsGarbage() {
    assertThatThrownBy(() -> Cursor.decode("%%%")).isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> Cursor.decode("c2Vuc29yOg==")) // "sensor:"
        .isInstanceOf(InvalidRequestException.class);
    assertThatThrownBy(() -> Cursor.decode("Zm9vOmJhcg==")) // "foo:bar"
        .isInstanceOf(InvalidRequestException.class);
  }
}
