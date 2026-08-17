"use client";

import {
  Pencil,
  Search,
  ShieldCheck,
  UserCheck,
  UserPlus,
  UserX,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import type { AdminStaffMember } from "@/domain/admin-staff";
import { staffRoleLabel, type StaffRole } from "@/domain/internal-auth";
import { Button, Dialog, Field } from "@/components/ui";
import styles from "./AdminStaffScreen.module.css";

type CreateDraft = {
  fullName: string;
  username: string;
  email: string;
  password: string;
  role: StaffRole;
};

type EditDraft = {
  fullName: string;
  username: string;
  email: string;
  role: StaffRole;
};

type FormErrors = Partial<Record<keyof CreateDraft | "staff", string>>;

const emptyCreateDraft: CreateDraft = {
  fullName: "",
  username: "",
  email: "",
  password: "",
  role: "caja",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAdminStaffMember(value: unknown): value is AdminStaffMember {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    typeof value.username === "string" &&
    typeof value.fullName === "string" &&
    typeof value.email === "string" &&
    (value.role === "caja" ||
      value.role === "cocina" ||
      value.role === "caja_cocina") &&
    typeof value.active === "boolean" &&
    typeof value.updatedAt === "string"
  );
}

function responseMessage(value: unknown, fallback: string): string {
  return isRecord(value) && typeof value.message === "string"
    ? value.message
    : fallback;
}

function responseErrors(value: unknown): FormErrors {
  if (!isRecord(value) || !isRecord(value.errors)) return {};
  const errors: FormErrors = {};
  for (const field of [
    "fullName",
    "username",
    "email",
    "password",
    "role",
    "staff",
  ] as const) {
    const message = value.errors[field];
    if (typeof message === "string") errors[field] = message;
  }
  return errors;
}

function sortStaff(staff: readonly AdminStaffMember[]): AdminStaffMember[] {
  return [...staff].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1;
    return a.fullName.localeCompare(b.fullName, "es", { sensitivity: "base" });
  });
}

export function AdminStaffScreen({
  initialStaff,
  initialSearch,
}: {
  initialStaff: readonly AdminStaffMember[];
  initialSearch: string;
}) {
  const [staff, setStaff] = useState(() => sortStaff(initialStaff));
  const [search, setSearch] = useState(initialSearch);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<AdminStaffMember | null>(null);
  const [statusTarget, setStatusTarget] = useState<AdminStaffMember | null>(null);
  const [createDraft, setCreateDraft] =
    useState<CreateDraft>(emptyCreateDraft);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [feedback, setFeedback] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const pendingRef = useRef(false);

  const filteredStaff = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("es");
    if (!query) return staff;
    return staff.filter((member) =>
      [
        member.fullName,
        member.username,
        member.email,
        staffRoleLabel(member.role),
      ]
        .join(" ")
        .toLocaleLowerCase("es")
        .includes(query),
    );
  }, [search, staff]);

  function upsertMember(member: AdminStaffMember) {
    setStaff((current) =>
      sortStaff([
        ...current.filter((item) => item.id !== member.id),
        member,
      ]),
    );
  }

  function openCreate() {
    setCreateDraft(emptyCreateDraft);
    setErrors({});
    setFeedback(null);
    setCreateOpen(true);
  }

  function openEdit(member: AdminStaffMember) {
    setEditTarget(member);
    setEditDraft({
      fullName: member.fullName,
      username: member.username,
      email: member.email,
      role: member.role,
    });
    setErrors({});
    setFeedback(null);
  }

  async function createMember() {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setSaving(true);
    setErrors({});
    setFeedback(null);
    try {
      const response = await fetch("/api/administrador/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify(createDraft),
      });
      const value: unknown = await response.json().catch(() => null);
      const created = isRecord(value) ? value.staff : null;
      if (!response.ok || !isAdminStaffMember(created)) {
        setErrors(responseErrors(value));
        throw new Error(
          responseMessage(value, "No fue posible crear el empleado."),
        );
      }
      upsertMember(created);
      setCreateOpen(false);
      setCreateDraft(emptyCreateDraft);
      setFeedback({
        message: `${created.fullName} fue añadido al Personal.`,
        error: false,
      });
    } catch (error: unknown) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : "No fue posible crear el empleado.",
        error: true,
      });
    } finally {
      pendingRef.current = false;
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editTarget || !editDraft || pendingRef.current) return;
    pendingRef.current = true;
    setSaving(true);
    setErrors({});
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/administrador/staff/${encodeURIComponent(editTarget.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({
            expectedUpdatedAt: editTarget.updatedAt,
            patch: editDraft,
          }),
        },
      );
      const value: unknown = await response.json().catch(() => null);
      const updated = isRecord(value) ? value.staff : null;
      if (!response.ok || !isAdminStaffMember(updated)) {
        setErrors(responseErrors(value));
        throw new Error(
          responseMessage(value, "No fue posible editar el empleado."),
        );
      }
      upsertMember(updated);
      setEditTarget(null);
      setEditDraft(null);
      setFeedback({
        message: `${updated.fullName} fue actualizado.`,
        error: false,
      });
    } catch (error: unknown) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : "No fue posible editar el empleado.",
        error: true,
      });
    } finally {
      pendingRef.current = false;
      setSaving(false);
    }
  }

  async function changeStatus(member: AdminStaffMember, active: boolean) {
    if (pendingRef.current) return;
    pendingRef.current = true;
    setSaving(true);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/administrador/staff/${encodeURIComponent(member.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          cache: "no-store",
          body: JSON.stringify({
            expectedUpdatedAt: member.updatedAt,
            patch: { active },
          }),
        },
      );
      const value: unknown = await response.json().catch(() => null);
      const updated = isRecord(value) ? value.staff : null;
      if (!response.ok || !isAdminStaffMember(updated)) {
        throw new Error(
          responseMessage(value, "No fue posible cambiar el estado."),
        );
      }
      upsertMember(updated);
      setStatusTarget(null);
      setFeedback({
        message: active
          ? `${updated.fullName} volvió a estar activo.`
          : `${updated.fullName} fue desactivado y sus sesiones quedaron cerradas.`,
        error: false,
      });
    } catch (error: unknown) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : "No fue posible cambiar el estado.",
        error: true,
      });
    } finally {
      pendingRef.current = false;
      setSaving(false);
    }
  }

  return (
    <main id="contenido-principal" className={styles.main}>
      <header className={styles.heading}>
        <h1>Personal</h1>
        <p>Gestionar cuentas internas</p>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <span className={styles.visuallyHidden}>Buscar Personal</span>
          <Search aria-hidden="true" />
          <input
            type="search"
            value={search}
            placeholder="Buscar por nombre, usuario o rol..."
            onChange={(event) => setSearch(event.currentTarget.value)}
          />
        </label>
        <Button
          type="button"
          leadingIcon={<UserPlus />}
          onClick={openCreate}
        >
          Nuevo empleado
        </Button>
      </div>

      {feedback && !createOpen && !editTarget ? (
        <p
          className={styles.feedback}
          data-error={feedback.error || undefined}
          role="status"
        >
          {feedback.message}
        </p>
      ) : null}

      {filteredStaff.length > 0 ? (
        <ul className={styles.grid}>
          {filteredStaff.map((member) => (
            <li key={member.id}>
              <article
                className={styles.card}
                data-inactive={!member.active || undefined}
              >
                <div className={styles.cardTop}>
                  <span className={styles.avatar} aria-hidden="true">
                    {member.fullName.trim().charAt(0).toUpperCase() || "P"}
                  </span>
                  <div className={styles.identity}>
                    <h2>{member.fullName}</h2>
                    <p>@{member.username}</p>
                  </div>
                  <span
                    className={styles.status}
                    data-active={member.active || undefined}
                  >
                    {member.active ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <div className={styles.details}>
                  <p>{member.email}</p>
                  <span className={styles.roleBadge}>
                    <ShieldCheck aria-hidden="true" />
                    {staffRoleLabel(member.role)}
                  </span>
                </div>

                <div className={styles.actions}>
                  <Button
                    type="button"
                    variant="secondary"
                    size="compact"
                    leadingIcon={<Pencil />}
                    onClick={() => openEdit(member)}
                  >
                    Editar
                  </Button>
                  {member.active ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="compact"
                      leadingIcon={<UserX />}
                      onClick={() => setStatusTarget(member)}
                    >
                      Desactivar
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      size="compact"
                      leadingIcon={<UserCheck />}
                      onClick={() => void changeStatus(member, true)}
                    >
                      Activar
                    </Button>
                  )}
                </div>
              </article>
            </li>
          ))}
        </ul>
      ) : (
        <section className={styles.emptyState}>
          <UserPlus aria-hidden="true" />
          <h2>{search.trim() ? "Sin coincidencias" : "Aún no hay Personal"}</h2>
          <p>
            {search.trim()
              ? "Prueba con otro nombre, usuario, correo o rol."
              : "Crea la primera cuenta interna desde este panel."}
          </p>
        </section>
      )}

      <Dialog
        open={createOpen}
        onClose={() => !saving && setCreateOpen(false)}
        title="Nuevo empleado"
        description="Crea una cuenta interna para Caja, Cocina o ambos roles."
        initialFocusSelector="#admin-staff-create-name"
        actions={
          <>
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => setCreateOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              loading={saving}
              loadingLabel="Creando"
              onClick={() => void createMember()}
            >
              Crear usuario
            </Button>
          </>
        }
      >
        <div className={styles.formGrid}>
          <Field
            id="admin-staff-create-name"
            label="Nombre completo"
            value={createDraft.fullName}
            error={errors.fullName}
            autoComplete="name"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setCreateDraft((current) => ({ ...current, fullName: value }));
            }}
          />
          <Field
            id="admin-staff-create-username"
            label="Usuario"
            value={createDraft.username}
            error={errors.username}
            autoComplete="username"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setCreateDraft((current) => ({ ...current, username: value }));
            }}
          />
          <Field
            id="admin-staff-create-email"
            label="Correo"
            type="email"
            value={createDraft.email}
            error={errors.email}
            autoComplete="email"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setCreateDraft((current) => ({ ...current, email: value }));
            }}
          />
          <Field
            id="admin-staff-create-password"
            label="Contraseña inicial"
            type="password"
            value={createDraft.password}
            error={errors.password}
            autoComplete="new-password"
            onChange={(event) => {
              const value = event.currentTarget.value;
              setCreateDraft((current) => ({ ...current, password: value }));
            }}
          />
          <label className={styles.selectField}>
            <span>Rol</span>
            <select
              value={createDraft.role}
              onChange={(event) => {
                const role = event.currentTarget.value as StaffRole;
                setCreateDraft((current) => ({ ...current, role }));
              }}
            >
              <option value="caja">Caja</option>
              <option value="cocina">Cocina</option>
              <option value="caja_cocina">Caja / Cocina</option>
            </select>
          </label>
          {feedback?.error && createOpen ? (
            <p className={styles.dialogError} role="alert">
              {feedback.message}
            </p>
          ) : null}
        </div>
      </Dialog>

      <Dialog
        open={Boolean(editTarget && editDraft)}
        onClose={() => {
          if (saving) return;
          setEditTarget(null);
          setEditDraft(null);
        }}
        title="Editar empleado"
        description={
          editTarget
            ? `@${editTarget.username} · cambiar el usuario cerrará sus sesiones activas.`
            : undefined
        }
        initialFocusSelector="#admin-staff-edit-name"
        actions={
          <>
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => {
                setEditTarget(null);
                setEditDraft(null);
              }}
            >
              Cancelar
            </Button>
            <Button
              loading={saving}
              loadingLabel="Guardando"
              onClick={() => void saveEdit()}
            >
              Guardar cambios
            </Button>
          </>
        }
      >
        {editDraft ? (
          <div className={styles.formGrid}>
            <Field
              id="admin-staff-edit-name"
              label="Nombre completo"
              value={editDraft.fullName}
              error={errors.fullName}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setEditDraft((current) =>
                  current ? { ...current, fullName: value } : current,
                );
              }}
            />
            <Field
              id="admin-staff-edit-username"
              label="Usuario"
              value={editDraft.username}
              error={errors.username}
              autoComplete="username"
              onChange={(event) => {
                const value = event.currentTarget.value;
                setEditDraft((current) =>
                  current ? { ...current, username: value } : current,
                );
              }}
            />
            <Field
              id="admin-staff-edit-email"
              label="Correo"
              type="email"
              value={editDraft.email}
              error={errors.email}
              onChange={(event) => {
                const value = event.currentTarget.value;
                setEditDraft((current) =>
                  current ? { ...current, email: value } : current,
                );
              }}
            />
            <label className={styles.selectField}>
              <span>Rol</span>
              <select
                value={editDraft.role}
                onChange={(event) => {
                  const role = event.currentTarget.value as StaffRole;
                  setEditDraft((current) =>
                    current ? { ...current, role } : current,
                  );
                }}
              >
                <option value="caja">Caja</option>
                <option value="cocina">Cocina</option>
                <option value="caja_cocina">Caja / Cocina</option>
              </select>
            </label>
            {feedback?.error && editTarget ? (
              <p className={styles.dialogError} role="alert">
                {feedback.message}
              </p>
            ) : null}
          </div>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(statusTarget)}
        onClose={() => !saving && setStatusTarget(null)}
        title="Desactivar empleado"
        description="La cuenta dejará de tener acceso inmediatamente."
        actions={
          <>
            <Button
              variant="secondary"
              disabled={saving}
              onClick={() => setStatusTarget(null)}
            >
              Cancelar
            </Button>
            <Button
              variant="danger"
              loading={saving}
              loadingLabel="Desactivando"
              onClick={() =>
                statusTarget && void changeStatus(statusTarget, false)
              }
            >
              Desactivar
            </Button>
          </>
        }
      >
        <p className={styles.confirmText}>
          {statusTarget
            ? `${statusTarget.fullName} perderá sus sesiones activas y su turno abierto se cerrará.`
            : ""}
        </p>
      </Dialog>
    </main>
  );
}
