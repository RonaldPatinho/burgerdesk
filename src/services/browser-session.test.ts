import assert from "node:assert/strict";
import test from "node:test";

import { provisionalClient } from "../data/provisional";
import { CLIENT_STORAGE_VERSION, clientStorageKeys } from "../domain/persistence";
import {
  LocalStorageSessionService,
  type SessionStoragePort,
} from "./browser-session";

class MemoryStorage implements SessionStoragePort {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }
}

function createService(storage: MemoryStorage) {
  let id = 0;

  return new LocalStorageSessionService({
    getStorage: () => storage,
    createId: () => `test-id-${++id}`,
    now: () => "2026-08-04T12:00:00-04:00",
    wait: async () => undefined,
  });
}

test("el acceso persiste solo la sesión versionada y nunca las credenciales", async () => {
  const storage = new MemoryStorage();
  const service = createService(storage);

  const session = await service.signIn({
    email: provisionalClient.email,
    password: "burgerdesk-demo",
    rememberEmail: true,
  });
  const serialized = storage.getItem(clientStorageKeys.session);

  assert.equal(session.kind, "client");
  assert.ok(serialized);
  assert.doesNotMatch(serialized, /burgerdesk-demo/);
  assert.doesNotMatch(serialized, /gabriel@gmail[.]com/);
  assert.doesNotMatch(serialized, /Gabriel Duarte/);
  assert.deepEqual(JSON.parse(serialized), {
    version: CLIENT_STORAGE_VERSION,
    session: {
      kind: "client",
      sessionId: "test-id-1",
      clientId: provisionalClient.id,
      startedAt: "2026-08-04T12:00:00-04:00",
    },
  });
  assert.deepEqual(await service.getSession(), session);
});

test("el registro y el invitado generan sesiones locales diferenciadas y aisladas", async () => {
  const storage = new MemoryStorage();
  const service = createService(storage);

  const registered = await service.register({
    fullName: "Cliente Demo",
    email: "cliente@example.com",
    password: "password-demo",
    termsAccepted: true,
  });
  assert.deepEqual(registered, {
    kind: "client",
    sessionId: "test-id-1",
    clientId: "client-local-test-id-2",
    startedAt: "2026-08-04T12:00:00-04:00",
  });

  storage.setItem(clientStorageKeys.cart, "carrito-de-la-cuenta");
  storage.setItem(clientStorageKeys.checkout, "checkout-de-la-cuenta");

  const guest = await service.continueAsGuest();
  assert.deepEqual(guest, {
    kind: "guest",
    sessionId: "test-id-3",
    startedAt: "2026-08-04T12:00:00-04:00",
  });
  assert.deepEqual(await service.getSession(), guest);
  assert.equal(storage.getItem(clientStorageKeys.cart), null);
  assert.equal(storage.getItem(clientStorageKeys.checkout), null);
});

test("una sesión corrupta elimina solo la clave de sesión de BurgerDesk", async () => {
  const storage = new MemoryStorage();
  const service = createService(storage);
  storage.setItem(clientStorageKeys.session, "{json-incompleto");
  storage.setItem("otra-aplicacion", "conservar");

  assert.equal(await service.getSession(), null);
  assert.equal(storage.getItem(clientStorageKeys.session), null);
  assert.equal(storage.getItem("otra-aplicacion"), "conservar");
});

test("cerrar sesión elimina la sesión y el estado activo de compra", async () => {
  const storage = new MemoryStorage();
  const service = createService(storage);
  await service.continueAsGuest();
  storage.setItem(clientStorageKeys.cart, "carrito");
  storage.setItem(clientStorageKeys.checkout, "checkout");
  storage.setItem(clientStorageKeys.orders, "pedidos-conservados");
  storage.setItem("otra-aplicacion", "conservar");

  await service.signOut();

  assert.equal(storage.getItem(clientStorageKeys.session), null);
  assert.equal(storage.getItem(clientStorageKeys.cart), null);
  assert.equal(storage.getItem(clientStorageKeys.checkout), null);
  assert.equal(storage.getItem(clientStorageKeys.orders), "pedidos-conservados");
  assert.equal(storage.getItem("otra-aplicacion"), "conservar");
});

test("una cuenta nueva no hereda el carrito de la sesión anterior", async () => {
  const storage = new MemoryStorage();
  let account = 0;
  const service = new LocalStorageSessionService({
    getStorage: () => storage,
    now: () => "2026-08-04T12:00:00-04:00",
    requestAuth: async () => ({
      kind: "client",
      sessionId: `session-${++account}`,
      clientId: `client-${account}`,
      startedAt: "2026-08-04T12:00:00-04:00",
    }),
  });

  await service.signIn({
    email: "cliente-a@example.com",
    password: "password-demo",
    rememberEmail: false,
  });
  storage.setItem(clientStorageKeys.cart, "carrito-del-cliente-a");
  storage.setItem(clientStorageKeys.checkout, "checkout-del-cliente-a");

  const nextSession = await service.signIn({
    email: "cliente-b@example.com",
    password: "password-demo",
    rememberEmail: false,
  });

  assert.equal(nextSession.kind, "client");
  assert.equal(nextSession.kind === "client" ? nextSession.clientId : null, "client-2");
  assert.equal(storage.getItem(clientStorageKeys.cart), null);
  assert.equal(storage.getItem(clientStorageKeys.checkout), null);
});
