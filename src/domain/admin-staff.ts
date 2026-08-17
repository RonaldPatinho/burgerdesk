import {
  isStaffRole,
  normalizeUsername,
  validateEmail,
  validateFullName,
  validatePassword,
  validateUsername,
  type StaffRole,
} from "./internal-auth";

export interface AdminStaffMember {
  id: string;
  username: string;
  fullName: string;
  email: string;
  role: StaffRole;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminStaffCreateInput {
  username: string;
  password: string;
  fullName: string;
  email: string;
  role: StaffRole;
}

export interface AdminStaffPatch {
  username?: string;
  fullName?: string;
  email?: string;
  role?: StaffRole;
  active?: boolean;
}

export interface AdminStaffUpdateInput {
  userId: string;
  expectedUpdatedAt: string;
  patch: AdminStaffPatch;
}

export class AdminStaffValidationError extends Error {
  constructor(public readonly field: string, message: string) {
    super(message);
    this.name = "AdminStaffValidationError";
  }
}

const createFields = new Set([
  "username",
  "password",
  "fullName",
  "email",
  "role",
]);
const patchFields = new Set(["username", "fullName", "email", "role", "active"]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function throwFirstValidationError(
  errors: Partial<Record<string, string>>,
): never {
  const entry = Object.entries(errors).find(([, message]) => Boolean(message));
  throw new AdminStaffValidationError(
    entry?.[0] ?? "staff",
    entry?.[1] ?? "Los datos del empleado no son válidos.",
  );
}

function normalizeFullName(value: unknown): string {
  if (typeof value !== "string") {
    throw new AdminStaffValidationError("fullName", "El nombre no es válido.");
  }
  const errors = validateFullName(value);
  if (errors.fullName) throwFirstValidationError(errors);
  return value.trim();
}

function normalizeEmailValue(value: unknown): string {
  if (typeof value !== "string") {
    throw new AdminStaffValidationError("email", "El correo no es válido.");
  }
  const errors = validateEmail(value);
  if (errors.email) throwFirstValidationError(errors);
  return value.trim();
}

function normalizeStaffRole(value: unknown): StaffRole {
  if (!isStaffRole(value)) {
    throw new AdminStaffValidationError(
      "role",
      "Selecciona un rol de Personal válido.",
    );
  }
  return value;
}

export function normalizeAdminStaffCreate(value: unknown): AdminStaffCreateInput {
  if (!isRecord(value)) {
    throw new AdminStaffValidationError(
      "staff",
      "Los datos del empleado no son válidos.",
    );
  }

  const unexpected = Object.keys(value).find((field) => !createFields.has(field));
  if (unexpected) {
    throw new AdminStaffValidationError(
      unexpected,
      "El campo no forma parte del alta de Personal.",
    );
  }

  for (const field of createFields) {
    if (value[field] === undefined) {
      throw new AdminStaffValidationError(field, "Completa este campo.");
    }
  }

  if (typeof value.username !== "string") {
    throw new AdminStaffValidationError("username", "El usuario no es válido.");
  }
  const usernameErrors = validateUsername(value.username);
  const normalizedUsername = normalizeUsername(value.username);
  if (usernameErrors.username || !normalizedUsername) {
    throwFirstValidationError(usernameErrors);
  }

  if (typeof value.password !== "string") {
    throw new AdminStaffValidationError(
      "password",
      "La contraseña no es válida.",
    );
  }
  const passwordErrors = validatePassword(value.password);
  if (passwordErrors.password) throwFirstValidationError(passwordErrors);

  return {
    username: value.username.trim(),
    password: value.password,
    fullName: normalizeFullName(value.fullName),
    email: normalizeEmailValue(value.email),
    role: normalizeStaffRole(value.role),
  };
}

export function normalizeAdminStaffUpdate(
  userId: unknown,
  value: unknown,
): AdminStaffUpdateInput {
  if (typeof userId !== "string" || !uuidPattern.test(userId)) {
    throw new AdminStaffValidationError(
      "userId",
      "El identificador del empleado no es válido.",
    );
  }
  if (!isRecord(value)) {
    throw new AdminStaffValidationError(
      "staff",
      "Los cambios del empleado no son válidos.",
    );
  }

  const topLevelFields = new Set(["expectedUpdatedAt", "patch"]);
  const unexpectedTop = Object.keys(value).find(
    (field) => !topLevelFields.has(field),
  );
  if (unexpectedTop) {
    throw new AdminStaffValidationError(
      unexpectedTop,
      "El campo no forma parte de la actualización de Personal.",
    );
  }

  if (
    typeof value.expectedUpdatedAt !== "string" ||
    !Number.isFinite(Date.parse(value.expectedUpdatedAt))
  ) {
    throw new AdminStaffValidationError(
      "expectedUpdatedAt",
      "La versión del empleado no es válida.",
    );
  }
  if (!isRecord(value.patch)) {
    throw new AdminStaffValidationError("patch", "Indica los cambios a guardar.");
  }

  const unexpectedPatch = Object.keys(value.patch).find(
    (field) => !patchFields.has(field),
  );
  if (unexpectedPatch) {
    throw new AdminStaffValidationError(
      unexpectedPatch,
      "El campo no forma parte del perfil editable.",
    );
  }

  const patch: AdminStaffPatch = {};
  if (value.patch.username !== undefined) {
    if (typeof value.patch.username !== "string") {
      throw new AdminStaffValidationError("username", "El usuario no es válido.");
    }
    const usernameErrors = validateUsername(value.patch.username);
    const normalizedUsername = normalizeUsername(value.patch.username);
    if (usernameErrors.username || !normalizedUsername) {
      throwFirstValidationError(usernameErrors);
    }
    patch.username = value.patch.username.trim();
  }
  if (value.patch.fullName !== undefined) {
    patch.fullName = normalizeFullName(value.patch.fullName);
  }
  if (value.patch.email !== undefined) {
    patch.email = normalizeEmailValue(value.patch.email);
  }
  if (value.patch.role !== undefined) {
    patch.role = normalizeStaffRole(value.patch.role);
  }
  if (value.patch.active !== undefined) {
    if (typeof value.patch.active !== "boolean") {
      throw new AdminStaffValidationError("active", "El estado no es válido.");
    }
    patch.active = value.patch.active;
  }

  if (Object.keys(patch).length === 0) {
    throw new AdminStaffValidationError("patch", "Indica al menos un cambio.");
  }

  return {
    userId,
    expectedUpdatedAt: value.expectedUpdatedAt,
    patch,
  };
}
