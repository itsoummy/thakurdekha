export interface Migration {
  id: number;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    id: 1,
    name: "initial_community_schema",
    sql: `
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER','ADMIN')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_sessions_user ON sessions(user_id);

CREATE TABLE pandals (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  name_bn TEXT,
  description TEXT,
  history TEXT,
  established_year INTEGER,
  current_theme TEXT,
  theme_status TEXT,
  category TEXT,
  zone TEXT,
  budget_range TEXT,
  opening_time TEXT,
  closing_time TEXT,
  crowd_rating INTEGER,
  trending_score INTEGER,
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  address TEXT,
  neighbourhood TEXT,
  nearest_metro TEXT,
  nearest_bus_stop TEXT,
  google_maps_url TEXT,
  images TEXT NOT NULL DEFAULT '[]',
  verified INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','FLAGGED')),
  source TEXT NOT NULL DEFAULT 'community',
  moderator_notes TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_pandals_latlng ON pandals(latitude, longitude);
CREATE INDEX idx_pandals_status ON pandals(status);
CREATE INDEX idx_pandals_name ON pandals(name COLLATE NOCASE);
CREATE INDEX idx_pandals_slug ON pandals(slug);
CREATE INDEX idx_pandals_created ON pandals(created_at);
CREATE INDEX idx_pandals_created_by ON pandals(created_by);

CREATE TABLE food_places (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  recommended_dish TEXT,
  price_range TEXT,
  latitude REAL NOT NULL CHECK (latitude BETWEEN -90 AND 90),
  longitude REAL NOT NULL CHECK (longitude BETWEEN -180 AND 180),
  address TEXT,
  images TEXT NOT NULL DEFAULT '[]',
  pujo_special INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','FLAGGED')),
  source TEXT NOT NULL DEFAULT 'community',
  moderator_notes TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_food_latlng ON food_places(latitude, longitude);
CREATE INDEX idx_food_status ON food_places(status);
CREATE INDEX idx_food_name ON food_places(name COLLATE NOCASE);
CREATE INDEX idx_food_created ON food_places(created_at);
CREATE INDEX idx_food_created_by ON food_places(created_by);

CREATE TABLE pandal_food_links (
  pandal_id TEXT NOT NULL REFERENCES pandals(id) ON DELETE CASCADE,
  food_place_id TEXT NOT NULL REFERENCES food_places(id) ON DELETE CASCADE,
  PRIMARY KEY (pandal_id, food_place_id)
);

CREATE TABLE food_recommendations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  food_place_id TEXT NOT NULL REFERENCES food_places(id) ON DELETE CASCADE,
  pandal_id TEXT REFERENCES pandals(id) ON DELETE SET NULL,
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  recommended_dish TEXT,
  images TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','FLAGGED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_reco_place ON food_recommendations(food_place_id, status);
CREATE INDEX idx_reco_user ON food_recommendations(user_id);
CREATE INDEX idx_reco_created ON food_recommendations(created_at);

CREATE TABLE pandal_reviews (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pandal_id TEXT NOT NULL REFERENCES pandals(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  images TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','FLAGGED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, pandal_id)
);
CREATE INDEX idx_pandal_reviews_pandal ON pandal_reviews(pandal_id, status);
CREATE INDEX idx_pandal_reviews_user ON pandal_reviews(user_id);

CREATE TABLE saved_pandals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pandal_id TEXT NOT NULL REFERENCES pandals(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, pandal_id)
);
CREATE INDEX idx_saved_pandal ON saved_pandals(pandal_id);

CREATE TABLE visited_pandals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pandal_id TEXT NOT NULL REFERENCES pandals(id) ON DELETE CASCADE,
  visited_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE (user_id, pandal_id)
);
CREATE INDEX idx_visited_pandal ON visited_pandals(pandal_id);

CREATE TABLE puja_plans (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  travel_mode TEXT CHECK (travel_mode IN ('WALKING','DRIVING','TRANSIT')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_plans_user ON puja_plans(user_id);

CREATE TABLE puja_plan_stops (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES puja_plans(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('PANDAL','FOOD')),
  entity_id TEXT NOT NULL,
  position INTEGER NOT NULL
);
CREATE INDEX idx_plan_stops_plan ON puja_plan_stops(plan_id, position);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('PANDAL','FOOD','PANDAL_REVIEW','FOOD_RECOMMENDATION')),
  entity_id TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (reason IN ('INCORRECT_INFO','DUPLICATE','CLOSED','WRONG_LOCATION','SPAM','INAPPROPRIATE','OTHER')),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN','RESOLVED','DISMISSED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_reports_status ON reports(status);
CREATE INDEX idx_reports_entity ON reports(entity_type, entity_id);

CREATE TABLE analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  user_id TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_analytics_name ON analytics_events(name, created_at);
`,
  },
  {
    id: 2,
    name: "pandal_photo_submissions",
    sql: `
CREATE TABLE pandal_photos (
  id TEXT PRIMARY KEY,
  pandal_id TEXT NOT NULL REFERENCES pandals(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  image TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_pandal_photos_status ON pandal_photos(status, created_at);
CREATE INDEX idx_pandal_photos_pandal ON pandal_photos(pandal_id);
`,
  },
];
