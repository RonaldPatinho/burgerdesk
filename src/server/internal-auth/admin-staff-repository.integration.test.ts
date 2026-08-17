import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { closeMySqlPool, getMySqlPool } from "../database/mysql";
import {
  AdminStaffRepositoryError,
  createAdminStaffMember,
  listAdminStaffMembers,
  updateAdminStaffMember,
} from "./admin-staff-repository";
import {
  getStaffAccountOverview,
  getStaffSessionByToken,
  InternalAuthRepositoryError,
  loginStaff,
  revokeStaffSessionByToken,
} from "./repository";

const runId = randomUUID().replaceAll("-", "").slice(0, 10);
const username = `personal-${runId}`;
const email = `${username}@burgerdesk.local`;
const updatedUsername = `${username}-editado`;
const duplicateUsername = `personal-dup-${runId}`;
const password = "clave-segura-personal";
let createdUserId: string | null = null;
let duplicateUserId: string | null = null;

after(async () => {
  const pool = getMySqlPool();
  const ids = [createdUserId, duplicateUserId].filter(
    (id): id is string => Boolean(id),
  );
  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(", ");
    await pool.execute(
      `DELETE FROM internal_access_events WHERE user_id IN (${placeholders})`,
      ids,
    );
    await pool.execute(
      `DELETE FROM internal_users WHERE id IN (${placeholders})`,
      ids,
    );
  }
  await closeMySqlPool();
});

test("Administrador crea, edita, desactiva y reactiva Personal sin permitir sesiones obsoletas", async () => {
  const created = await createAdminStaffMember({
    username,
    password,
    fullName: "Personal de integración",
    email,
    role: "caja",
  });
  createdUserId = created.id;
  assert.equal(created.role, "caja");
  assert.equal(created.active, true);

  const listed = await listAdminStaffMembers(runId);
  assert.ok(listed.some((member) => member.id === created.id));

  const firstLogin = await loginStaff({ username, password });
  assert.equal(firstLogin.session.role, "caja");
  assert.ok((await getStaffAccountOverview(created.id)).activeShiftStartedAt);

  const roleUpdated = await updateAdminStaffMember({
    userId: created.id,
    expectedUpdatedAt: created.updatedAt,
    patch: {
      username: updatedUsername,
      fullName: "Personal actualizado",
      role: "caja_cocina",
    },
  });
  assert.equal(roleUpdated.username, updatedUsername);
  assert.equal(roleUpdated.role, "caja_cocina");
  assert.equal(await getStaffSessionByToken(firstLogin.token), null);
  assert.equal(
    (await getStaffAccountOverview(created.id)).activeShiftStartedAt,
    null,
  );

  await assert.rejects(
    loginStaff({ username, password }),
    (error: unknown) =>
      error instanceof InternalAuthRepositoryError &&
      error.code === "INVALID_CREDENTIALS",
  );

  const secondLogin = await loginStaff({
    username: updatedUsername,
    password,
  });
  assert.equal(secondLogin.session.role, "caja_cocina");

  const deactivated = await updateAdminStaffMember({
    userId: created.id,
    expectedUpdatedAt: roleUpdated.updatedAt,
    patch: { active: false },
  });
  assert.equal(deactivated.active, false);
  assert.equal(await getStaffSessionByToken(secondLogin.token), null);
  assert.equal(
    (await getStaffAccountOverview(created.id)).activeShiftStartedAt,
    null,
  );

  await assert.rejects(
    loginStaff({ username: updatedUsername, password }),
    (error: unknown) =>
      error instanceof InternalAuthRepositoryError &&
      error.code === "INVALID_CREDENTIALS",
  );

  const reactivated = await updateAdminStaffMember({
    userId: created.id,
    expectedUpdatedAt: deactivated.updatedAt,
    patch: { active: true },
  });
  assert.equal(reactivated.active, true);

  const finalLogin = await loginStaff({
    username: updatedUsername,
    password,
  });
  assert.equal(finalLogin.session.role, "caja_cocina");
  await revokeStaffSessionByToken(finalLogin.token);
});

test("rechaza duplicados de usuario y versiones obsoletas", async () => {
  const duplicate = await createAdminStaffMember({
    username: duplicateUsername,
    password,
    fullName: "Personal duplicado",
    email: `${duplicateUsername}@burgerdesk.local`,
    role: "cocina",
  });
  duplicateUserId = duplicate.id;

  await assert.rejects(
    createAdminStaffMember({
      username: duplicateUsername,
      password,
      fullName: "Otro Personal",
      email: `otro-${runId}@burgerdesk.local`,
      role: "caja",
    }),
    (error: unknown) =>
      error instanceof AdminStaffRepositoryError &&
      error.code === "USERNAME_ALREADY_EXISTS",
  );

  if (!createdUserId) throw new Error("TEST_STAFF_NOT_CREATED");

  const current = (await listAdminStaffMembers(updatedUsername)).find(
    (member) => member.id === createdUserId,
  );
  if (!current) throw new Error("TEST_STAFF_NOT_FOUND");
  await assert.rejects(
    updateAdminStaffMember({
      userId: createdUserId,
      expectedUpdatedAt: current.updatedAt,
      patch: { username: duplicateUsername },
    }),
    (error: unknown) =>
      error instanceof AdminStaffRepositoryError &&
      error.code === "USERNAME_ALREADY_EXISTS",
  );

  await assert.rejects(
    updateAdminStaffMember({
      userId: createdUserId,
      expectedUpdatedAt: "2020-01-01T00:00:00.000Z",
      patch: { email: duplicate.email },
    }),
    (error: unknown) =>
      error instanceof AdminStaffRepositoryError &&
      error.code === "STALE_STAFF",
  );
});
