// motor-prestamos.test.ts
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  interesDelPeriodo,
  devengarPeriodo,
  aplicarPago,
  type Prestamo,
} from "./motor-prestamos";

const nuevoPrestamo = (over: Partial<Prestamo> = {}): Prestamo => ({
  capitalInicial: 1_000_000,
  saldoCapital: 1_000_000,
  tasaMensual: 0.1,
  modoInteres: "sobre_saldo",
  interesPendiente: 0,
  ...over,
});

test("modo sobre_saldo: el interés baja a medida que abonan capital", () => {
  let p = nuevoPrestamo({ modoInteres: "sobre_saldo" });

  // Mes 1: interés sobre 1.000.000 = 100.000; pagan 200.000
  p = devengarPeriodo(p);
  assert.equal(p.interesPendiente, 100_000);
  ({ prestamo: p } = aplicarPago(p, 200_000));
  assert.equal(p.saldoCapital, 900_000);

  // Mes 2: interés ahora sobre el saldo (900.000) = 90.000  <-- la clave
  assert.equal(interesDelPeriodo(p), 90_000);
});

test("modo sobre_capital_inicial: el interés se mantiene fijo (caso del usuario)", () => {
  let p = nuevoPrestamo({ modoInteres: "sobre_capital_inicial" });

  // Mes 1: interés = 100.000; pagan 200.000 -> 100.000 interés + 100.000 capital
  p = devengarPeriodo(p);
  assert.equal(p.interesPendiente, 100_000);
  let res;
  ({ prestamo: p, resultado: res } = aplicarPago(p, 200_000));
  assert.equal(res.montoInteres, 100_000);
  assert.equal(res.montoCapital, 100_000);
  assert.equal(p.saldoCapital, 900_000);

  // Mes 2: interés SIGUE siendo 100.000 (10% de 1.000.000, no de 900.000)
  assert.equal(interesDelPeriodo(p), 100_000);
});

test("pagar solo el interés: el capital no cambia", () => {
  let p = nuevoPrestamo({ modoInteres: "sobre_saldo" });
  p = devengarPeriodo(p); // interés pendiente = 100.000
  let res;
  ({ prestamo: p, resultado: res } = aplicarPago(p, 100_000));
  assert.equal(res.montoInteres, 100_000);
  assert.equal(res.montoCapital, 0);
  assert.equal(p.saldoCapital, 1_000_000);
  assert.equal(p.interesPendiente, 0);
});

test("interés no pagado se acumula sin capitalizar", () => {
  let p = nuevoPrestamo({ modoInteres: "sobre_capital_inicial" });
  p = devengarPeriodo(p); // mes 1: +100.000
  p = devengarPeriodo(p); // mes 2 sin pagar: +100.000
  assert.equal(p.interesPendiente, 200_000);
  // el capital NO se tocó: sigue en 1.000.000 (no hay interés sobre interés)
  assert.equal(p.saldoCapital, 1_000_000);
});

test("el préstamo se cierra cuando el capital llega a cero", () => {
  let p = nuevoPrestamo({
    modoInteres: "sobre_capital_inicial",
    saldoCapital: 50_000,
  });
  p = devengarPeriodo(p); // interés = 100.000 (sobre capital inicial)
  let res;
  ({ prestamo: p, resultado: res } = aplicarPago(p, 150_000));
  assert.equal(res.montoInteres, 100_000);
  assert.equal(res.montoCapital, 50_000);
  assert.equal(p.saldoCapital, 0);
  assert.equal(res.prestamoSaldado, true);
});

test("pago de más genera excedente (saldo a favor)", () => {
  let p = nuevoPrestamo({ saldoCapital: 50_000, interesPendiente: 0 });
  let res;
  ({ prestamo: p, resultado: res } = aplicarPago(p, 80_000));
  assert.equal(res.montoCapital, 50_000);
  assert.equal(res.excedente, 30_000);
  assert.equal(p.saldoCapital, 0);
});
