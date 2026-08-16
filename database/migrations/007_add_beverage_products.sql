INSERT IGNORE INTO catalog_products (
  id, name, summary, detail_description, price_cop, image_path,
  available, badge, sort_order, featured_order
) VALUES
  (
    'fanta',
    'Fanta',
    'Bebida fría',
    NULL,
    6900,
    '/images/products/fanta.png',
    TRUE,
    NULL,
    7,
    NULL
  ),
  (
    'sprite',
    'Sprite',
    'Bebida fría',
    NULL,
    6900,
    '/images/products/sprite.png',
    TRUE,
    NULL,
    8,
    NULL
  );

--> statement-breakpoint

INSERT IGNORE INTO catalog_product_categories (product_id, category_id, sort_order) VALUES
  ('fanta', 'bebidas', 1),
  ('sprite', 'bebidas', 2);
