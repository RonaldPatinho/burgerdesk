import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SkipLink } from "@/components/ui/SkipLink";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  weight: "700",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "BurgerDesk",
    template: "%s | BurgerDesk",
  },
  description: "Ordena y paga desde tu móvil con BurgerDesk.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={inter.variable}
      data-scroll-behavior="smooth"
    >
      <body>
        <SkipLink href="#contenido-principal">
          Saltar al contenido principal
        </SkipLink>
        {children}
      </body>
    </html>
  );
}
