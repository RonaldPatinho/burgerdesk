import type { AdministratorSalesSeriesPoint } from "@/domain/admin-finance";
import { formatCop } from "@/domain/currency";
import { administratorDashboardVariationLabel } from "@/domain/admin-dashboard";
import styles from "./AdminDashboardScreen.module.css";

type PlotPoint = {
  x: number;
  y: number;
  source: AdministratorSalesSeriesPoint;
};

const VIEWBOX_WIDTH = 600;
const VIEWBOX_HEIGHT = 260;
const PLOT_LEFT = 58;
const PLOT_RIGHT = 580;
const PLOT_TOP = 20;
const PLOT_BOTTOM = 205;

function compactAxisAmount(value: number): string {
  if (value >= 1_000_000) {
    const millions = value / 1_000_000;
    return `${Number.isInteger(millions) ? millions : millions.toFixed(1)}M`;
  }
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`;
  }
  return String(Math.round(value));
}

function chartPoints(
  series: readonly AdministratorSalesSeriesPoint[],
): { points: PlotPoint[]; maximum: number } {
  const maximum = Math.max(0, ...series.map((point) => point.salesCop));
  const denominator = Math.max(maximum, 1);
  const spanX = PLOT_RIGHT - PLOT_LEFT;
  const spanY = PLOT_BOTTOM - PLOT_TOP;

  return {
    maximum,
    points: series.map((source, index) => ({
      source,
      x:
        series.length <= 1
          ? PLOT_LEFT
          : PLOT_LEFT + (spanX * index) / (series.length - 1),
      y: PLOT_BOTTOM - (source.salesCop / denominator) * spanY,
    })),
  };
}

function smoothPath(points: readonly PlotPoint[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 0; index < points.length - 1; index += 1) {
    const current = points[index];
    const next = points[index + 1];
    const midpointX = (current.x + next.x) / 2;
    path += ` C ${midpointX} ${current.y}, ${midpointX} ${next.y}, ${next.x} ${next.y}`;
  }
  return path;
}

function xLabelIndexes(length: number): number[] {
  if (length <= 6) return Array.from({ length }, (_, index) => index);
  const candidates = [0, 5, 10, 15, 20, length - 1];
  return [...new Set(candidates.map((value) => Math.min(value, length - 1)))];
}

export function AdminSalesChart({
  series,
  variationPercent,
}: {
  series: readonly AdministratorSalesSeriesPoint[];
  variationPercent: number | null;
}) {
  const { points, maximum } = chartPoints(series);
  const linePath = smoothPath(points);
  const areaPath = points.length
    ? `${linePath} L ${points.at(-1)?.x ?? PLOT_RIGHT} ${PLOT_BOTTOM} L ${
        points[0]?.x ?? PLOT_LEFT
      } ${PLOT_BOTTOM} Z`
    : "";
  const lastPaidPoint = [...points].reverse().find((point) => point.source.salesCop > 0);
  const variationLabel = administratorDashboardVariationLabel(variationPercent);
  const variationTone =
    variationPercent === null
      ? "neutral"
      : variationPercent < 0
        ? "negative"
        : "positive";
  const yLevels = [1, 0.75, 0.5, 0.25];
  const labelIndexes = xLabelIndexes(series.length);

  return (
    <section className={styles.chartCard} aria-labelledby="admin-sales-chart-heading">
      <header className={styles.chartHeader}>
        <h2 id="admin-sales-chart-heading">Ventas de hoy</h2>
        <span className={styles.variation} data-tone={variationTone}>
          {variationLabel}
        </span>
      </header>

      <div className={styles.chartWrap}>
        <svg
          className={styles.chart}
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          role="img"
          aria-labelledby="admin-sales-chart-title admin-sales-chart-description"
          preserveAspectRatio="none"
        >
          <title id="admin-sales-chart-title">Ventas pagadas de hoy</title>
          <desc id="admin-sales-chart-description">
            Serie horaria de ventas pagadas. Los pedidos en efectivo pendientes no se suman.
          </desc>

          {yLevels.map((ratio) => {
            const y = PLOT_BOTTOM - (PLOT_BOTTOM - PLOT_TOP) * ratio;
            const amount = maximum * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={PLOT_LEFT}
                  x2={PLOT_RIGHT}
                  y1={y}
                  y2={y}
                  className={styles.gridLine}
                />
                <text x={8} y={y + 5} className={styles.axisLabel}>
                  {maximum > 0 ? compactAxisAmount(amount) : "0"}
                </text>
              </g>
            );
          })}

          <line
            x1={PLOT_LEFT}
            x2={PLOT_RIGHT}
            y1={PLOT_BOTTOM}
            y2={PLOT_BOTTOM}
            className={styles.gridLine}
          />

          {areaPath ? <path d={areaPath} className={styles.areaPath} /> : null}
          {linePath ? <path d={linePath} className={styles.linePath} /> : null}

          {points
            .filter((point) => point.source.salesCop > 0)
            .map((point) => (
              <circle
                key={point.source.key}
                cx={point.x}
                cy={point.y}
                r={6.5}
                className={styles.dataPoint}
              />
            ))}

          {labelIndexes.map((index) => {
            const point = points[index];
            if (!point) return null;
            const hour = Number(point.source.label.slice(0, 2));
            const label = Number.isFinite(hour)
              ? `${String(hour).padStart(2, "0")}h`
              : point.source.label;
            return (
              <text
                key={`label-${point.source.key}`}
                x={point.x}
                y={240}
                textAnchor={index === 0 ? "start" : index === series.length - 1 ? "end" : "middle"}
                className={styles.xAxisLabel}
              >
                {label}
              </text>
            );
          })}

          {lastPaidPoint ? (
            <g>
              <rect
                x={Math.min(Math.max(lastPaidPoint.x - 55, 8), VIEWBOX_WIDTH - 118)}
                y={Math.max(lastPaidPoint.y - 54, 8)}
                width={110}
                height={34}
                rx={17}
                className={styles.tooltipBubble}
              />
              <text
                x={Math.min(Math.max(lastPaidPoint.x, 63), VIEWBOX_WIDTH - 63)}
                y={Math.max(lastPaidPoint.y - 32, 30)}
                textAnchor="middle"
                className={styles.tooltipText}
              >
                {formatCop(lastPaidPoint.source.salesCop)}
              </text>
            </g>
          ) : null}
        </svg>

        {maximum === 0 ? (
          <p className={styles.emptyChartMessage}>Aún no hay ventas pagadas hoy.</p>
        ) : null}
      </div>

      <p className={styles.srOnly}>
        {series
          .map((point) => `${point.label}: ${formatCop(point.salesCop)}`)
          .join(". ")}
      </p>
    </section>
  );
}
