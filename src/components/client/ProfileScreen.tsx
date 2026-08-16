"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Camera,
  ChevronRight,
  Clock3,
  Heart,
  LogOut,
  Mail,
  MapPin,
  Phone,
  PackageCheck,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  Trash2,
  UserRound,
  WalletCards,
} from "lucide-react";
import { type FormEvent, useMemo, useRef, useState } from "react";
import { MAX_QUANTITY_PER_CART_LINE, products } from "@/data/provisional";
import { formatCop } from "@/domain/currency";
import { buildProfileReorder } from "@/domain/profile-reorder";
import type {
  ClientOrderDetailView,
  ClientOrderSummaryView,
  ClientProfileDashboard,
  ClientProfileFieldErrors,
  ClientProfileView,
} from "@/domain/profile";
import { MAX_AVATAR_BYTES, acceptedAvatarMimeTypes } from "@/domain/profile";
import type { StoreLocation } from "@/domain/models";
import { browserSessionService } from "@/services/browser-session";
import { Button, Checkbox, Dialog, Field } from "@/components/ui";
import { ClientBottomNav } from "./ClientBottomNav";
import { ClientHeader } from "./ClientHeader";
import { useClientCart } from "./ClientCartProvider";
import styles from "./ProfileScreen.module.css";

interface ProfileScreenProps {
  initialDashboard: ClientProfileDashboard;
  stores: readonly StoreLocation[];
}

type DialogName = "edit" | "order" | "logout" | null;
const PROFILE_UPDATED_EVENT = "burgerdesk:profile-updated";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function notifyProfileUpdated(hasAvatar: boolean) {
  window.dispatchEvent(
    new CustomEvent(PROFILE_UPDATED_EVENT, { detail: { hasAvatar } }),
  );
}

function Avatar({ profile, version }: { profile: ClientProfileView; version: number }) {
  return (
    <span className={styles.avatar} aria-hidden="true">
      {profile.hasAvatar ? (
        <Image
          src={`/api/profile/avatar?v=${version}`}
          alt=""
          width={88}
          height={88}
          unoptimized
        />
      ) : (
        <span>{initials(profile.fullName) || <UserRound />}</span>
      )}
    </span>
  );
}

function OrderRow({
  order,
  onOpen,
}: {
  order: ClientOrderSummaryView;
  onOpen: (orderId: string) => void;
}) {
  return (
    <button type="button" className={styles.orderRow} onClick={() => onOpen(order.id)}>
      <span className={styles.orderIcon} aria-hidden="true">
        <ShoppingBag />
      </span>
      <span className={styles.orderCopy}>
        <span className={styles.orderIdentity}>
          <strong>{order.code}</strong>
          <span className={styles.statusBadge} data-status={order.status}>
            {order.statusLabel}
          </span>
        </span>
        <span>{order.productSummary}</span>
        <small>{formatDate(order.createdAt)}</small>
      </span>
      <span className={styles.orderPrice}>{formatCop(order.totalCop)}</span>
      <ChevronRight className={styles.orderChevron} aria-hidden="true" />
    </button>
  );
}

export function ProfileScreen({ initialDashboard, stores }: ProfileScreenProps) {
  const router = useRouter();
  const { addItems } = useClientCart();
  const [profile, setProfile] = useState(initialDashboard.profile);
  const [orders, setOrders] = useState<readonly ClientOrderSummaryView[]>(
    initialDashboard.recentOrders,
  );
  const [showingAll, setShowingAll] = useState(false);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [detail, setDetail] = useState<ClientOrderDetailView | null>(null);
  const [detailPending, setDetailPending] = useState(false);
  const [historyPending, setHistoryPending] = useState(false);
  const [profilePending, setProfilePending] = useState(false);
  const [avatarDeletePending, setAvatarDeletePending] = useState(false);
  const [logoutPending, setLogoutPending] = useState(false);
  const [profileErrors, setProfileErrors] = useState<ClientProfileFieldErrors>({});
  const [message, setMessage] = useState<string | null>(null);
  const [detailMessage, setDetailMessage] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarVersion, setAvatarVersion] = useState(0);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const avatarInputAccept = useMemo(() => acceptedAvatarMimeTypes.join(","), []);
  const profileMutationPending = profilePending || avatarDeletePending;

  function clearAvatarSelection() {
    setAvatarFile(null);
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  }

  function closeDialog() {
    if (profileMutationPending || logoutPending) return;
    setDialog(null);
    setDetail(null);
    setDetailMessage(null);
    setProfileErrors({});
    clearAvatarSelection();
  }

  async function loadAllOrders() {
    setHistoryPending(true);
    setMessage(null);
    try {
      const response = await fetch("/api/profile/orders", { cache: "no-store" });
      const value: unknown = await response.json();
      if (!response.ok || !isRecord(value) || !Array.isArray(value.orders)) {
        throw new Error("No fue posible cargar el historial completo.");
      }
      setOrders(value.orders as ClientOrderSummaryView[]);
      setShowingAll(true);
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "No fue posible cargar el historial.");
    } finally {
      setHistoryPending(false);
    }
  }

  async function openOrder(orderId: string) {
    setDialog("order");
    setDetail(null);
    setDetailMessage(null);
    setDetailPending(true);
    try {
      const response = await fetch(`/api/profile/orders/${encodeURIComponent(orderId)}`, {
        cache: "no-store",
      });
      const value: unknown = await response.json();
      if (!response.ok || !isRecord(value) || !isRecord(value.order)) {
        throw new Error(
          isRecord(value) && typeof value.message === "string"
            ? value.message
            : "No fue posible consultar el pedido.",
        );
      }
      setDetail(value.order as unknown as ClientOrderDetailView);
    } catch (error: unknown) {
      setDetailMessage(
        error instanceof Error ? error.message : "No fue posible consultar el pedido.",
      );
    } finally {
      setDetailPending(false);
    }
  }

  function handleAvatarChange(file: File | null) {
    setProfileErrors((current) => ({ ...current, avatar: undefined }));
    if (!file) {
      setAvatarFile(null);
      return;
    }
    if (!acceptedAvatarMimeTypes.includes(file.type as (typeof acceptedAvatarMimeTypes)[number])) {
      setProfileErrors((current) => ({
        ...current,
        avatar: "Usa una imagen JPEG, PNG o WebP.",
      }));
      return;
    }
    if (file.size > MAX_AVATAR_BYTES || file.size < 1) {
      setProfileErrors((current) => ({
        ...current,
        avatar: "La fotografía debe pesar como máximo 5 MB.",
      }));
      return;
    }
    setAvatarFile(file);
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (avatarDeletePending) return;
    setProfilePending(true);
    setProfileErrors({});
    const form = new FormData(event.currentTarget);
    const payload = {
      fullName: String(form.get("fullName") ?? ""),
      email: String(form.get("email") ?? ""),
      phone: String(form.get("phone") ?? ""),
      preferredStoreId: String(form.get("preferredStoreId") ?? ""),
      contactWhatsapp: form.get("contactWhatsapp") === "on",
      contactEmail: form.get("contactEmail") === "on",
    };
    const body = new FormData();
    body.set("profile", JSON.stringify(payload));
    if (avatarFile) body.set("avatar", avatarFile);
    try {
      const response = await fetch("/api/profile", { method: "PATCH", body });
      const value: unknown = await response.json();
      if (!response.ok) {
        if (isRecord(value) && isRecord(value.errors)) {
          setProfileErrors(value.errors as ClientProfileFieldErrors);
        }
        throw new Error(
          isRecord(value) && typeof value.message === "string"
            ? value.message
            : "No fue posible guardar el perfil.",
        );
      }
      if (!isRecord(value) || !isRecord(value.profile)) {
        throw new Error("El servidor devolvió un perfil inválido.");
      }
      const nextProfile = value.profile as unknown as ClientProfileView;
      setProfile(nextProfile);
      if (avatarFile) setAvatarVersion((current) => current + 1);
      notifyProfileUpdated(nextProfile.hasAvatar);
      setMessage("Tus datos se guardaron correctamente.");
      setDialog(null);
      clearAvatarSelection();
      router.refresh();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "No fue posible guardar el perfil.");
    } finally {
      setProfilePending(false);
    }
  }

  async function removeAvatar() {
    if (!profile.hasAvatar || profileMutationPending) return;
    setAvatarDeletePending(true);
    setProfileErrors((current) => ({ ...current, avatar: undefined }));
    try {
      const response = await fetch("/api/profile/avatar", { method: "DELETE" });
      const value: unknown = await response.json();
      if (!response.ok) {
        throw new Error(
          isRecord(value) && typeof value.message === "string"
            ? value.message
            : "No fue posible eliminar la foto de perfil.",
        );
      }
      if (!isRecord(value) || !isRecord(value.profile)) {
        throw new Error("El servidor devolvió un perfil inválido.");
      }
      const nextProfile = value.profile as unknown as ClientProfileView;
      if (nextProfile.hasAvatar) {
        throw new Error("No fue posible confirmar la eliminación de la foto.");
      }
      setProfile(nextProfile);
      clearAvatarSelection();
      setAvatarVersion((current) => current + 1);
      notifyProfileUpdated(false);
      setMessage("La foto de perfil se eliminó correctamente.");
      router.refresh();
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "No fue posible eliminar la foto de perfil.";
      setProfileErrors((current) => ({ ...current, avatar: errorMessage }));
    } finally {
      setAvatarDeletePending(false);
    }
  }

  async function reorder() {
    if (!detail) return;
    const result = buildProfileReorder(detail, products, MAX_QUANTITY_PER_CART_LINE);
    if (result.items.length === 0) {
      setDetailMessage("Ningún producto de este pedido está disponible actualmente.");
      return;
    }
    try {
      const merge = await addItems(result.items);
      const notices: string[] = [];
      if (result.omittedProductNames.length > 0) {
        notices.push(`Se omitieron: ${result.omittedProductNames.join(", ")}.`);
      }
      if (result.omittedOptionNames.length > 0) {
        notices.push(`Complementos omitidos: ${result.omittedOptionNames.join(", ")}.`);
      }
      if (result.priceChanged) notices.push("El carrito usa los precios actuales.");
      if (result.quantityAdjusted || merge.quantityAdjustmentCount > 0) {
        notices.push("Algunas cantidades se ajustaron al máximo disponible.");
      }
      if (notices.length > 0) {
        setDetailMessage(`${notices.join(" ")} Los productos válidos ya están en tu carrito.`);
        return;
      }
      router.push("/carrito");
    } catch {
      setDetailMessage("No fue posible actualizar el carrito. Inténtalo nuevamente.");
    }
  }

  async function signOut() {
    setLogoutPending(true);
    try {
      await browserSessionService.signOut();
      router.replace("/acceso");
      router.refresh();
    } catch (error: unknown) {
      setMessage(error instanceof Error ? error.message : "No fue posible cerrar la sesión.");
      setLogoutPending(false);
      setDialog(null);
    }
  }

  return (
    <div className={styles.page}>
      <ClientHeader homeLink />
      <main id="contenido-principal" className={styles.main} tabIndex={-1}>
        <section className={styles.desktopOnly} aria-label="Perfil del cliente en escritorio">
          <header className={styles.desktopHeading}>
            <h1>Mi perfil</h1>
            <p>Administra tus datos y revisa pedidos anteriores</p>
          </header>

          {message ? (
            <p className={styles.message} role="status" aria-live="polite">
              {message}
            </p>
          ) : null}

          <div className={styles.desktopProfileLayout}>
            <aside className={styles.desktopIdentityPanel} aria-label="Información del cliente">
              <section className={styles.desktopIdentityHero}>
                <Avatar profile={profile} version={avatarVersion} />
                <h2>{profile.fullName}</h2>
                <p>Cliente BurgerDesk</p>
              </section>

              <section className={styles.desktopPersonalInfo} aria-labelledby="desktop-personal-info">
                <h3 id="desktop-personal-info">Información personal</h3>
                <dl>
                  <div>
                    <dt><Mail aria-hidden="true" /> Correo</dt>
                    <dd>{profile.email}</dd>
                  </div>
                  <div>
                    <dt><Phone aria-hidden="true" /> Teléfono</dt>
                    <dd>{profile.phone}</dd>
                  </div>
                  <div>
                    <dt><MapPin aria-hidden="true" /> Sede preferida</dt>
                    <dd>{profile.preferredStoreName}</dd>
                  </div>
                </dl>
              </section>

              <div className={styles.desktopIdentityActions}>
                <Button
                  variant="secondary"
                  fullWidth
                  leadingIcon={<UserRound />}
                  onClick={() => setDialog("edit")}
                >
                  Editar perfil
                </Button>
                <Button
                  variant="danger"
                  fullWidth
                  leadingIcon={<LogOut />}
                  onClick={() => setDialog("logout")}
                >
                  Cerrar sesión
                </Button>
              </div>
            </aside>

            <div className={styles.desktopProfileContent}>
              <section className={styles.desktopSummary} aria-labelledby="desktop-summary-title">
                <h2 id="desktop-summary-title">Resumen</h2>
                <div className={styles.desktopStats}>
                  <article>
                    <PackageCheck aria-hidden="true" />
                    <div><span>Pedidos realizados</span><strong>{initialDashboard.stats.orderCount}</strong></div>
                  </article>
                  <article>
                    <Heart aria-hidden="true" />
                    <div><span>Favoritos</span><strong>{initialDashboard.stats.favoriteCount}</strong></div>
                  </article>
                  <article>
                    <WalletCards aria-hidden="true" />
                    <div><span>Total pagado</span><strong>{formatCop(initialDashboard.stats.totalPaidCop)}</strong></div>
                  </article>
                </div>
              </section>

              <section className={styles.desktopHistory} aria-labelledby="desktop-history-title">
                <div className={styles.desktopHistoryHeading}>
                  <div>
                    <h2 id="desktop-history-title">{showingAll ? "Todos tus pedidos" : "Pedidos recientes"}</h2>
                    <p>Consulta el historial de tus compras en BurgerDesk.</p>
                  </div>
                  {!showingAll && initialDashboard.totalOrderCount > orders.length ? (
                    <button type="button" disabled={historyPending} onClick={() => void loadAllOrders()}>
                      {historyPending ? "Cargando…" : "Ver todo"} <ArrowRight aria-hidden="true" />
                    </button>
                  ) : null}
                </div>

                {orders.length > 0 ? (
                  <div className={styles.desktopOrderList}>
                    {orders.map((order) => (
                      <OrderRow key={order.id} order={order} onOpen={(id) => void openOrder(id)} />
                    ))}
                  </div>
                ) : (
                  <div className={styles.emptyState}>
                    <ReceiptText aria-hidden="true" />
                    <h3>Aún no tienes pedidos</h3>
                    <p>Tu historial aparecerá aquí después de confirmar tu primer pedido.</p>
                  </div>
                )}
              </section>

              <div className={styles.desktopNewOrder}>
                <Button leadingIcon={<ShoppingBag />} onClick={() => router.push("/menu")}>
                  Hacer nuevo pedido
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className={styles.mobileOnly} aria-label="Perfil del cliente">
          <header className={styles.heading}>
            <h1>Mi perfil</h1>
            <p>Administra tus datos y revisa tus pedidos.</p>
          </header>

          {message ? (
            <p className={styles.message} role="status" aria-live="polite">
              {message}
            </p>
          ) : null}

          <section className={styles.profileCard} aria-label="Datos del cliente">
            <Avatar profile={profile} version={avatarVersion} />
            <div className={styles.profileCopy}>
              <h2>{profile.fullName}</h2>
              <p>{profile.email}</p>
              <span><MapPin aria-hidden="true" /> {profile.preferredStoreName}</span>
            </div>
            <Button
              size="compact"
              variant="secondary"
              leadingIcon={<UserRound />}
              onClick={() => setDialog("edit")}
            >
              Editar
            </Button>
          </section>

          <section className={styles.stats} aria-label="Estadísticas del cliente">
            <article><PackageCheck aria-hidden="true" /><strong>{initialDashboard.stats.orderCount}</strong><span>Pedidos</span></article>
            <article><Heart aria-hidden="true" /><strong>{initialDashboard.stats.favoriteCount}</strong><span>Favoritos</span></article>
            <article><WalletCards aria-hidden="true" /><strong>{formatCop(initialDashboard.stats.totalPaidCop)}</strong><span>Total pagado</span></article>
          </section>

          <section className={styles.history} aria-labelledby="history-title">
            <div className={styles.sectionHeading}>
              <h2 id="history-title">{showingAll ? "Todos tus pedidos" : "Pedidos recientes"}</h2>
              {!showingAll && initialDashboard.totalOrderCount > orders.length ? (
                <button type="button" disabled={historyPending} onClick={() => void loadAllOrders()}>
                  {historyPending ? "Cargando…" : "Ver todo"} <ArrowRight aria-hidden="true" />
                </button>
              ) : null}
            </div>
            {orders.length > 0 ? (
              <div className={styles.orderList}>
                {orders.map((order) => <OrderRow key={order.id} order={order} onOpen={(id) => void openOrder(id)} />)}
              </div>
            ) : (
              <div className={styles.emptyState}>
                <ReceiptText aria-hidden="true" />
                <h3>Aún no tienes pedidos</h3>
                <p>Tu historial aparecerá aquí después de confirmar tu primer pedido.</p>
              </div>
            )}
          </section>

          <div className={styles.pageActions}>
            <Button variant="danger" fullWidth leadingIcon={<LogOut />} onClick={() => setDialog("logout")}>
              Cerrar sesión
            </Button>
            <Button fullWidth leadingIcon={<ShoppingBag />} onClick={() => router.push("/menu")}>
              Nuevo pedido
            </Button>
          </div>
        </section>
      </main>
      <ClientBottomNav active="profile" />

      <Dialog
        open={dialog === "edit"}
        onClose={closeDialog}
        title="Editar perfil"
        description="Actualiza tus datos y preferencias."
        closeLabel="Cerrar edición de perfil"
        initialFocusSelector="#profile-full-name"
        density="compact"
        actions={
          <>
            <Button variant="secondary" disabled={profileMutationPending} onClick={closeDialog}>Cancelar</Button>
            <Button type="submit" form="profile-form" disabled={avatarDeletePending} loading={profilePending} loadingLabel="Guardando…">Guardar cambios</Button>
          </>
        }
      >
        <form id="profile-form" className={styles.editForm} noValidate onSubmit={saveProfile}>
          <div className={styles.avatarEditor}>
            <Avatar profile={profile} version={avatarVersion} />
            <div>
              <div className={styles.avatarActions}>
                <label className={styles.fileButton} htmlFor="profile-avatar"><Camera aria-hidden="true" /> Cambiar foto</label>
                {profile.hasAvatar ? (
                  <button
                    type="button"
                    className={styles.removeAvatarButton}
                    disabled={profileMutationPending}
                    aria-busy={avatarDeletePending || undefined}
                    onClick={() => void removeAvatar()}
                  >
                    <Trash2 aria-hidden="true" />
                    {avatarDeletePending ? "Eliminando…" : "Eliminar foto"}
                  </button>
                ) : null}
              </div>
              <input
                ref={avatarInputRef}
                id="profile-avatar"
                className={styles.fileInput}
                type="file"
                name="avatar"
                accept={avatarInputAccept}
                disabled={profileMutationPending}
                aria-describedby="profile-avatar-help profile-avatar-error"
                onChange={(event) => handleAvatarChange(event.currentTarget.files?.[0] ?? null)}
              />
              <p id="profile-avatar-help">JPEG, PNG o WebP · Máx. 5 MB</p>
              {avatarFile ? <p className={styles.fileName}>{avatarFile.name}</p> : null}
              {profileErrors.avatar ? <p id="profile-avatar-error" className={styles.fieldError} role="alert">{profileErrors.avatar}</p> : null}
            </div>
          </div>
          <Field id="profile-full-name" name="fullName" label="Nombre completo" defaultValue={profile.fullName} error={profileErrors.fullName} maxLength={120} disabled={profileMutationPending} size="compact" />
          <Field id="profile-phone" name="phone" type="tel" label="Teléfono" defaultValue={profile.phone} error={profileErrors.phone} maxLength={32} disabled={profileMutationPending} size="compact" />
          <Field id="profile-email" name="email" type="email" label="Correo electrónico" defaultValue={profile.email} error={profileErrors.email} maxLength={254} disabled={profileMutationPending} size="compact" />
          <label className={styles.selectField} htmlFor="profile-store">
            <span>Sede preferida</span>
            <select id="profile-store" name="preferredStoreId" defaultValue={profile.preferredStoreId} disabled={profileMutationPending} aria-invalid={Boolean(profileErrors.preferredStoreId) || undefined} aria-describedby={profileErrors.preferredStoreId ? "profile-store-error" : undefined}>
              {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
            </select>
            {profileErrors.preferredStoreId ? <span id="profile-store-error" className={styles.fieldError}>{profileErrors.preferredStoreId}</span> : null}
          </label>
          <fieldset className={styles.preferences}>
            <legend>Preferencias de contacto</legend>
            <Checkbox id="profile-whatsapp" name="contactWhatsapp" label="WhatsApp" defaultChecked={profile.contactWhatsapp} disabled={profileMutationPending} />
            <Checkbox id="profile-email-contact" name="contactEmail" label="Correo electrónico" defaultChecked={profile.contactEmail} disabled={profileMutationPending} />
          </fieldset>
          <p className={styles.infoBox}>Usaremos estos canales solo para avisos relacionados con tus pedidos.</p>
        </form>
      </Dialog>

      <Dialog
        open={dialog === "order"}
        onClose={closeDialog}
        title={detail ? `Pedido ${detail.code}` : "Detalle del pedido"}
        description={detail ? formatDate(detail.createdAt) : "Consulta los productos e importes del pedido."}
        closeLabel="Cerrar detalle del pedido"
        initialFocusSelector="[data-detail-initial-focus]"
        actions={
          <>
            <Button data-detail-initial-focus variant="secondary" onClick={closeDialog}>Cerrar</Button>
            {detail ? (
              detailMessage ? (
                <Button onClick={() => router.push("/carrito")}>Ir al carrito</Button>
              ) : (
                <Button leadingIcon={<RotateCcw />} onClick={() => void reorder()}>Volver a pedir</Button>
              )
            ) : null}
          </>
        }
      >
        {detailPending ? <p className={styles.dialogState} role="status">Cargando pedido…</p> : detail ? (
          <div className={styles.orderDetail}>
            <div className={styles.detailSummary}>
              <span className={styles.statusBadge} data-status={detail.status}>{detail.statusLabel}</span>
              <strong>{formatCop(detail.totalCop)}</strong>
            </div>
            <ul className={styles.detailLines}>
              {detail.lines.map((line) => (
                <li key={line.id}>
                  <div><strong>{line.quantity} × {line.productName}</strong>{line.options.length > 0 ? <span>{line.options.map((option) => option.optionName).join(" · ")}</span> : null}</div>
                  <strong>{formatCop(line.lineTotalCop)}</strong>
                </li>
              ))}
            </ul>
            <dl className={styles.totals}>
              <div><dt>Subtotal</dt><dd>{formatCop(detail.subtotalCop)}</dd></div>
              <div><dt>Servicio</dt><dd>{formatCop(detail.serviceFeeCop)}</dd></div>
              <div><dt>Total</dt><dd>{formatCop(detail.totalCop)}</dd></div>
            </dl>
            <div className={styles.detailMeta}>
              <p><WalletCards aria-hidden="true" /><span><small>Método de pago</small>{detail.paymentMethodLabel}</span></p>
              <p><MapPin aria-hidden="true" /><span><small>Retiro</small>{detail.storeName}</span></p>
              <p><Clock3 aria-hidden="true" /><span><small>Confirmado</small>{detail.confirmedAt ? formatDate(detail.confirmedAt) : "Pendiente"}</span></p>
            </div>
            <p className={styles.infoBox}>Al volver a pedir, verificaremos disponibilidad y aplicaremos los precios actuales.</p>
            {detailMessage ? <p className={styles.dialogMessage} role="status">{detailMessage}</p> : null}
          </div>
        ) : <p className={styles.dialogMessage} role="alert">{detailMessage ?? "No fue posible cargar el pedido."}</p>}
      </Dialog>

      <Dialog
        open={dialog === "logout"}
        onClose={closeDialog}
        title="¿Cerrar sesión?"
        description="Tendrás que ingresar de nuevo para consultar tu perfil."
        closeLabel="Cerrar confirmación de cierre de sesión"
        initialFocusSelector="[data-logout-cancel]"
        actions={
          <>
            <Button data-logout-cancel variant="secondary" disabled={logoutPending} onClick={closeDialog}>Cancelar</Button>
            <Button variant="danger" loading={logoutPending} loadingLabel="Cerrando…" onClick={() => void signOut()}>Cerrar sesión</Button>
          </>
        }
      >
        <div className={styles.logoutCopy}>
          <span aria-hidden="true"><LogOut /></span>
          <p>Tu cuenta y tus pedidos no se eliminarán. Cualquier pedido activo seguirá su curso.</p>
        </div>
      </Dialog>
    </div>
  );
}
