export interface SignInInput {
  fullName: string;
  email: string;
  password: string;
  rememberEmail: boolean;
}

export interface RegistrationInput {
  fullName: string;
  email: string;
  password: string;
  termsAccepted: boolean;
}

export interface PasswordResetInput {
  email: string;
}

export type AuthFieldName = "fullName" | "email" | "password" | "terms";

export type AuthFieldErrors = Partial<Record<AuthFieldName, string>>;

export type AuthValidationResult =
  | { valid: true }
  | { valid: false; errors: AuthFieldErrors; firstInvalidField: AuthFieldName };

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateIdentityFields(input: {
  fullName: string;
  email: string;
  password: string;
}): AuthFieldErrors {
  const errors: AuthFieldErrors = {};

  if (!input.fullName.trim()) {
    errors.fullName = "Escribe tu nombre completo.";
  }

  const email = input.email.trim();
  if (!email) {
    errors.email = "Escribe tu correo electrónico.";
  } else if (!emailPattern.test(email)) {
    errors.email = "Usa un correo con formato nombre@dominio.com.";
  }

  if (!input.password) {
    errors.password = "Escribe tu contraseña.";
  } else if (input.password.length < 8) {
    errors.password = "Usa al menos 8 caracteres.";
  }

  return errors;
}

function toValidationResult(errors: AuthFieldErrors): AuthValidationResult {
  const fieldOrder: readonly AuthFieldName[] = [
    "fullName",
    "email",
    "password",
    "terms",
  ];
  const firstInvalidField = fieldOrder.find((field) => errors[field]);

  return firstInvalidField
    ? { valid: false, errors, firstInvalidField }
    : { valid: true };
}

export function validateSignIn(input: SignInInput): AuthValidationResult {
  return toValidationResult(validateIdentityFields(input));
}

export function validateRegistration(
  input: RegistrationInput,
): AuthValidationResult {
  const errors = validateIdentityFields(input);

  if (!input.termsAccepted) {
    errors.terms = "Debes aceptar los términos para crear la cuenta.";
  }

  return toValidationResult(errors);
}

export function validatePasswordReset(
  input: PasswordResetInput,
): AuthValidationResult {
  const email = input.email.trim();
  const errors: AuthFieldErrors = {};

  if (!email) {
    errors.email = "Escribe tu correo electrónico.";
  } else if (!emailPattern.test(email)) {
    errors.email = "Usa un correo con formato nombre@dominio.com.";
  }

  return toValidationResult(errors);
}
