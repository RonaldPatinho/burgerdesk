import assert from "node:assert/strict";
import { after, test } from "node:test";
import { closeMySqlPool } from "../database/mysql";
import {
  getAdminBusinessSettingsResponse,
  updateAdminBusinessSettingsResponse,
} from "./admin-response";

after(closeMySqlPool);

test("autoriza la lectura y expone conflicto para una versión obsoleta", async () => {
  const session = { userId: "administrador-prueba" };
  const getResponse = await getAdminBusinessSettingsResponse(session);
  assert.equal(getResponse.status, 200);
  const body = (await getResponse.json()) as {
    settings?: { storeId?: string; timeZone?: string };
  };
  assert.equal(body.settings?.storeId, "sede-centro");
  assert.equal(body.settings?.timeZone, "America/Caracas");

  const staleResponse = await updateAdminBusinessSettingsResponse(
    new Request("http://localhost/api/administrador/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        expectedUpdatedAt: "2000-01-01T00:00:00.000Z",
        patch: { customerMessage: "No debe persistirse" },
      }),
    }),
    session,
  );
  assert.equal(staleResponse.status, 409);
});
