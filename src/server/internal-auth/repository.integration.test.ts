import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { hashPassword } from "../auth/password";
import {
  closeMySqlPool,
  getMySqlPool,
} from "../database/mysql";
import {
  getAdministratorSessionByToken,
  getStaffSessionByToken,
  InternalAuthRepositoryError,
  loginAdministrator,
  loginStaff,
  revokeInternalSessionByToken,
} from "./repository";

const runId = randomUUID();
const adminUserId = randomUUID();
const staffUserId = randomUUID();
const adminUsername = `admin-${runId}`;
const staffUsername = `staff-${runId}`;
const password = "clave-administrativa-segura";

after(async () => {
  const pool = getMySqlPool();
  await pool.execute(
    "DELETE FROM internal_access_events WHERE user_id IN (?, ?)",
    [adminUserId, staffUserId],
  );
  await pool.execute(
    "DELETE FROM internal_users WHERE id IN (?, ?)",
    [adminUserId, staffUserId],
  );
  await closeMySqlPool();
});

test("autoriza administrador, rechaza Personal y conserva separación de sesiones", async () => {
  const passwordHash = await hashPassword(password);
  await getMySqlPool().execute(
    `INSERT INTO internal_users (
      id, username, username_normalized, full_name, email,
      email_normalized, password_hash, role, active
    ) VALUES
      (?, ?, ?, ?, ?, ?, ?, 'administrador', TRUE),
      (?, ?, ?, ?, ?, ?, ?, 'caja', TRUE)`,
    [
      adminUserId,
      adminUsername,
      adminUsername,
      "Administración de prueba",
      `${adminUsername}@burgerdesk.local`,
      `${adminUsername}@burgerdesk.local`,
      passwordHash,
      staffUserId,
      staffUsername,
      staffUsername,
      "Personal de prueba",
      `${staffUsername}@burgerdesk.local`,
      `${staffUsername}@burgerdesk.local`,
      passwordHash,
    ],
  );

  const administratorLogin = await loginAdministrator({
    username: adminUsername,
    password,
  });
  assert.equal(administratorLogin.session.role, "administrador");
  assert.equal(
    (await getAdministratorSessionByToken(administratorLogin.token))?.userId,
    adminUserId,
  );
  assert.equal(
    await getStaffSessionByToken(administratorLogin.token),
    null,
  );

  await assert.rejects(
    loginAdministrator({
      username: staffUsername,
      password,
    }),
    (error: unknown) =>
      error instanceof InternalAuthRepositoryError &&
      error.code === "NOT_AUTHORIZED",
  );

  const staffLogin = await loginStaff({
    username: staffUsername,
    password,
  });
  assert.equal(staffLogin.session.role, "caja");
  assert.equal(
    await getAdministratorSessionByToken(staffLogin.token),
    null,
  );

  await revokeInternalSessionByToken(administratorLogin.token);
  assert.equal(
    await getAdministratorSessionByToken(administratorLogin.token),
    null,
  );

  await revokeInternalSessionByToken(staffLogin.token);
});
