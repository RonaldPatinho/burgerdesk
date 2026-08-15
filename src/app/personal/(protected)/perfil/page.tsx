import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { StaffProfileScreen } from "@/components/staff/StaffProfileScreen";
import {
  getStaffAccountOverview,
} from "@/server/internal-auth/repository";
import { getAuthenticatedStaffSession } from "@/server/internal-auth/session";

export const metadata: Metadata = {
  title: "Perfil",
  description: "Información de la cuenta del personal de BurgerDesk.",
};

export const dynamic = "force-dynamic";

export default async function StaffProfilePage() {
  const session = await getAuthenticatedStaffSession();
  if (!session) redirect("/personal/acceso");

  const overview = await getStaffAccountOverview(session.userId);

  return (
    <StaffProfileScreen
      fullName={session.fullName}
      username={session.username}
      email={session.email}
      role={session.role}
      memberSince={overview.memberSince}
      activeShiftStartedAt={overview.activeShiftStartedAt}
    />
  );
}
