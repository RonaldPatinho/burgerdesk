import type { Metadata } from "next";
import { AdminStaffScreen } from "@/components/admin/AdminStaffScreen";
import { listAdminStaffMembers } from "@/server/internal-auth/admin-staff-repository";

export const metadata: Metadata = {
  title: "Personal",
  description: "Gestión de cuentas internas del Personal de BurgerDesk.",
};

export const dynamic = "force-dynamic";

type StaffSearchParams = { q?: string | string[] };

export default async function AdministratorStaffPage({
  searchParams,
}: {
  searchParams: Promise<StaffSearchParams>;
}) {
  const params = await searchParams;
  const search = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const staff = await listAdminStaffMembers(search);
  return <AdminStaffScreen initialStaff={staff} initialSearch={search} />;
}
