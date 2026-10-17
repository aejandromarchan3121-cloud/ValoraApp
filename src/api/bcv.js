const URL = import.meta.env.VITE_BCV_URL;

export async function fetchBCVRate() {
  const res = await fetch(URL);
  if (!res.ok) throw new Error(`BCV respondió ${res.status}`);
  const d = await res.json();
  const price = Number(d.promedio ?? d.venta ?? d.price);
  if (!price) throw new Error('Formato de tasa BCV no reconocido');
  return { price, at: new Date(d.fechaActualizacion ?? Date.now()) };
}