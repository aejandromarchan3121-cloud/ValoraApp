import React, { useState } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup, within } from '@testing-library/react';

const topUp = vi.fn();
vi.mock('../src/api/wallet', () => ({ topUpSandbox: (...a) => topUp(...a) }));
const upsert = vi.fn();
vi.mock('../src/lib/supabase', () => ({ supabase: { from: () => ({ upsert: (...a) => upsert(...a) }), rpc: async () => ({}) } }));
vi.mock('recharts', async (orig) => {
  const mod = await orig();
  return { ...mod, ResponsiveContainer: ({ children }) => React.cloneElement(children, { width: 800, height: 320 }) };
});
beforeEach(() => { cleanup(); topUp.mockReset(); upsert.mockReset(); });

import CardTopUpModal from '../src/features/wallet/CardTopUpModal';
import ContributionRate from '../src/features/emergency/ContributionRate';
import CandlestickChart from '../src/features/analytics/CandlestickChart';
import MoneyInput from '../src/components/MoneyInput';

const type = (el, v) => fireEvent.change(el, { target: { value: v } });
const byPh = (p) => screen.getByPlaceholderText(p);

describe('MoneyInput', () => {
  it('formatea miles en vivo, usa coma decimal y respeta max', () => {
    const seen = [];
    const Wrap = () => { const [v, setV] = useState(0); return <MoneyInput value={v} max={500} placeholder="m" onChange={(n, s) => { seen.push([n, s]); setV(n); }} />; };
    render(<Wrap />);
    const i = byPh('m');
    type(i, '1'); type(i, '12'); expect(i.value).toBe('12');
    type(i, '1234'); expect(i.value).toBe('500');                            // 1234 > max → se corrige a 500
    type(i, '25'); type(i, '2500,5'); expect(i.value).toBe('500');
    type(i, '120,5'); expect(i.value).toBe('120,5'); expect(seen.at(-1)).toEqual([120.5, '120.5']);
    fireEvent.blur(i); expect(i.value).toBe('120,50');                       // completa decimales al salir
  });
});

describe('CardTopUpModal', () => {
  const open = (props = {}) => render(<CardTopUpModal open onClose={vi.fn()} onSuccess={props.onSuccess} stepMs={0} />);

  it('valida tarjeta, vencimiento, CVC y monto antes de cobrar', async () => {
    open();
    fireEvent.click(screen.getByRole('button', { name: /pagar/i }));          // botón deshabilitado: monto 0
    expect(topUp).not.toHaveBeenCalled();
    type(byPh('1234 5678 9012 3456'), '4242424242424243'); fireEvent.blur(byPh('1234 5678 9012 3456'));
    type(byPh('MM/AA'), '0920'); fireEvent.blur(byPh('MM/AA'));
    type(byPh('0,00'), '9999');                                                // se corrige al máximo (500)
    expect(byPh('0,00').value).toBe('500');
    const form = byPh('MM/AA').closest('form'); fireEvent.submit(form);
    expect(await screen.findByText('Número de tarjeta inválido.')).toBeTruthy();
    expect(screen.getByText('Fecha inválida o vencida.')).toBeTruthy();
    expect(screen.getByText(/El CVC tiene 3 dígitos/)).toBeTruthy();
    expect(topUp).not.toHaveBeenCalled();
  });

  it('flujo feliz: tarjeta de prueba → procesa → llama a la API SOLO con el monto → muestra éxito', async () => {
    topUp.mockResolvedValue({ status: 'completed', transaction_id: 't1', balance: 125.5 });
    const onSuccess = vi.fn();
    open({ onSuccess });
    fireEvent.click(screen.getByText('Usar tarjeta de prueba'));
    expect(byPh('1234 5678 9012 3456').value).toBe('4242 4242 4242 4242');
    type(byPh('0,00'), '25,5');
    expect(screen.getByText(/≈ 25,50 USDC/)).toBeTruthy();
    fireEvent.submit(byPh('MM/AA').closest('form'));
    expect(await screen.findByText('Recarga completada')).toBeTruthy();
    expect(topUp).toHaveBeenCalledTimes(1);
    const arg = topUp.mock.calls[0][0];
    expect(arg.amountUsd).toBe('25.5');
    expect(typeof arg.key).toBe('string');
    expect(Object.keys(arg).sort()).toEqual(['amountUsd', 'key']);             // ni tarjeta, ni expiración, ni CVC
    expect(JSON.stringify(topUp.mock.calls)).not.toMatch(/4242|123/);
    expect(onSuccess).toHaveBeenCalledWith({ status: 'completed', transaction_id: 't1', balance: 125.5 });
    expect(screen.getByText(/125,50 USDC/)).toBeTruthy();
  });

  it('tarjeta rechazada (simulación): no llama a la API, muestra error y limpia el CVC', async () => {
    open();
    type(byPh('1234 5678 9012 3456'), '4000000000000002');
    type(byPh('MM/AA'), '1230'); type(byPh('•••'), '123'); type(byPh('0,00'), '10');
    fireEvent.submit(byPh('MM/AA').closest('form'));
    expect(await screen.findByText(/El emisor rechazó la tarjeta/)).toBeTruthy();
    expect(topUp).not.toHaveBeenCalled();
    expect(byPh('•••').value).toBe('');
  });

  it('un error del servidor se muestra y permite reintentar con la misma clave de idempotencia', async () => {
    topUp.mockRejectedValueOnce(new Error('Función no disponible.')).mockResolvedValueOnce({ status: 'completed', balance: 10 });
    open();
    fireEvent.click(screen.getByText('Usar tarjeta de prueba')); type(byPh('0,00'), '10');
    fireEvent.submit(byPh('MM/AA').closest('form'));
    expect(await screen.findByText('Función no disponible.')).toBeTruthy();
    type(byPh('•••'), '123'); fireEvent.submit(byPh('MM/AA').closest('form'));
    await screen.findByText('Recarga completada');
    expect(topUp.mock.calls[0][0].key).toBe(topUp.mock.calls[1][0].key);
  });
});

describe('ContributionRate', () => {
  const setup = (pct = 0) => { const onSaved = vi.fn(); render(<ContributionRate fund={{ contribution_pct: pct }} onSaved={onSaved} />); return onSaved; };

  it('slider e input numérico están sincronizados y el tope es 50 %', () => {
    setup(10);
    const slider = screen.getByLabelText('Porcentaje de aporte automático');
    const input = screen.getByLabelText('Porcentaje exacto');
    expect(slider.value).toBe('10'); expect(input.value).toBe('10');
    type(slider, '17.5'); expect(input.value).toBe('17,5');
    type(input, '33,25'); expect(slider.value).toBe('33.25');
    type(input, '75'); expect(input.value).toBe('50'); expect(slider.value).toBe('50');
    expect(screen.getByText(/se apartan/).textContent).toMatch(/USD 50,00/);
  });

  it('guarda el porcentaje exacto con upsert por user_id y avisa', async () => {
    upsert.mockResolvedValue({ error: null });
    const onSaved = setup(0);
    const save = screen.getByRole('button', { name: /guardar porcentaje/i });
    expect(save.disabled).toBe(true);                                         // sin cambios no se puede guardar
    type(screen.getByLabelText('Porcentaje exacto'), '12,5');
    expect(save.disabled).toBe(false);
    fireEvent.click(save);
    await waitFor(() => expect(upsert).toHaveBeenCalledWith({ user_id: 'user-1', contribution_pct: 12.5 }, { onConflict: 'user_id' }));
    expect(await screen.findByText(/apartarás 12.5 % de cada ingreso/)).toBeTruthy();
    expect(onSaved).toHaveBeenCalled();
  });

  it('muestra error si falla y permite descartar', async () => {
    upsert.mockResolvedValue({ error: { message: 'x' } });
    setup(5);
    type(screen.getByLabelText('Porcentaje exacto'), '8');
    fireEvent.click(screen.getByRole('button', { name: /guardar porcentaje/i }));
    expect(await screen.findByText(/No se pudo guardar/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /descartar/i }));
    expect(screen.getByLabelText('Porcentaje exacto').value).toBe('5');
  });
});

describe('CandlestickChart', () => {
  const data = [
    { t: '2026-10-20T04:00:00Z', open: 10, high: 14, low: 8, close: 13, samples: 5 },   // sube
    { t: '2026-10-21T04:00:00Z', open: 13, high: 15, low: 9, close: 10, samples: 4 },   // baja
    { t: '2026-10-22T04:00:00Z', open: 11, high: 11, low: 11, close: 11, samples: 1 },  // plana
  ];
  const metric = { unit: '%', decimals: 2, upIsBad: false };

  it('dibuja una vela por dato con cuerpo dentro de la mecha y colores según dirección', () => {
    const { container } = render(<CandlestickChart data={data} metric={metric} bucket="day" />);
    const candles = container.querySelectorAll('[data-candle]');
    expect(candles.length).toBe(3);
    const [c1, c2, c3] = candles;
    expect(c1.getAttribute('data-candle')).toBe('body'); expect(c3.getAttribute('data-candle')).toBe('flat');
    const geo = (g) => { const l = g.querySelector('line'), r = g.querySelector('rect');
      return { wTop: +l.getAttribute('y1'), wBot: +l.getAttribute('y2'), bTop: +r.getAttribute('y'), bH: +r.getAttribute('height'), color: r.getAttribute('fill') }; };
    const a = geo(c1), b = geo(c2);
    for (const g of [a, b]) { expect(g.bTop).toBeGreaterThanOrEqual(g.wTop - 0.01); expect(g.bTop + g.bH).toBeLessThanOrEqual(g.wBot + 0.01); }
    expect(a.color).toBe('#10b981'); expect(b.color).toBe('#ef4444');             // sube = verde, baja = rojo
    // proporciones: vela 1 (8→14, cuerpo 10→13) ; el cuerpo mide 3/6 de la mecha
    expect(a.bH / (a.wBot - a.wTop)).toBeCloseTo(3 / 6, 1);
    expect(b.bH / (b.wBot - b.wTop)).toBeCloseTo(3 / 6, 1);                       // vela 2: 9→15, cuerpo 10→13
    // mayor valor arriba: el máximo de la vela 2 (15) queda más alto que el de la 1 (14)
    expect(b.wTop).toBeLessThan(a.wTop);
  });

  it('con upIsBad invierte los colores (brecha que sube = rojo)', () => {
    const { container } = render(<CandlestickChart data={data} metric={{ ...metric, upIsBad: true }} bucket="day" />);
    const fills = [...container.querySelectorAll('[data-candle="body"] rect')].map((r) => r.getAttribute('fill'));
    expect(fills).toEqual(['#ef4444', '#10b981']);
  });

  it('sin datos muestra un mensaje en vez de romperse', () => {
    render(<CandlestickChart data={[]} metric={metric} />);
    expect(screen.getByText('Sin datos para mostrar.')).toBeTruthy();
  });
});
