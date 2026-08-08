CREATE TABLE IF NOT EXISTS client_users (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  email_normalized VARCHAR(254) NOT NULL,
  phone VARCHAR(32) NULL,
  password_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  preferred_store_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  contact_whatsapp BOOLEAN NOT NULL DEFAULT TRUE,
  contact_email BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_client_users_email_normalized (email_normalized),
  KEY idx_client_users_active (active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS client_sessions (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  token_hash_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_client_sessions_token_hash (token_hash_sha256),
  KEY idx_client_sessions_user_active (user_id, revoked_at, expires_at),
  CONSTRAINT fk_client_sessions_user
    FOREIGN KEY (user_id) REFERENCES client_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS client_avatars (
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  mime_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  image_data MEDIUMBLOB NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  content_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (user_id),
  CONSTRAINT fk_client_avatars_user
    FOREIGN KEY (user_id) REFERENCES client_users (id) ON DELETE CASCADE,
  CONSTRAINT chk_client_avatars_mime
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT chk_client_avatars_size
    CHECK (size_bytes >= 1 AND size_bytes <= 5242880)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--> statement-breakpoint

ALTER TABLE orders
  ADD COLUMN user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL AFTER client_id,
  ADD KEY idx_orders_user_created (user_id, created_at),
  ADD CONSTRAINT fk_orders_user
    FOREIGN KEY (user_id) REFERENCES client_users (id) ON DELETE SET NULL;
