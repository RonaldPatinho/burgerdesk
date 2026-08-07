ALTER TABLE orders
  ADD KEY idx_orders_finance_period (
    store_id, order_status, payment_status, confirmed_at, id
  );

--> statement-breakpoint

ALTER TABLE payment_attempts
  ADD KEY idx_payment_attempts_finance_period (
    status, order_id, completed_at
  );
