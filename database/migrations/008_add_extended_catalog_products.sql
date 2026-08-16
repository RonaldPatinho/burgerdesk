START TRANSACTION;

--> statement-breakpoint

INSERT INTO catalog_products (
  id, name, summary, detail_description, price_cop, image_path,
  available, badge, sort_order, featured_order
) VALUES
  (
    'triple-bacon',
    'Triple Bacon',
    'Triple carne, cheddar y tocineta',
    'Tres carnes de res, cheddar fundido, tocineta y salsas BurgerDesk.',
    39900,
    '/images/products/triple_bacon.png',
    TRUE,
    NULL,
    9,
    NULL
  ),
  (
    'doble-crispy-pollo',
    'Doble Crispy Pollo',
    'Doble pollo crispy y lechuga',
    'Dos filetes de pollo crispy, lechuga fresca y salsa cremosa.',
    34900,
    '/images/products/doble_crispy_pollo.png',
    TRUE,
    NULL,
    10,
    NULL
  ),
  (
    'doble-crispy-bacon',
    'Doble Crispy Bacon',
    'Doble capa crispy, cheddar y tocineta',
    NULL,
    36900,
    '/images/products/doble_crispy_bacon.png',
    TRUE,
    NULL,
    11,
    NULL
  ),
  (
    'doble-bacon',
    'Doble Bacon',
    'Doble carne, cheddar y tocineta',
    NULL,
    36900,
    '/images/products/doble_bacon.png',
    TRUE,
    NULL,
    12,
    NULL
  ),
  (
    'cheddar-explosiva',
    'Cheddar Explosiva',
    'Carne, tocineta y salsa cheddar',
    NULL,
    31900,
    '/images/products/cheddar_explosiva.png',
    TRUE,
    NULL,
    13,
    NULL
  ),
  (
    'papas-rusticas',
    'Papas Rústicas',
    'Corte clásico con piel',
    NULL,
    9900,
    '/images/products/papas_rusticas.webp',
    TRUE,
    NULL,
    14,
    NULL
  ),
  (
    'papas-rejilla',
    'Papas Rejilla',
    'Corte rejilla sazonado',
    NULL,
    11900,
    '/images/products/papas_rejilla.webp',
    TRUE,
    NULL,
    15,
    NULL
  ),
  (
    'papas-corte-grueso',
    'Papas Corte Grueso',
    'Corte grueso y crujiente',
    NULL,
    10900,
    '/images/products/papas_corte_grueso.webp',
    TRUE,
    NULL,
    16,
    NULL
  ),
  (
    'coca-cola',
    'Coca-Cola',
    'Bebida fría',
    NULL,
    6900,
    '/images/products/coca_cola.png',
    TRUE,
    NULL,
    17,
    NULL
  ),
  (
    'coca-cola-zero',
    'Coca-Cola Zero',
    'Bebida fría sin azúcar',
    NULL,
    6900,
    '/images/products/coca_cola_zero.png',
    TRUE,
    NULL,
    18,
    NULL
  ),
  (
    'agua',
    'Agua',
    'Agua sin gas',
    NULL,
    4900,
    '/images/products/agua.png',
    TRUE,
    NULL,
    19,
    NULL
  ),
  (
    'jugo-naranja',
    'Jugo de Naranja',
    'Jugo de naranja frío',
    NULL,
    7900,
    '/images/products/jugo_naranja.png',
    TRUE,
    NULL,
    20,
    NULL
  );

--> statement-breakpoint

INSERT INTO catalog_product_categories (product_id, category_id, sort_order) VALUES
  ('triple-bacon', 'burgers', 1),
  ('triple-bacon', 'especiales', 2),
  ('doble-crispy-pollo', 'burgers', 1),
  ('doble-crispy-pollo', 'especiales', 2),
  ('doble-crispy-bacon', 'burgers', 1),
  ('doble-crispy-bacon', 'especiales', 2),
  ('doble-bacon', 'burgers', 1),
  ('doble-bacon', 'clasicas', 2),
  ('cheddar-explosiva', 'burgers', 1),
  ('cheddar-explosiva', 'especiales', 2),
  ('papas-rusticas', 'papas', 1),
  ('papas-rejilla', 'papas', 1),
  ('papas-corte-grueso', 'papas', 1),
  ('coca-cola', 'bebidas', 1),
  ('coca-cola-zero', 'bebidas', 1),
  ('agua', 'bebidas', 1),
  ('jugo-naranja', 'bebidas', 1);

--> statement-breakpoint

COMMIT;
