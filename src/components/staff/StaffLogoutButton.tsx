"use client";

import { LogOut } from "lucide-react";
import { useState } from "react";
import { InternalLogoutDialog } from "@/components/internal/InternalLogoutDialog";
import { Button, type ButtonProps } from "@/components/ui";
import styles from "./StaffLogoutButton.module.css";

interface StaffLogoutButtonProps {
  variant?: ButtonProps["variant"];
  inverse?: boolean;
  className?: string;
  accountLabel?: string;
}

export function StaffLogoutButton({
  variant = "secondary",
  inverse = false,
  className,
  accountLabel = "Personal",
}: StaffLogoutButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className={styles.wrapper}>
      <Button
        type="button"
        variant={variant}
        inverse={inverse}
        fullWidth
        leadingIcon={<LogOut />}
        className={className}
        onClick={() => setDialogOpen(true)}
      >
        Cerrar sesión
      </Button>

      <InternalLogoutDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        endpoint="/api/personal/auth/logout"
        redirectTo="/personal/acceso"
        accountLabel={accountLabel}
      />
    </div>
  );
}
