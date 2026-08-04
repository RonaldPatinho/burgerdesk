import {
  CircleAlert,
  CircleCheck,
  Inbox,
  LoaderCircle,
} from "lucide-react";
import { type ReactNode } from "react";
import styles from "./Feedback.module.css";

type FeedbackVariant = "loading" | "empty" | "error" | "success";

export interface FeedbackProps {
  variant: FeedbackVariant;
  title: string;
  description?: string;
  action?: ReactNode;
}

const icons: Record<FeedbackVariant, typeof CircleAlert> = {
  loading: LoaderCircle,
  empty: Inbox,
  error: CircleAlert,
  success: CircleCheck,
};

export function Feedback({
  variant,
  title,
  description,
  action,
}: FeedbackProps) {
  const Icon = icons[variant];

  return (
    <section
      className={styles.feedback}
      data-variant={variant}
      role={variant === "error" ? "alert" : "status"}
      aria-live={variant === "error" ? "assertive" : "polite"}
      aria-busy={variant === "loading" || undefined}
    >
      <Icon className={styles.icon} aria-hidden="true" />
      <div className={styles.copy}>
        <h2 className={styles.title}>{title}</h2>
        {description ? (
          <p className={styles.description}>{description}</p>
        ) : null}
      </div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </section>
  );
}
