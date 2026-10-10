package io.fieldiq.api.query;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

class BBoxTest {

  @Test
  void parsesFourNumbers() {
    assertThat(BBox.parse(" 24.5, 60.1,25.3 ,60.4")).isEqualTo(new BBox(24.5, 60.1, 25.3, 60.4));
  }

  @Test
  void blankMeansNoBBox() {
    assertThat(BBox.parse(null)).isNull();
    assertThat(BBox.parse("  ")).isNull();
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "1,2,3",
        "1,2,3,4,5",
        "a,60,25,61",
        "24,60,,61",
        "-181,60,25,61",
        "24,60,181,61",
        "24,-91,25,61",
        "24,60,25,91",
        "25,60,24,61",
        "24,61,25,60",
        "24,60,24,61",
        "NaN,60,25,61",
        "Infinity,60,25,61"
      })
  void rejectsInvalidBoxes(String value) {
    assertThatThrownBy(() -> BBox.parse(value)).isInstanceOf(InvalidRequestException.class);
  }

  @Test
  void containsIsInclusive() {
    BBox box = new BBox(24, 60, 25, 61);
    assertThat(box.contains(24, 60)).isTrue();
    assertThat(box.contains(25, 61)).isTrue();
    assertThat(box.contains(24.5, 60.5)).isTrue();
    assertThat(box.contains(25.0001, 60.5)).isFalse();
  }
}
