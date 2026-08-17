"use client";

import Link from "next/link";
import { Download, Trophy } from "lucide-react";
import { useRef, useState } from "react";
import type {
  AdministratorFinancialPeriodKind,
  AdministratorFinancialSnapshot,
} from "@/domain/admin-finance";
import {
  administratorReportUpdatedLabel,
  buildAdministratorReportsHref,
} from "@/domain/admin-reports";
import { formatCop } from "@/domain/currency";
import { Button, Dialog } from "@/components/ui";
import { AdminSalesChart } from "./AdminSalesChart";
import styles from "./AdminReportsScreen.module.css";

function responseFileName(response: Response, fallback: string): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/i);
  return match?.[1] ?? fallback;
}

export function AdminReportsScreen({
  snapshot,
  updatedAt,
  fileNames,
}: {
  snapshot: AdministratorFinancialSnapshot;
  updatedAt: string;
  fileNames: Readonly<Record<AdministratorFinancialPeriodKind, string>>;
}) {
  const exportPendingRef = useRef(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [exportPeriod, setExportPeriod] =
    useState<AdministratorFinancialPeriodKind>(snapshot.period.kind);
  const [exportPending, setExportPending] = useState(false);
  const [feedback, setFeedback] = useState<{
    message: string;
    error: boolean;
  } | null>(null);
  const periodLabel = snapshot.period.kind === "day" ? "Día" : "Mes";
  const isMonth = snapshot.period.kind === "month";

  async function downloadReport() {
    if (exportPendingRef.current) return;
    exportPendingRef.current = true;
    setExportPending(true);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/administrador/reports/export?period=${exportPeriod}`,
      );
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as
          | { message?: unknown }
          | null;
        throw new Error(
          typeof payload?.message === "string"
            ? payload.message
            : "No fue posible exportar el reporte.",
        );
      }
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = responseFileName(response, fileNames[exportPeriod]);
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(objectUrl);
      setDialogOpen(false);
      setFeedback({
        message: `Reporte ${exportPeriod === "day" ? "del día" : "del mes"} exportado en CSV.`,
        error: false,
      });
    } catch (error: unknown) {
      setFeedback({
        message:
          error instanceof Error
            ? error.message
            : "No fue posible exportar el reporte.",
        error: true,
      });
    } finally {
      exportPendingRef.current = false;
      setExportPending(false);
    }
  }

  return (
    <main id="contenido-principal" className={styles.main}>
      <header className={styles.heading}>
        <h1>Reportes</h1>
        <p>Información del negocio</p>
      </header>

      <nav className={styles.tabs} aria-label="Período del reporte">
        {(["day", "month"] as const).map((period) => {
          const active = snapshot.period.kind === period;
          return (
            <Link
              key={period}
              href={buildAdministratorReportsHref(period)}
              className={styles.tab}
              aria-current={active ? "page" : undefined}
              data-active={active || undefined}
            >
              {period === "day" ? "Día" : "Mes"}
            </Link>
          );
        })}
      </nav>

      <AdminSalesChart
        series={snapshot.salesSeries}
        variationPercent={snapshot.summary.salesVariationPercent}
        heading="Ventas por período"
        headerValue={formatCop(snapshot.summary.paidSalesCop)}
        accessibleTitle={`Ventas pagadas del ${isMonth ? "mes" : "día"}`}
        description={`Serie ${isMonth ? "diaria" : "horaria"} de ventas pagadas del período ${snapshot.period.key}.`}
        emptyMessage={`Aún no hay ventas pagadas en este ${isMonth ? "mes" : "día"}.`}
        xAxisKind={isMonth ? "day" : "hour"}
      />

      <section className={styles.ranking} aria-labelledby="admin-ranking-heading">
        <div className={styles.sectionHeading}>
          <span className={styles.trophy} aria-hidden="true">
            <Trophy />
          </span>
          <h2 id="admin-ranking-heading">Más vendidos</h2>
        </div>
        {snapshot.topProducts.length ? (
          <ol className={styles.rankingList}>
            {snapshot.topProducts.map((product, index) => (
              <li key={`${product.productId}-${index}`}>
                <span className={styles.position}>{index + 1}</span>
                <strong>{product.productName}</strong>
                <span>
                  {product.quantitySold} {product.quantitySold === 1 ? "unidad" : "unidades"}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className={styles.emptyRanking}>
            No hay productos vendidos en este período.
          </p>
        )}
      </section>

      <p className={styles.updatedAt}>
        Actualizado: <time dateTime={updatedAt}>{administratorReportUpdatedLabel(updatedAt, snapshot.period.timeZone)}</time>
      </p>

      {feedback && !feedback.error ? (
        <p
          className={styles.feedback}
          data-error={feedback.error || undefined}
          role={feedback.error ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      ) : null}

      <Button
        type="button"
        fullWidth
        leadingIcon={<Download />}
        onClick={() => {
          setExportPeriod(snapshot.period.kind);
          setFeedback(null);
          setDialogOpen(true);
        }}
      >
        Exportar reporte
      </Button>

      <Dialog
        open={dialogOpen}
        onClose={() => {
          if (!exportPendingRef.current) setDialogOpen(false);
        }}
        title="Exportar reporte"
        description="Selecciona el período. El archivo se descargará en formato CSV UTF-8."
        initialFocusSelector="[data-export-cancel]"
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              data-export-cancel
              disabled={exportPending}
              onClick={() => setDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              loading={exportPending}
              loadingLabel="Exportando"
              onClick={downloadReport}
            >
              Descargar CSV
            </Button>
          </>
        }
      >
        <div className={styles.exportForm}>
          {feedback?.error ? (
            <p className={styles.feedback} data-error role="alert">
              {feedback.message}
            </p>
          ) : null}
          <fieldset>
            <legend>Período</legend>
            <div className={styles.periodOptions}>
              {(["day", "month"] as const).map((period) => (
                <label key={period}>
                  <input
                    type="radio"
                    name="export-period"
                    value={period}
                    checked={exportPeriod === period}
                    onChange={() => setExportPeriod(period)}
                  />
                  <span>{period === "day" ? "Día actual" : "Mes actual"}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <dl className={styles.exportSummary}>
            <div>
              <dt>Formato</dt>
              <dd>CSV UTF-8</dd>
            </div>
            <div>
              <dt>Período visible</dt>
              <dd>{periodLabel}</dd>
            </div>
            <div>
              <dt>Archivo</dt>
              <dd>{fileNames[exportPeriod]}</dd>
            </div>
          </dl>
        </div>
      </Dialog>
    </main>
  );
}
