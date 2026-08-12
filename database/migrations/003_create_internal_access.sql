CREATE TABLE IF NOT EXISTS internal_users (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  username VARCHAR(64) NOT NULL,
  username_normalized VARCHAR(64) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  email_normalized VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  role VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_internal_users_username_normalized (username_normalized),
  UNIQUE KEY uq_internal_users_email_normalized (email_normalized),
  KEY idx_internal_users_role_active (role, active),
  CONSTRAINT chk_internal_users_role
    CHECK (role IN ('caja', 'cocina', 'caja_cocina', 'administrador'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS internal_sessions (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  token_hash_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  last_seen_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_internal_sessions_token_hash (token_hash_sha256),
  KEY idx_internal_sessions_user_active (user_id, revoked_at, expires_at),
  CONSTRAINT fk_internal_sessions_user
    FOREIGN KEY (user_id) REFERENCES internal_users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS staff_shifts (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  starts_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  ends_at DATETIME(3) NULL,
  status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'activo',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_staff_shifts_user_status (user_id, status, starts_at),
  CONSTRAINT fk_staff_shifts_user
    FOREIGN KEY (user_id) REFERENCES internal_users (id) ON DELETE CASCADE,
  CONSTRAINT chk_staff_shifts_status
    CHECK (status IN ('activo', 'cerrado')),
  CONSTRAINT chk_staff_shifts_consistency
    CHECK (
      (status = 'activo' AND ends_at IS NULL)
      OR (status = 'cerrado' AND ends_at IS NOT NULL)
    )
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS internal_access_events (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  event_type VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  occurred_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_internal_access_events_user (user_id, occurred_at),
  KEY idx_internal_access_events_type (event_type, occurred_at),
  CONSTRAINT fk_internal_access_events_user
    FOREIGN KEY (user_id) REFERENCES internal_users (id) ON DELETE SET NULL,
  CONSTRAINT chk_internal_access_events_type
    CHECK (event_type IN ('login_success', 'login_failure', 'logout'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
