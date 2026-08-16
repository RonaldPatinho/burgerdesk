import assert from "node:assert/strict";
import test from "node:test";
import {
  nextCarouselPage,
  paginateItems,
  previousCarouselPage,
  resolveCarouselPage,
} from "./product-carousel-pagination";

test("pagina el catálogo desktop en grupos de seis", () => {
  const productIds = Array.from({ length: 20 }, (_, index) => `product-${index + 1}`);
  const pages = paginateItems(productIds, 6);

  assert.deepEqual(
    pages.map((page) => page.length),
    [6, 6, 6, 2],
  );
  assert.deepEqual(pages[0], productIds.slice(0, 6));
  assert.deepEqual(pages[3], productIds.slice(18));
});

test("pagina el menú mobile y tablet en grupos de cuatro", () => {
  const productIds = Array.from({ length: 10 }, (_, index) => `product-${index + 1}`);
  const pages = paginateItems(productIds, 4);

  assert.deepEqual(
    pages.map((page) => page.length),
    [4, 4, 2],
  );
  assert.deepEqual(pages[0], productIds.slice(0, 4));
  assert.deepEqual(pages[2], productIds.slice(8));
});

test("reinicia y limita la página al cambiar filtro, búsqueda o resultados", () => {
  assert.equal(
    resolveCarouselPage({ signature: "burgers:", page: 2 }, "bebidas:", 1),
    0,
  );
  assert.equal(
    resolveCarouselPage({ signature: "all:doble", page: 3 }, "all:doble", 2),
    1,
  );
  assert.equal(
    resolveCarouselPage({ signature: "all:", page: 2 }, "all:", 0),
    0,
  );
});

test("la navegación anterior y siguiente es circular", () => {
  assert.equal(previousCarouselPage(0, 4), 3);
  assert.equal(previousCarouselPage(2, 4), 1);
  assert.equal(nextCarouselPage(3, 4), 0);
  assert.equal(nextCarouselPage(1, 4), 2);
  assert.equal(nextCarouselPage(0, 1), 0);
});
