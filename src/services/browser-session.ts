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

  constructor(options: LocalStorageSessionOptions = {}) {
    this.getStorage = options.getStorage ?? getBrowserStorage;
    this.createId = options.createId ?? createBrowserId;
    this.now = options.now ?? (() => new Date().toISOString());
    this.wait = options.wait ?? waitForSimulation;
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

    await this.wait();

    const session: ClientSession = {
      kind: "client",
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

    await this.wait();

    const session: ClientSession = {
      kind: "client",
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

export const browserSessionService = new LocalStorageSessionService();
