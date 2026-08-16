import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeMySqlPool } from "../database/mysql";
import { createAdministratorReportExportResponse } from "./report-export";

after(closeMySqlPool);

test("protege la exportación y rechaza períodos ajenos", async () => {
  const unauthorized = await createAdministratorReportExportResponse({
    session: null,
    periodKind: "day",
  });
  const invalid = await createAdministratorReportExportResponse({
    session: { userId: "admin-prueba" },
    periodKind: "year",
  });
  assert.equal(unauthorized.status, 401);
  assert.equal(invalid.status, 400);
});

test("entrega CSV UTF-8 autorizado con nombre y encabezados", async () => {
  const response = await createAdministratorReportExportResponse({
    session: { userId: "admin-prueba" },
    periodKind: "day",
    now: new Date("2026-08-16T18:30:00.000Z"),
  });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "text/csv; charset=utf-8");
  assert.equal(
    response.headers.get("content-disposition"),
    'attachment; filename="burgerdesk-reporte-dia-2026-08-16.csv"',
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  assert.deepEqual([...bytes.slice(0, 3)], [0xef, 0xbb, 0xbf]);
  const csv = new TextDecoder().decode(bytes);
  assert.match(csv, /seccion;periodo;clave;etiqueta;ventas_cop/);
  assert.ok(!csv.includes("$"));
});
