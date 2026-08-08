CREATE TABLE IF NOT EXISTS catalog_categories (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(120) NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_catalog_categories_active_order (active, sort_order, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS catalog_category_placements (
  category_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  placement VARCHAR(16) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  PRIMARY KEY (category_id, placement),
  KEY idx_catalog_category_placements_placement (placement, category_id),
  CONSTRAINT fk_catalog_category_placements_category
    FOREIGN KEY (category_id) REFERENCES catalog_categories (id) ON DELETE CASCADE,
  CONSTRAINT chk_catalog_category_placements_value
    CHECK (placement IN ('home', 'menu'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS catalog_products (
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(191) NOT NULL,
  summary VARCHAR(255) NOT NULL,
  detail_description TEXT NULL,
  price_cop BIGINT UNSIGNED NOT NULL,
  image_path VARCHAR(512) NOT NULL,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  badge VARCHAR(120) NULL,
  sort_order SMALLINT UNSIGNED NOT NULL,
  featured_order SMALLINT UNSIGNED NULL,
  archived_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_catalog_products_available_order (archived_at, available, sort_order, id),
  KEY idx_catalog_products_featured (featured_order, archived_at, available),
  CONSTRAINT chk_catalog_products_image_path
    CHECK (CHAR_LENGTH(image_path) >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS catalog_product_categories (
  product_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  category_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (product_id, category_id),
  KEY idx_catalog_product_categories_category (category_id, sort_order, product_id),
  CONSTRAINT fk_catalog_product_categories_product
    FOREIGN KEY (product_id) REFERENCES catalog_products (id) ON DELETE CASCADE,
  CONSTRAINT fk_catalog_product_categories_category
    FOREIGN KEY (category_id) REFERENCES catalog_categories (id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS catalog_product_options (
  product_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  name VARCHAR(191) NOT NULL,
  price_cop BIGINT UNSIGNED NOT NULL,
  available BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (product_id, id),
  KEY idx_catalog_product_options_available_order (product_id, available, sort_order, id),
  CONSTRAINT fk_catalog_product_options_product
    FOREIGN KEY (product_id) REFERENCES catalog_products (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS catalog_product_default_options (
  product_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  option_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  sort_order SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  PRIMARY KEY (product_id, option_id),
  CONSTRAINT fk_catalog_product_default_options_option
    FOREIGN KEY (product_id, option_id)
    REFERENCES catalog_product_options (product_id, id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--> statement-breakpoint

CREATE TABLE IF NOT EXISTS catalog_product_images (
  product_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  mime_type VARCHAR(32) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  image_data MEDIUMBLOB NOT NULL,
  size_bytes INT UNSIGNED NOT NULL,
  content_sha256 CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (product_id),
  KEY idx_catalog_product_images_sha (content_sha256),
  CONSTRAINT fk_catalog_product_images_product
    FOREIGN KEY (product_id) REFERENCES catalog_products (id) ON DELETE CASCADE,
  CONSTRAINT chk_catalog_product_images_mime
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  CONSTRAINT chk_catalog_product_images_size
    CHECK (size_bytes >= 1 AND size_bytes <= 5242880)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--> statement-breakpoint

INSERT IGNORE INTO catalog_categories (id, name, sort_order, active) VALUES
  ('combos', 'Combos', 1, TRUE),
  ('clasicas', 'Clásicas', 2, TRUE),
  ('especiales', 'Especiales', 3, TRUE),
  ('bebidas', 'Bebidas', 4, TRUE),
  ('burgers', 'Burgers', 1, TRUE),
  ('papas', 'Papas', 2, TRUE);

--> statement-breakpoint

INSERT IGNORE INTO catalog_category_placements (category_id, placement) VALUES
  ('combos', 'home'),
  ('clasicas', 'home'),
  ('especiales', 'home'),
  ('bebidas', 'home'),
  ('bebidas', 'menu'),
  ('burgers', 'menu'),
  ('papas', 'menu');

--> statement-breakpoint

INSERT IGNORE INTO catalog_products (
  id, name, summary, detail_description, price_cop, image_path,
  available, badge, sort_order, featured_order
) VALUES
  (
    'la-bendita',
    'La Bendita',
    'Cheddar y salsa',
    'Carne de res, cheddar fundido, tocineta, vegetales frescos y salsa secreta BurgerDesk.',
    26900,
    '/images/products/la_bendita.png',
    TRUE,
    'Más vendida',
    1,
    1
  ),
  (
    'doble-pecado',
    'Doble Pecado',
    'Doble carne',
    NULL,
    34900,
    '/images/products/doble_pecado.png',
    TRUE,
    'Doble sabor',
    2,
    NULL
  ),
  (
    'santa-pollo',
    'Santa Pollo',
    'Pollo crispy',
    NULL,
    28900,
    '/images/products/crispy - copia.webp',
    TRUE,
    'Nuevo',
    3,
    NULL
  ),
  (
    'bacon-bendita',
    'Bacon Bendita',
    'Cuádruple tocino',
    NULL,
    34900,
    '/images/products/bacon.png',
    TRUE,
    'Ahorra 10%',
    4,
    NULL
  ),
  (
    'papas-cheddar',
    'Papas cheddar',
    'Medianas · salsa aparte',
    NULL,
    12900,
    '/images/products/cheddar.png',
    TRUE,
    NULL,
    5,
    NULL
  ),
  (
    'combo-gloria',
    'Combo Gloria',
    'Burger, papas y bebida',
    NULL,
    41900,
    '/images/promotions/combo.png',
    TRUE,
    'Ahorra 15%',
    6,
    2
  );

--> statement-breakpoint

INSERT IGNORE INTO catalog_product_categories (product_id, category_id, sort_order) VALUES
  ('la-bendita', 'burgers', 1),
  ('la-bendita', 'clasicas', 2),
  ('doble-pecado', 'burgers', 1),
  ('doble-pecado', 'clasicas', 2),
  ('santa-pollo', 'burgers', 1),
  ('santa-pollo', 'especiales', 2),
  ('bacon-bendita', 'burgers', 1),
  ('bacon-bendita', 'especiales', 2),
  ('papas-cheddar', 'papas', 1),
  ('combo-gloria', 'combos', 1);

--> statement-breakpoint

INSERT IGNORE INTO catalog_product_options (
  product_id, id, name, price_cop, available, sort_order
) VALUES
  ('la-bendita', 'cheddar-extra', 'Cheddar extra', 3500, TRUE, 1),
  ('la-bendita', 'tocineta', 'Tocineta', 4500, TRUE, 2),
  ('la-bendita', 'cebolla', 'Cebolla', 2500, TRUE, 3),
  ('la-bendita', 'salsa-incluida', 'Salsa incluida', 0, TRUE, 4);

--> statement-breakpoint

INSERT IGNORE INTO catalog_product_default_options (product_id, option_id, sort_order) VALUES
  ('la-bendita', 'cheddar-extra', 1),
  ('la-bendita', 'salsa-incluida', 2);
