import type { Metadata } from "next";

import { AccessScreen } from "../../components/auth/AccessScreen";

export const metadata: Metadata = {
  title: "Acceso",
  description: "Acceso y registro provisional para clientes de BurgerDesk.",
};

export default function AccessPage() {
  return <AccessScreen />;
}
