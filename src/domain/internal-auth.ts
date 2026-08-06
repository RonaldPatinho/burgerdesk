/**
 * Internal authentication domain — pure logic only.
 *
 * No MySQL, cookies, APIs, or Node-specific modules.
 * Mirrors the structural conventions of `./auth.ts` (client auth).
 */

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const internalRoles = [
  "caja",
  "cocina",
  "caja_cocina",
  "administrador",
] as const;

export type InternalRole = (typeof internalRoles)[number];

/** Roles that may access the Personal flow. */
export const staffRoles = [
  "caja",
  "cocina",
  "caja_cocina",
] as const satisfies readonly InternalRole[];

export type StaffRole = (typeof staffRoles)[number];

/** Role that may access the Administrator flow. */
export const administratorRoles = [
  "administrador",
] as const satisfies readonly InternalRole[];

export type AdministratorRole = (typeof administratorRoles)[number];

export function isInternalRole(value: unknown): value is InternalRole {
  return typeof value === "string" && internalRoles.some((r) => r === value);
}

export function isStaffRole(value: unknown): value is StaffRole {
  return typeof value === "string" && staffRoles.some((r) => r === value);
}

export function isAdministratorRole(
  value: unknown,
): value is AdministratorRole {
  return (
    typeof value === "string" &&
    administratorRoles.some((role) => role === value)
  );
}

// ---------------------------------------------------------------------------
// Username normalisation
// ---------------------------------------------------------------------------

/**
 * Normalises an internal username for comparison and storage.
 *
 * Rules:
 * - trim surrounding whitespace;
 * - lower-case ASCII characters.
 *
 * Returns `null` when the result would be empty.
 */
export function normalizeUsername(raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  return normalized.length > 0 ? normalized : null;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type InternalAuthFieldName =
  | "username"
  | "password"
  | "fullName"
  | "email"
  | "role";

export type InternalAuthFieldErrors = Partial<
  Record<InternalAuthFieldName, string>
>;

export type InternalAuthValidationResult =
  | { valid: true }
  | {
      valid: false;
      errors: InternalAuthFieldErrors;
      firstInvalidField: InternalAuthFieldName;
    };

const USERNAME_MIN = 3;
const USERNAME_MAX = 64;
const PASSWORD_MIN = 8;
const PASSWORD_MAX = 128;
const FULL_NAME_MAX = 120;
const EMAIL_MAX = 254;

const usernamePattern = /^[a-zA-Z0-9._-]+$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function toResult(
  errors: InternalAuthFieldErrors,
): InternalAuthValidationResult {
  const fieldOrder: readonly InternalAuthFieldName[] = [
    "username",
    "password",
    "fullName",
    "email",
    "role",
  ];
  const firstInvalidField = fieldOrder.find((f) => errors[f]);
  return firstInvalidField
    ? { valid: false, errors, firstInvalidField }
    : { valid: true };
}

/**
 * Validates a username string (the raw value from the form).
 *
 * - Required, 3–64 characters.
 * - Only ASCII letters, digits, dots, underscores and hyphens.
 */
export function validateUsername(username: string): InternalAuthFieldErrors {
  const errors: InternalAuthFieldErrors = {};
  const trimmed = username.trim();
  if (!trimmed) {
    errors.username = "Escribe tu nombre de usuario.";
  } else if (trimmed.length < USERNAME_MIN) {
    errors.username = `El usuario debe tener al menos ${USERNAME_MIN} caracteres.`;
  } else if (trimmed.length > USERNAME_MAX) {
    errors.username = `El usuario no puede superar ${USERNAME_MAX} caracteres.`;
  } else if (!usernamePattern.test(trimmed)) {
    errors.username =
      "Usa solo letras, números, puntos, guiones o guiones bajos.";
  }
  return errors;
}

/**
 * Validates a password.
 *
 * - Required, 8–128 characters.
 */
export function validatePassword(password: string): InternalAuthFieldErrors {
  const errors: InternalAuthFieldErrors = {};
  if (!password) {
    errors.password = "Escribe tu contraseña.";
  } else if (password.length < PASSWORD_MIN) {
    errors.password = `Usa al menos ${PASSWORD_MIN} caracteres.`;
  } else if (password.length > PASSWORD_MAX) {
    errors.password = `La contraseña no puede superar ${PASSWORD_MAX} caracteres.`;
  }
  return errors;
}

/**
 * Validates a full name.
 *
 * - Required, max 120 characters.
 */
export function validateFullName(fullName: string): InternalAuthFieldErrors {
  const errors: InternalAuthFieldErrors = {};
  const trimmed = fullName.trim();
  if (!trimmed) {
    errors.fullName = "Escribe el nombre completo.";
  } else if (trimmed.length > FULL_NAME_MAX) {
    errors.fullName = `El nombre no puede superar ${FULL_NAME_MAX} caracteres.`;
  }
  return errors;
}

/**
 * Validates an email address.
 *
 * - Required, max 254 characters, standard email pattern.
 */
export function validateEmail(email: string): InternalAuthFieldErrors {
  const errors: InternalAuthFieldErrors = {};
  const trimmed = email.trim();
  if (!trimmed) {
    errors.email = "Escribe el correo electrónico.";
  } else if (trimmed.length > EMAIL_MAX) {
    errors.email = `El correo no puede superar ${EMAIL_MAX} caracteres.`;
  } else if (!emailPattern.test(trimmed)) {
    errors.email = "Usa un correo con formato nombre@dominio.com.";
  }
  return errors;
}

/**
 * Validates a role value.
 */
export function validateRole(role: string): InternalAuthFieldErrors {
  const errors: InternalAuthFieldErrors = {};
  if (!isInternalRole(role)) {
    errors.role = "El rol indicado no es válido.";
  }
  return errors;
}

// ---------------------------------------------------------------------------
// Composite validators
// ---------------------------------------------------------------------------

/** Validates the fields needed for an internal login form. */
export function validateInternalLogin(input: {
  username: string;
  password: string;
}): InternalAuthValidationResult {
  return toResult({
    ...validateUsername(input.username),
    ...validatePassword(input.password),
  });
}

/** Validates the fields needed to create or update an internal user. */
export function validateInternalUser(input: {
  username: string;
  password: string;
  fullName: string;
  email: string;
  role: string;
}): InternalAuthValidationResult {
  return toResult({
    ...validateUsername(input.username),
    ...validatePassword(input.password),
    ...validateFullName(input.fullName),
    ...validateEmail(input.email),
    ...validateRole(input.role),
  });
}
