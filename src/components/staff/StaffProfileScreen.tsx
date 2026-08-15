"use client";

import {
  AtSign,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { StaffLogoutButton } from "@/components/staff/StaffLogoutButton";
import {
  staffPermissionsForRole,
  staffRoleLabel,
  type StaffRole,
} from "@/domain/internal-auth";
import styles from "./StaffProfileScreen.module.css";

const BUSINESS_TIME_ZONE = "America/Caracas";

interface StaffProfileScreenProps {
  fullName: string;
  username: string;
  email: string;
  role: StaffRole;
  memberSince: string | null;
  activeShiftStartedAt: string | null;
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return "No disponible";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "No disponible";

  return new Intl.DateTimeFormat("es-VE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(date);
}

function formatShiftStart(isoDate: string | null): string {
  if (!isoDate) return "Sin turno activo";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "Hora no disponible";

  return new Intl.DateTimeFormat("es-VE", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: BUSINESS_TIME_ZONE,
  }).format(date);
}

export function StaffProfileScreen({
  fullName,
  username,
  email,
  role,
  memberSince,
  activeShiftStartedAt,
}: StaffProfileScreenProps) {
  const onShift = Boolean(activeShiftStartedAt);
  const permissions = staffPermissionsForRole(role);

  return (
    <main id="contenido-principal" className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1>Perfil</h1>
        </div>
      </header>

      <section className={styles.profileCard} aria-label="Perfil del personal">
        <div className={styles.profileTop}>
          <span className={styles.avatar} aria-hidden="true">
            <UserRound />
          </span>
          <div className={styles.identity}>
            <h2>{fullName}</h2>
            <p>@{username}</p>
          </div>
          <span className={styles.turnBadge} data-active={onShift}>
            <span aria-hidden="true" />
            {onShift ? "En turno" : "Sin turno activo"}
          </span>
        </div>

        <div className={styles.profileBody}>
          <section className={styles.section} aria-labelledby="staff-account-title">
            <h3 id="staff-account-title">Información personal</h3>
            <dl className={styles.fields}>
              <div className={styles.field}>
                <span className={styles.fieldIcon} aria-hidden="true">
                  <AtSign />
                </span>
                <div className={styles.fieldCopy}>
                  <dt>Correo electrónico</dt>
                  <dd>{email}</dd>
                </div>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldIcon} aria-hidden="true">
                  <ShieldCheck />
                </span>
                <div className={styles.fieldCopy}>
                  <dt>Rol</dt>
                  <dd>{staffRoleLabel(role)}</dd>
                </div>
              </div>
              <div className={styles.field}>
                <span className={styles.fieldIcon} aria-hidden="true">
                  <CalendarDays />
                </span>
                <div className={styles.fieldCopy}>
                  <dt>Miembro desde</dt>
                  <dd>{formatDate(memberSince)}</dd>
                </div>
              </div>
            </dl>
          </section>

          <section className={styles.section} aria-labelledby="staff-shift-title">
            <h3 id="staff-shift-title">Turno actual</h3>
            <div className={styles.shiftCard}>
              <span className={styles.shiftIcon} aria-hidden="true">
                <Clock3 />
              </span>
              <div className={styles.shiftCopy}>
                <strong>{onShift ? "Turno activo" : "Sin turno activo"}</strong>
                <span>
                  {onShift
                    ? `Inicio: ${formatShiftStart(activeShiftStartedAt)}`
                    : "Inicia sesión nuevamente para comenzar un turno."}
                </span>
              </div>
            </div>
          </section>

          <section className={styles.section} aria-labelledby="staff-permissions-title">
            <h3 id="staff-permissions-title">Permisos del rol</h3>
            <p className={styles.permissionsIntro}>
              Capacidades disponibles para {staffRoleLabel(role)}.
            </p>
            <ul className={styles.permissions}>
              {permissions.map((permission) => (
                <li key={permission} className={styles.permissionItem}>
                  <CheckCircle2 aria-hidden="true" />
                  <span>{permission}</span>
                </li>
              ))}
            </ul>
          </section>

          <StaffLogoutButton
            variant="primary"
            className={styles.logoutButton}
            accountLabel={fullName}
          />
        </div>
      </section>
    </main>
  );
}
