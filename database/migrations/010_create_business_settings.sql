CREATE TABLE IF NOT EXISTS business_settings (
  store_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  business_name VARCHAR(120) NOT NULL,
  opening_time TIME NOT NULL,
  closing_time TIME NOT NULL,
  service_status VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'open',
  customer_message VARCHAR(500) NOT NULL DEFAULT '',
  digital_menu_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  online_payments_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  new_order_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  time_zone VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT 'America/Caracas',
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (store_id),
  CONSTRAINT chk_business_settings_name
    CHECK (CHAR_LENGTH(TRIM(business_name)) BETWEEN 2 AND 120),
  CONSTRAINT chk_business_settings_hours
    CHECK (opening_time <> closing_time),
  CONSTRAINT chk_business_settings_service_status
    CHECK (service_status IN ('open', 'closed')),
  CONSTRAINT chk_business_settings_message
    CHECK (CHAR_LENGTH(customer_message) <= 500),
  CONSTRAINT chk_business_settings_time_zone
    CHECK (CHAR_LENGTH(time_zone) BETWEEN 1 AND 64)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--> statement-breakpoint

INSERT IGNORE INTO business_settings (
  store_id,
  business_name,
  opening_time,
  closing_time,
  service_status,
  customer_message,
  digital_menu_enabled,
  online_payments_enabled,
  new_order_notifications_enabled,
  time_zone
) VALUES (
  'sede-centro',
  'BurgerDesk',
  '11:30:00',
  '22:00:00',
  'open',
  'Tu pedido estará listo en 15–20 min.',
  TRUE,
  TRUE,
  TRUE,
  'America/Caracas'
);
