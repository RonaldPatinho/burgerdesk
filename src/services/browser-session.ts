import type {
  RegistrationInput,
  SignInInput,
} from "../domain/auth";
import {
  validatePasswordReset,
  validateRegistration,
  validateSignIn,
} from "../domain/auth";
import type { ClientSession } from "../domain/models";
import {
  CLIENT_STORAGE_VERSION,
  clientStorageKeys,
  type StoredSessionState,
} from "../domain/persistence";
import { validateStoredSession } from "../domain/validation";
import type { SessionService } from "./contracts";
import { provisionalClient } from "../data/provisional";

export interface SessionStoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface LocalStorageSessionOptions {
  getStorage?: () => SessionStoragePort;
  createId?: () => string;
  now?: () => string;
  wait?: () => Promise<void>;
  requestAuth?: (
    action: "signin" | "register",
    input: SignInInput | RegistrationInput,
  ) => Promise<ClientSession>;
  requestLogout?: () => Promise<void>;
}

export class BrowserSessionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BrowserSessionError";
  }
}

function getBrowserStorage(): SessionStoragePort {
  if (typeof window === "undefined") {
    throw new Error("La sesión provisional solo está disponible en el navegador.");
  }

  return window.localStorage;
}

function createBrowserId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function waitForSimulation(): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, 300));
}

export class LocalStorageSessionService implements SessionService {
  private readonly getStorage: () => SessionStoragePort;
  private readonly createId: () => string;
  private readonly now: () => string;
  private readonly wait: () => Promise<void>;
  private readonly requestAuth?: LocalStorageSessionOptions["requestAuth"];
  private readonly requestLogout?: LocalStorageSessionOptions["requestLogout"];

  constructor(options: LocalStorageSessionOptions = {}) {
    this.getStorage = options.getStorage ?? getBrowserStorage;
    this.createId = options.createId ?? createBrowserId;
    this.now = options.now ?? (() => new Date().toISOString());
    this.wait = options.wait ?? waitForSimulation;
    this.requestAuth = options.requestAuth;
    this.requestLogout = options.requestLogout;
  }

  async getSession(): Promise<ClientSession | null> {
    const storage = this.getStorage();
    const serialized = storage.getItem(clientStorageKeys.session);

    if (!serialized) {
      return null;
    }

    try {
      const parsed: unknown = JSON.parse(serialized);
      const result = validateStoredSession(parsed);

      if (result.success) {
        return result.data.session;
      }
    } catch {
      // El bloque inferior elimina solo el dato de sesión de BurgerDesk.
    }

    storage.removeItem(clientStorageKeys.session);
    return null;
  }

  async signIn(input: SignInInput): Promise<ClientSession> {
    if (!validateSignIn(input).valid) {
      throw new Error("Los datos de acceso no son válidos.");
    }

    const session = this.requestAuth
      ? await this.requestAuth("signin", input)
      : {
          kind: "client" as const,
          sessionId: this.createId(),
          clientId: provisionalClient.id,
          startedAt: this.now(),
        };

    this.saveSession(session);
    return session;
  }

  async register(input: RegistrationInput): Promise<ClientSession> {
    if (!validateRegistration(input).valid) {
      throw new Error("Los datos de registro no son válidos.");
    }

    const session = this.requestAuth
      ? await this.requestAuth("register", input)
      : {
          kind: "client" as const,
          sessionId: this.createId(),
          clientId: `client-local-${this.createId()}`,
          startedAt: this.now(),
        };

    this.saveSession(session);
    return session;
  }

  async continueAsGuest(): Promise<ClientSession> {
    await this.wait();

    const session: ClientSession = {
      kind: "guest",
      sessionId: this.createId(),
      startedAt: this.now(),
    };

    this.saveSession(session);
    return session;
  }

  async requestPasswordReset(email: string): Promise<void> {
    if (!validatePasswordReset({ email }).valid) {
      throw new Error("El correo de recuperación no es válido.");
    }

    await this.wait();
  }

  async signOut(): Promise<void> {
    if (this.requestLogout) {
      await this.requestLogout();
    }
    this.getStorage().removeItem(clientStorageKeys.session);
  }

  private saveSession(session: ClientSession): void {
    const state: StoredSessionState = {
      version: CLIENT_STORAGE_VERSION,
      session,
    };

    this.getStorage().setItem(clientStorageKeys.session, JSON.stringify(state));
  }
}

async function readServerResponse(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function browserRequestAuth(
  action: "signin" | "register",
  input: SignInInput | RegistrationInput,
): Promise<ClientSession> {
  const response = await fetch(
    action === "signin" ? "/api/auth/login" : "/api/auth/register",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        action === "signin"
          ? { email: input.email, password: input.password }
          : {
              fullName: input.fullName,
              email: input.email,
              password: input.password,
            },
      ),
    },
  );
  const value = await readServerResponse(response);
  if (!response.ok) {
    throw new BrowserSessionError(
      isRecord(value) && typeof value.message === "string"
        ? value.message
        : "No fue posible completar el acceso.",
    );
  }
  const result = validateStoredSession({
    version: CLIENT_STORAGE_VERSION,
    session: isRecord(value) ? value.session : null,
  });
  if (!result.success || result.data.session === null) {
    throw new BrowserSessionError("El servidor devolvió una sesión inválida.");
  }
  return result.data.session;
}

async function browserRequestLogout(): Promise<void> {
  const response = await fetch("/api/auth/logout", { method: "POST" });
  if (!response.ok) {
    throw new BrowserSessionError("No fue posible cerrar la sesión.");
  }
}

export const browserSessionService = new LocalStorageSessionService({
  requestAuth: browserRequestAuth,
  requestLogout: browserRequestLogout,
});
