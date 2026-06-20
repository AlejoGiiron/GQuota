// motor-cuota-fija.test.ts — préstamos tipo 'cuota_fija' (cuotas de monto fijo).
// El más simple de los tres: sin tasa, sin separar capital/interés, el pago
// llena cuotas en orden. Las pruebas de 'abierto' y 'cuotas' pactadas no se tocan.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  generarCronogramaFijo,
  resumenCuotaFija,
  aplicarPagoFijo,
  type CuotaFija,
} from "./motor-prestamos";

const saldo = (cuotas: CuotaFija[]): number =>
  cuotas.reduce((s, c) => s + (c.valor - c.abonado), 0);

test("resumenCuotaFija: total = nCuotas × valor, ganancia = total − capital", () => {
  const r = resumenCuotaFija(200_000, 25, 10_000);
  assert.equal(r.total, 250_000);
  assert.equal(r.ganancia, 50_000);
});

test("resumenCuotaFija: la ganancia puede ser negativa (la UI alerta)", () => {
  const r = resumenCuotaFija(200_000, 15, 10_000);
  assert.equal(r.total, 150_000);
  assert.equal(r.ganancia, -50_000);
});

test("aplicarPagoFijo: un abono parcial deja la primera cuota 'parcial'", () => {
  const base = generarCronogramaFijo(25, 10_000); // saldo 250.000
  const { cuotas, sobrante } = aplicarPagoFijo(base, 5_000);
  assert.equal(cuotas[0].estado, "parcial");
  assert.equal(cuotas[0].abonado, 5_000);
  assert.equal(cuotas[1].estado, "pendiente");
  assert.equal(sobrante, 0);
  assert.equal(saldo(cuotas), 245_000);
});

test("aplicarPagoFijo: el pago llena cuotas en orden y deja la siguiente parcial", () => {
  const base = generarCronogramaFijo(25, 10_000);
  const { cuotas, sobrante } = aplicarPagoFijo(base, 35_000);
  assert.equal(cuotas[0].estado, "pagada");
  assert.equal(cuotas[1].estado, "pagada");
  assert.equal(cuotas[2].estado, "pagada");
  assert.equal(cuotas[3].estado, "parcial");
  assert.equal(cuotas[3].abonado, 5_000);
  assert.equal(sobrante, 0);
  assert.equal(saldo(cuotas), 215_000);
});

test("aplicarPagoFijo: abonar a una cuota ya parcial la completa", () => {
  const base = generarCronogramaFijo(25, 10_000);
  const paso1 = aplicarPagoFijo(base, 35_000); // cuota 4 parcial (5.000)
  const { cuotas, sobrante } = aplicarPagoFijo(paso1.cuotas, 5_000);
  assert.equal(cuotas[3].estado, "pagada");
  assert.equal(cuotas[3].abonado, 10_000);
  assert.equal(cuotas[4].estado, "pendiente");
  assert.equal(sobrante, 0);
  assert.equal(saldo(cuotas), 210_000);
});

test("aplicarPagoFijo: pagar el saldo completo deja todas las cuotas 'pagada'", () => {
  const base = generarCronogramaFijo(25, 10_000); // saldo 250.000
  const { cuotas, sobrante } = aplicarPagoFijo(base, 250_000);
  assert.ok(cuotas.every((c) => c.estado === "pagada"));
  assert.equal(saldo(cuotas), 0);
  assert.equal(sobrante, 0);
});

test("aplicarPagoFijo: si el monto excede el saldo, el resto vuelve como sobrante", () => {
  const base = generarCronogramaFijo(25, 10_000); // saldo 250.000
  const { cuotas, sobrante } = aplicarPagoFijo(base, 300_000);
  assert.ok(cuotas.every((c) => c.estado === "pagada"));
  assert.equal(saldo(cuotas), 0);
  assert.equal(sobrante, 50_000);
});
