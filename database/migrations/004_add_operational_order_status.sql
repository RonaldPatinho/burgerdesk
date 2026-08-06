ALTER TABLE orders
  ADD COLUMN operational_status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL
    AFTER order_status,
  ADD KEY idx_orders_operational_created (operational_status, created_at);

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS order_status_history (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  order_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  previous_status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NULL,
  new_status VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  changed_by_user_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL,
  change_source VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  changed_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  UNIQUE KEY uq_order_status_history_order_status (order_id, new_status),
  KEY idx_order_status_history_order_time (order_id, changed_at),
  KEY idx_order_status_history_user_time (changed_by_user_id, changed_at),
  CONSTRAINT fk_order_status_history_order
    FOREIGN KEY (order_id) REFERENCES orders (id) ON DELETE CASCADE,
  CONSTRAINT fk_order_status_history_user
    FOREIGN KEY (changed_by_user_id) REFERENCES internal_users (id) ON DELETE SET NULL,
  CONSTRAINT chk_order_status_history_previous
    CHECK (
      previous_status IS NULL OR
      previous_status IN (
        'recibido', 'en_preparacion', 'listo_para_retirar', 'entregado', 'cancelado'
      )
    ),
  CONSTRAINT chk_order_status_history_new
    CHECK (
      new_status IN (
        'recibido', 'en_preparacion', 'listo_para_retirar', 'entregado', 'cancelado'
      )
    ),
  CONSTRAINT chk_order_status_history_source
    CHECK (change_source IN ('checkout_cash', 'stripe_webhook', 'staff', 'migration'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

--> statement-breakpoint

UPDATE orders
SET operational_status = 'recibido'
WHERE order_status = 'confirmado'
  AND operational_status IS NULL;

--> statement-breakpoint

INSERT IGNORE INTO order_status_history (
  id, order_id, previous_status, new_status,
  changed_by_user_id, change_source, changed_at
)
SELECT
  UUID(), id, NULL, 'recibido', NULL, 'migration',
  COALESCE(confirmed_at, created_at)
FROM orders
WHERE operational_status = 'recibido';

--> statement-breakpoint

ALTER TABLE orders
  ADD CONSTRAINT chk_orders_operational_status
    CHECK (
      operational_status IS NULL OR
      operational_status IN (
        'recibido', 'en_preparacion', 'listo_para_retirar', 'entregado', 'cancelado'
      )
    ),
  ADD CONSTRAINT chk_orders_operational_confirmation
    CHECK (
      (order_status = 'pendiente_de_pago' AND operational_status IS NULL)
      OR
      (order_status = 'confirmado' AND operational_status IS NOT NULL)
    );
