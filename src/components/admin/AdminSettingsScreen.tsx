"use client";

import { Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type {
  BusinessServiceStatus,
  BusinessSettings,
} from "@/domain/business-settings";
import { Button, Dialog, Feedback } from "@/components/ui";
import styles from "./AdminSettingsScreen.module.css";

type SettingsField =
  | "businessName"
  | "openingTime"
  | "closingTime"
  | "serviceStatus"
  | "customerMessage"
  | "digitalMenuEnabled"
  | "onlinePaymentsEnabled"
  | "newOrderNotificationsEnabled"
  | "expectedUpdatedAt"
  | "settings";

type SettingsErrors = Partial<Record<SettingsField, string>>;

type SettingsDraft = Omit<
  BusinessSettings,
  "storeId" | "timeZone" | "updatedAt"
>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBusinessSettings(value: unknown): value is BusinessSettings {
  return (
    isRecord(value) &&
    typeof value.storeId === "string" &&
    typeof value.businessName === "string" &&
    typeof value.openingTime === "string" &&
    typeof value.closingTime === "string" &&
    (value.serviceStatus === "open" || value.serviceStatus === "closed") &&
    typeof value.customerMessage === "string" &&
    typeof value.digitalMenuEnabled === "boolean" &&
    typeof value.onlinePaymentsEnabled === "boolean" &&
    typeof value.newOrderNotificationsEnabled === "boolean" &&
    typeof value.timeZone === "string" &&
    typeof value.updatedAt === "string"
  );
}

function responseMessage(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.message === "string"
    ? value.message
    : fallback;
}

function responseErrors(value: unknown): SettingsErrors {
  if (!isRecord(value) || !isRecord(value.errors)) return {};
  const errors: SettingsErrors = {};
  for (const field of [
    "businessName",
    "openingTime",
    "closingTime",
    "serviceStatus",
    "customerMessage",
    "digitalMenuEnabled",
    "onlinePaymentsEnabled",
    "newOrderNotificationsEnabled",
    "expectedUpdatedAt",
    "settings",
  ] as const) {
    const message = value.errors[field];
    if (typeof message === "string") errors[field] = message;
  }
  return errors;
}

function draftFromSettings(settings: BusinessSettings): SettingsDraft {
  return {
    businessName: settings.businessName,
    openingTime: settings.openingTime,
    closingTime: settings.closingTime,
    serviceStatus: settings.serviceStatus,
    customerMessage: settings.customerMessage,
    digitalMenuEnabled: settings.digitalMenuEnabled,
    onlinePaymentsEnabled: settings.onlinePaymentsEnabled,
    newOrderNotificationsEnabled: settings.newOrderNotificationsEnabled,
  };
}

export function AdminSettingsScreen() {
  const [settings, setSettings] = useState<BusinessSettings | null>(null);
  const [draft, setDraft] = useState<SettingsDraft | null>(null);
  const [errors, setErrors] = useState<SettingsErrors>({});
  const [loadError, setLoadError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const [staleConflict, setStaleConflict] = useState(false);
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const savingRef = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    async function loadSettings() {
      setLoading(true);
      setLoadError("");
      try {
        const response = await fetch("/api/administrador/settings", {
          credentials: "same-origin",
          cache: "no-store",
          signal: controller.signal,
        });
        const value: unknown = await response.json().catch(() => null);
        if (
          !response.ok ||
          !isRecord(value) ||
          !isBusinessSettings(value.settings)
        ) {
          throw new Error(
            responseMessage(
              value,
              "No fue posible consultar la configuración del local.",
            ),
          );
        }
        setSettings(value.settings);
        setDraft(draftFromSettings(value.settings));
        setErrors({});
      } catch (error: unknown) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSettings(null);
        setDraft(null);
        setLoadError(
          error instanceof Error
            ? error.message
            : "No fue posible consultar la configuración del local.",
        );
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void loadSettings();
    return () => controller.abort();
  }, [reloadKey]);

  function updateDraft<K extends keyof SettingsDraft>(
    field: K,
    value: SettingsDraft[K],
  ) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSuccess("");
  }

  function validate(): boolean {
    if (!draft) return false;
    const nextErrors: SettingsErrors = {};
    const name = draft.businessName.trim();
    if (name.length < 2 || name.length > 120) {
      nextErrors.businessName = "El nombre debe tener entre 2 y 120 caracteres.";
    }
    if (!/^\d{2}:\d{2}$/.test(draft.openingTime)) {
      nextErrors.openingTime = "Selecciona una hora de apertura válida.";
    }
    if (!/^\d{2}:\d{2}$/.test(draft.closingTime)) {
      nextErrors.closingTime = "Selecciona una hora de cierre válida.";
    } else if (draft.openingTime === draft.closingTime) {
      nextErrors.closingTime = "La hora de cierre debe ser distinta de la apertura.";
    }
    if (draft.customerMessage.trim().length > 500) {
      nextErrors.customerMessage = "El mensaje debe tener como máximo 500 caracteres.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      window.requestAnimationFrame(() => nameRef.current?.focus());
      return false;
    }
    return true;
  }

  function openConfirmation() {
    if (!validate() || savingRef.current) return;
    setDialogError("");
    setStaleConflict(false);
    setConfirmOpen(true);
  }

  async function saveSettings() {
    if (!settings || !draft || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setDialogError("");
    setStaleConflict(false);
    setSuccess("");
    try {
      const response = await fetch("/api/administrador/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({
          expectedUpdatedAt: settings.updatedAt,
          patch: {
            ...draft,
            businessName: draft.businessName.trim(),
            customerMessage: draft.customerMessage.trim(),
          },
        }),
      });
      const value: unknown = await response.json().catch(() => null);
      if (
        !response.ok ||
        !isRecord(value) ||
        !isBusinessSettings(value.settings)
      ) {
        setErrors(responseErrors(value));
        if (response.status === 409) setStaleConflict(true);
        throw new Error(
          responseMessage(value, "No fue posible guardar la configuración."),
        );
      }
      setSettings(value.settings);
      setDraft(draftFromSettings(value.settings));
      setErrors({});
      setConfirmOpen(false);
      setSuccess("Configuración guardada correctamente.");
    } catch (error: unknown) {
      setDialogError(
        error instanceof Error
          ? error.message
          : "No fue posible guardar la configuración.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <main id="contenido-principal" className={styles.main}>
      <header className={styles.heading}>
        <h1>Ajustes</h1>
        <p>Datos del local</p>
      </header>

      {loading ? (
        <Feedback
          variant="loading"
          title="Cargando configuración"
          description="Consultando los datos operativos del local."
        />
      ) : null}

      {!loading && loadError ? (
        <Feedback
          variant="error"
          title="No pudimos cargar los ajustes"
          description={loadError}
          action={
            <Button type="button" onClick={() => setReloadKey((key) => key + 1)}>
              Reintentar
            </Button>
          }
        />
      ) : null}

      {draft ? (
        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            openConfirmation();
          }}
        >
          {success ? (
            <p className={styles.success} role="status">
              <Check aria-hidden="true" />
              {success}
            </p>
          ) : null}

          <label className={styles.field}>
            <span>Nombre del negocio</span>
            <span className={styles.inputFrame}>
              <input
                ref={nameRef}
                name="businessName"
                value={draft.businessName}
                maxLength={120}
                disabled={saving}
                aria-invalid={Boolean(errors.businessName) || undefined}
                aria-describedby={errors.businessName ? "business-name-error" : undefined}
                onChange={(event) => updateDraft("businessName", event.currentTarget.value)}
              />
            </span>
            {errors.businessName ? (
              <small id="business-name-error" className={styles.error} role="alert">
                {errors.businessName}
              </small>
            ) : null}
          </label>

          <fieldset className={styles.hours}>
            <legend>Horario de atención</legend>
            <div className={styles.hourGrid}>
              <label>
                <span>Apertura</span>
                <span className={styles.inputFrame}>
                  <input
                    type="time"
                    name="openingTime"
                    value={draft.openingTime}
                    disabled={saving}
                    aria-invalid={Boolean(errors.openingTime) || undefined}
                    aria-describedby={errors.openingTime ? "opening-time-error" : undefined}
                    onChange={(event) => updateDraft("openingTime", event.currentTarget.value)}
                  />
                </span>
                {errors.openingTime ? (
                  <small id="opening-time-error" className={styles.error} role="alert">
                    {errors.openingTime}
                  </small>
                ) : null}
              </label>
              <label>
                <span>Cierre</span>
                <span className={styles.inputFrame}>
                  <input
                    type="time"
                    name="closingTime"
                    value={draft.closingTime}
                    disabled={saving}
                    aria-invalid={Boolean(errors.closingTime) || undefined}
                    aria-describedby={errors.closingTime ? "closing-time-error" : undefined}
                    onChange={(event) => updateDraft("closingTime", event.currentTarget.value)}
                  />
                </span>
                {errors.closingTime ? (
                  <small id="closing-time-error" className={styles.error} role="alert">
                    {errors.closingTime}
                  </small>
                ) : null}
              </label>
            </div>
          </fieldset>

          <label className={styles.field}>
            <span>Estado del servicio</span>
            <select
              name="serviceStatus"
              value={draft.serviceStatus}
              disabled={saving}
              onChange={(event) =>
                updateDraft(
                  "serviceStatus",
                  event.currentTarget.value as BusinessServiceStatus,
                )
              }
            >
              <option value="open">Abierto · Recibiendo pedidos</option>
              <option value="closed">Cerrado · Sin nuevos pedidos</option>
            </select>
          </label>

          <label className={styles.field}>
            <span>Mensaje para clientes</span>
            <textarea
              name="customerMessage"
              value={draft.customerMessage}
              maxLength={500}
              rows={3}
              disabled={saving}
              aria-invalid={Boolean(errors.customerMessage) || undefined}
              aria-describedby={
                errors.customerMessage
                  ? "customer-message-count customer-message-error"
                  : "customer-message-count"
              }
              onChange={(event) => updateDraft("customerMessage", event.currentTarget.value)}
            />
            <small id="customer-message-count" className={styles.counter}>
              {draft.customerMessage.length}/500
            </small>
            {errors.customerMessage ? (
              <small id="customer-message-error" className={styles.error} role="alert">
                {errors.customerMessage}
              </small>
            ) : null}
          </label>

          <fieldset className={styles.options}>
            <legend>Opciones</legend>
            <SettingsToggle
              label="Activar menú digital"
              name="digitalMenuEnabled"
              checked={draft.digitalMenuEnabled}
              disabled={saving}
              onChange={(checked) => updateDraft("digitalMenuEnabled", checked)}
            />
            <SettingsToggle
              label="Aceptar pagos en línea"
              name="onlinePaymentsEnabled"
              checked={draft.onlinePaymentsEnabled}
              disabled={saving}
              onChange={(checked) => updateDraft("onlinePaymentsEnabled", checked)}
            />
            <SettingsToggle
              label="Notificar pedidos nuevos"
              name="newOrderNotificationsEnabled"
              checked={draft.newOrderNotificationsEnabled}
              disabled={saving}
              onChange={(checked) =>
                updateDraft("newOrderNotificationsEnabled", checked)
              }
            />
          </fieldset>

          <Button
            type="submit"
            fullWidth
            leadingIcon={<Check />}
            loading={saving}
            loadingLabel="Guardando"
          >
            Guardar cambios
          </Button>
        </form>
      ) : null}

      <Dialog
        open={confirmOpen}
        onClose={() => {
          if (!savingRef.current) setConfirmOpen(false);
        }}
        title="Configuración modificada"
        description="Confirma los cambios antes de aplicarlos al local."
        closeLabel="Cerrar confirmación"
        initialFocusSelector="[data-settings-cancel]"
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              data-settings-cancel
              disabled={saving}
              onClick={() => setConfirmOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              loading={saving}
              loadingLabel="Guardando"
              onClick={() => void saveSettings()}
            >
              Confirmar
            </Button>
          </>
        }
      >
        <div className={styles.dialogContent}>
          {dialogError ? (
            <p className={styles.dialogError} role="alert">
              {dialogError}
            </p>
          ) : null}
          {staleConflict ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setConfirmOpen(false);
                setReloadKey((key) => key + 1);
              }}
            >
              Cargar datos actuales
            </Button>
          ) : null}
          <p>
            El menú, los pagos y los avisos respetarán esta configuración cuando
            se complete el guardado.
          </p>
        </div>
      </Dialog>
    </main>
  );
}

function SettingsToggle({
  label,
  name,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  name: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.switchRow}>
      <span>{label}</span>
      <span className={styles.switchControl}>
        <span>{checked ? "ON" : "OFF"}</span>
        <input
          type="checkbox"
          name={name}
          checked={checked}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.checked)}
        />
        <span className={styles.switchTrack} aria-hidden="true">
          <span />
        </span>
      </span>
    </label>
  );
}
