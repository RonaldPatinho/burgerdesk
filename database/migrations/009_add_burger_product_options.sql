START TRANSACTION;

--> statement-breakpoint

INSERT IGNORE INTO catalog_product_options (
  product_id, id, name, price_cop, available, sort_order
)
SELECT
  burger.product_id,
  standard_option.id,
  standard_option.name,
  standard_option.price_cop,
  TRUE,
  standard_option.sort_order
FROM (
  SELECT product_category.product_id
  FROM catalog_product_categories product_category
  INNER JOIN catalog_products product
    ON product.id = product_category.product_id
  WHERE product_category.category_id = 'burgers'
    AND product.archived_at IS NULL
) AS burger
CROSS JOIN (
  SELECT 'cheddar-extra' AS id, 'Cheddar extra' AS name, 3500 AS price_cop, 1 AS sort_order
  UNION ALL
  SELECT 'tocineta', 'Tocineta', 4500, 2
  UNION ALL
  SELECT 'cebolla', 'Cebolla', 2500, 3
  UNION ALL
  SELECT 'salsa-incluida', 'Salsa incluida', 0, 4
) AS standard_option;

--> statement-breakpoint

INSERT IGNORE INTO catalog_product_default_options (
  product_id, option_id, sort_order
)
SELECT
  product_category.product_id,
  'salsa-incluida',
  1
FROM catalog_product_categories product_category
INNER JOIN catalog_products product
  ON product.id = product_category.product_id
INNER JOIN catalog_product_options product_option
  ON product_option.product_id = product_category.product_id
  AND product_option.id = 'salsa-incluida'
WHERE product_category.category_id = 'burgers'
  AND product.archived_at IS NULL
  AND product_category.product_id <> 'la-bendita';

--> statement-breakpoint

COMMIT;
