CREATE TABLE IF NOT EXISTS orders (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  creation_idempotency_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_fingerprint_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  client_session_id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  client_id VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NULL,
  store_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  payment_method VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  order_status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  payment_status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  currency CHAR(3) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  subtotal_cop BIGINT UNSIGNED NOT NULL,
  service_fee_cop BIGINT UNSIGNED NOT NULL,
  total_cop BIGINT UNSIGNED NOT NULL,
  kitchen_note TEXT NOT NULL,
  confirmed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_orders_creation_idempotency (creation_idempotency_key),
  KEY idx_orders_client_created (client_id, created_at),
  KEY idx_orders_session_created (client_session_id, created_at),
  KEY idx_orders_status_updated (order_status, updated_at),
  CONSTRAINT chk_orders_payment_method
    CHECK (payment_method IN ('stripe', 'efectivo')),
  CONSTRAINT chk_orders_order_status
    CHECK (order_status IN ('pendiente_de_pago', 'confirmado')),
  CONSTRAINT chk_orders_payment_status
    CHECK (payment_status IN ('pendiente', 'pendiente_en_efectivo', 'pagado', 'expirado', 'fallido')),
  CONSTRAINT chk_orders_currency CHECK (currency = 'COP'),
  CONSTRAINT chk_orders_totals CHECK (total_cop = subtotal_cop + service_fee_cop)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS order_lines (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  line_position SMALLINT UNSIGNED NOT NULL,
  product_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  product_name VARCHAR(191) NOT NULL,
  quantity SMALLINT UNSIGNED NOT NULL,
  unit_base_price_cop BIGINT UNSIGNED NOT NULL,
  unit_price_cop BIGINT UNSIGNED NOT NULL,
  line_total_cop BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_lines_position (order_id, line_position),
  KEY idx_order_lines_product (product_id),
  CONSTRAINT fk_order_lines_order
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT chk_order_lines_quantity CHECK (quantity >= 1),
  CONSTRAINT chk_order_lines_total CHECK (line_total_cop = unit_price_cop * quantity),
  CONSTRAINT chk_order_lines_prices CHECK (unit_price_cop >= unit_base_price_cop)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS order_line_options (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  order_line_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  option_position SMALLINT UNSIGNED NOT NULL,
  option_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  option_name VARCHAR(191) NOT NULL,
  price_cop BIGINT UNSIGNED NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_line_options_position (order_line_id, option_position),
  KEY idx_order_line_options_option (option_id),
  CONSTRAINT fk_order_line_options_line
    FOREIGN KEY (order_line_id) REFERENCES order_lines (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS payment_attempts (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  attempt_number SMALLINT UNSIGNED NOT NULL,
  request_idempotency_key VARCHAR(191) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  request_fingerprint_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  stripe_checkout_session_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
  stripe_payment_intent_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
  completed_at DATETIME(3) NULL,
  expired_at DATETIME(3) NULL,
  failed_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_payment_attempts_order_number (order_id, attempt_number),
  UNIQUE KEY uq_payment_attempts_request_idempotency (request_idempotency_key),
  UNIQUE KEY uq_payment_attempts_checkout_session (stripe_checkout_session_id),
  UNIQUE KEY uq_payment_attempts_payment_intent (stripe_payment_intent_id),
  KEY idx_payment_attempts_order_status (order_id, status, attempt_number),
  CONSTRAINT fk_payment_attempts_order
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT chk_payment_attempts_number CHECK (attempt_number >= 1),
  CONSTRAINT chk_payment_attempts_status
    CHECK (status IN ('pendiente', 'pagado', 'expirado', 'fallido'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS stripe_webhook_events (
  stripe_event_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_type VARCHAR(96) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  stripe_object_id VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL,
  order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  payment_attempt_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  processing_status VARCHAR(24) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  event_created_at DATETIME(3) NOT NULL,
  received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  processed_at DATETIME(3) NULL,
  PRIMARY KEY (stripe_event_id),
  KEY idx_webhook_events_order (order_id, received_at),
  KEY idx_webhook_events_attempt (payment_attempt_id, received_at),
  CONSTRAINT fk_webhook_events_order
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE SET NULL,
  CONSTRAINT fk_webhook_events_attempt
    FOREIGN KEY (payment_attempt_id) REFERENCES payment_attempts (id) ON DELETE SET NULL,
  CONSTRAINT chk_webhook_events_status
    CHECK (processing_status IN ('procesando', 'procesado', 'ignorado'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
