"use client";

import {
  AtSign,
  CalendarDays,
  Fingerprint,
  ShieldCheck,
  Timer,
  UserRound,
} from "lucide-react";
import { StaffLogoutButton } from "@/components/staff/StaffLogoutButton";
import { staffRoleLabel, type StaffRole } from "@/domain/internal-auth";
import styles from "./StaffProfileScreen.module.css";

interface StaffProfileScreenProps {
  fullName: string;
  username: string;
  email: string;
  role: StaffRole;
  userId: string;
  memberSince: string | null;
  sessionExpiresAt: string;
}

function formatDate(isoDate: string | null): string {
  if (!isoDate) return "No disponible";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "No disponible";

  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function formatExpiry(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return "No disponible";

  return new Intl.DateTimeFormat("es-CO", {
    day: "numeric",
    month: "long",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Bogota",
  }).format(date);
}

function shortAccountId(userId: string): string {
  return `#${userId.slice(0, 8).toUpperCase()}`;
}

export function StaffProfileScreen({
  fullName,
  username,
  email,
  role,
  userId,
  memberSince,
  sessionExpiresAt,
}: StaffProfileScreenProps) {
  return (
    <main id="contenido-principal" className={styles.main}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <h1>Perfil del Personal</h1>
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
          <span className={styles.turnBadge}>
            <span aria-hidden="true" />
            En turno
          </span>
        </div>

        <div className={styles.profileBody}>
          <div className={styles.copy}>
            <h3>Información personal</h3>
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
              <div className={styles.field}>
                <span className={styles.fieldIcon} aria-hidden="true">
                  <Fingerprint />
                </span>
                <div className={styles.fieldCopy}>
                  <dt>ID de cuenta</dt>
                  <dd>{shortAccountId(userId)}</dd>
                </div>
              </div>
            </dl>

            <p className={styles.sessionNote}>
              <Timer aria-hidden="true" />
              Sesión válida hasta el {formatExpiry(sessionExpiresAt)}.
            </p>
          </div>

          <StaffLogoutButton
            variant="primary"
            className={styles.logoutButton}
          />
        </div>
      </section>
    </main>
  );
}
