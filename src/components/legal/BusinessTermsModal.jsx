import { useState } from 'react';
import { Button } from '../../components/ui'

export default function BusinessTermsModal({ open, onAccept }) {
  const [agreed, setAgreed] = useState(false);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 flex flex-col max-h-[85vh]">
        
        <div className="pb-4 border-b border-zinc-200 dark:border-zinc-800">
          <h3 className="text-xl font-bold">Acuerdo de Servicios Tecnológicos B2B</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Términos y Condiciones para Comercios y Personas Jurídicas.
          </p>
        </div>

        {/* Texto Legal del Contrato */}
        <div className="my-4 overflow-y-auto space-y-3 text-xs text-zinc-600 dark:text-zinc-300 pr-2">
          <p>
            <strong>1. Naturaleza del Servicio:</strong> ValoraApp opera exclusivamente como una plataforma tecnológica facilitadora e intermediaria de pasarelas de pago y conversión de activos digitales (USDT/USDC). ValoraApp no constituye una institución bancaria tradicional ni una entidad de depósito financiero de ahorro masivo.
          </p>
          <p>
            <strong>2. Responsabilidad de Terceros:</strong> ValoraApp no asume responsabilidad civil o mercantil por interrupciones temporales, retrasos o fallas operativas derivadas de proveedores externos, redes de blockchain (Polygon/Base), la infraestructura de Binance Pay o los operadores bancarios locales (Bs./COP).
          </p>
          <p>
            <strong>3. Cumplimiento KYB y Legitimación de Capitales:</strong> El comercio registrado garantiza que los fondos operados provienen de actividades mercantiles lícitas y se compromete a aportar la documentación jurídica requerida (RIF/NIT y datos del representante legal) cuando la plataforma lo solicite.
          </p>
          <p>
            <strong>4. Límites Transaccionales:</strong> Las operaciones están sujetas a los topes operativos vigentes de acuerdo con el perfil verificado del comercio.
          </p>
        </div>

        {/* Checkbox de aceptación */}
        <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
          <input 
            type="checkbox" 
            id="terms" 
            checked={agreed} 
            onChange={(e) => setAgreed(e.target.checked)}
            className="h-4 w-4 rounded border-zinc-300 text-emerald-600 focus:ring-emerald-500"
          />
          <label htmlFor="terms" className="text-xs font-medium cursor-pointer">
            He leído y acepto los Términos Comerciales y el Contrato de Servicios B2B en representación de mi empresa.
          </label>
        </div>

        <div className="mt-4">
          <Button 
            disabled={!agreed} 
            onClick={onAccept}
            className="w-full"
          >
            Continuar a la Plataforma
          </Button>
        </div>

      </div>
    </div>
  );
}