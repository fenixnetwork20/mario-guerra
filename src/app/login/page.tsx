import Image from 'next/image';
import { ruta } from '@/lib/rutas';
import { redirect } from 'next/navigation';
import { usuarioActual } from '@/lib/auth';
import { FormularioLogin } from '@/componentes/FormularioLogin';

export const dynamic = 'force-dynamic';

export default async function Login() {
  if (await usuarioActual()) redirect('/panel');

  return (
    <div className="min-h-screen grid place-items-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Image src={ruta('/marca/sello.png')} alt="Dr. Mario Guerra"
            width={420} height={420} className="h-28 w-28" priority />
        </div>
        <p className="etiqueta text-center mt-5">Acceso interno</p>
        <div className="tarjeta p-6 mt-4">
          <FormularioLogin />
        </div>
        <p className="text-center text-[12.5px] text-[var(--color-tinta-3)] mt-5">
          Solo para recepción y el doctor.
        </p>
      </div>
    </div>
  );
}
