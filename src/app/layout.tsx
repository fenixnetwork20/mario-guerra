import type { Metadata } from 'next';
import { Montserrat } from 'next/font/google';
import './globals.css';

// La marca usa una geométrica de palo seco; Montserrat es la que calza con el
// logotipo ("DR. MARIO GUERRA" en versalitas anchas).
const montserrat = Montserrat({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--fuente-marca',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Dr. Mario Guerra — Cirujano Plástico',
  description: 'Consultas y gestión de citas del consultorio.',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={montserrat.variable}>
      <head>
        {/* Marca que el JS está vivo antes de pintar. Solo entonces se esconden
            los bloques que aparecen al hacer scroll. */}
        <script dangerouslySetInnerHTML={{ __html: "document.documentElement.classList.add('js')" }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
