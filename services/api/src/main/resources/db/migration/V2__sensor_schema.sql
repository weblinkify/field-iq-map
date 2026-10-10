-- FieldIQ v2 core schema. Geometry is WGS84 (EPSG:4326).

CREATE TABLE site (
  id           varchar(16) PRIMARY KEY,
  name         text        NOT NULL,
  municipality text        NOT NULL,
  region       text        NOT NULL,
  location     geometry(Point, 4326) NOT NULL
);

CREATE TABLE sensor (
  id           varchar(16) PRIMARY KEY,
  name         text        NOT NULL,
  type         varchar(32) NOT NULL,
  status       varchar(16) NOT NULL,
  location     geometry(Point, 4326) NOT NULL,
  municipality text        NOT NULL,
  region       text        NOT NULL,
  site_id      varchar(16) NOT NULL REFERENCES site (id),
  site_name    text        NOT NULL,
  installed_at timestamptz NOT NULL,
  battery_pct  integer     NOT NULL CHECK (battery_pct BETWEEN 0 AND 100),
  firmware     varchar(32) NOT NULL,
  last_seen_at timestamptz NOT NULL
);

-- Bounding-box queries use `location && ST_MakeEnvelope(...)`, served by this GiST index.
CREATE INDEX sensor_location_gix ON sensor USING gist (location);
CREATE INDEX sensor_status_idx ON sensor (status);
CREATE INDEX sensor_type_idx ON sensor (type);
CREATE INDEX sensor_region_idx ON sensor (region);
CREATE INDEX sensor_site_idx ON sensor (site_id);

-- Hourly history.
CREATE TABLE reading (
  id        bigserial PRIMARY KEY,
  sensor_id varchar(16)      NOT NULL REFERENCES sensor (id) ON DELETE CASCADE,
  ts        timestamptz      NOT NULL,
  metric    varchar(16)      NOT NULL,
  value     double precision NOT NULL,
  unit      varchar(8)       NOT NULL
);
CREATE INDEX reading_sensor_ts_idx ON reading (sensor_id, ts);

-- Latest value per sensor and metric, upserted by the simulator every 30 s.
CREATE TABLE latest_reading (
  sensor_id varchar(16)      NOT NULL REFERENCES sensor (id) ON DELETE CASCADE,
  metric    varchar(16)      NOT NULL,
  ts        timestamptz      NOT NULL,
  value     double precision NOT NULL,
  unit      varchar(8)       NOT NULL,
  PRIMARY KEY (sensor_id, metric)
);

CREATE TABLE alert (
  id          varchar(16) PRIMARY KEY,
  sensor_id   varchar(16) NOT NULL REFERENCES sensor (id) ON DELETE CASCADE,
  severity    varchar(16) NOT NULL,
  message     text        NOT NULL,
  created_at  timestamptz NOT NULL,
  resolved_at timestamptz
);
CREATE INDEX alert_sensor_idx ON alert (sensor_id);
CREATE INDEX alert_active_idx ON alert (created_at DESC) WHERE resolved_at IS NULL;
