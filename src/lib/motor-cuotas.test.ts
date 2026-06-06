// motor-cuotas.test.ts — préstamos tipo 'cuotas' (cronograma pactado).
// Las 6 pruebas del modelo "abierto" viven en motor-prestamos.test.ts y no se tocan.
import { test } from "vitest";
import assert from "node:assert/strict";
import {
  generarCronograma,
  aplicarPagoACuotas,
  pagarSoloInteres,
  type Cuota,
} from "./motor-prestamos";

const total = (cuotas: Cuota[]): number =>
  cuotas.reduce((s, c) => s + c.capital + c.interes, 0);

test("generarCronograma quincenal: 4 cuotas de 250.000 cap + 50.000 int (total 1.200.000)", () => {
  const c = generarCronograma(1_000_000, 0.1, "quincenal", 4);
  assert.equal(c.length, 4);
  for (const cuota of c) {
    assert.equal(cuota.capital, 250_000);
    assert.equal(cuota.interes, 50_000);
    assert.equal(cuota.estado, "pendiente");
  }
  assert.equal(total(c), 1_200_000);
});

test("generarCronograma mensual: la última cuota absorbe el redondeo de capital", () => {
  const c = generarCronograma(1_000_000, 0.1, "mensual", 3);
  assert.deepEqual(
    c.map((x) => [x.capital, x.interes]),
    [
      [333_333, 100_000],
      [333_333, 100_000],
      [333_334, 100_000],
    ]
  );
  assert.equal(
    c.reduce((s, x) => s + x.capital, 0),
    1_000_000
  ); // capital cuadra exacto
  assert.equal(total(c), 1_300_000);
});

test("generarCronograma semanal: 4 semanas = 1 mes (tasa 20% -> total 1.200.000)", () => {
  const c = generarCronograma(1_000_000, 0.2, "semanal", 4);
  assert.equal(c.length, 4);
  for (const cuota of c) {
    assert.equal(cuota.capital, 250_000);
    assert.equal(cuota.interes, 50_000);
  }
  assert.equal(total(c), 1_200_000);
});

test("aplicarPagoACuotas: el excedente baja solo el capital de las cuotas siguientes", () => {
  const base = generarCronograma(1_000_000, 0.1, "quincenal", 4); // 4 × {250.000, 50.000}
  const { cuotas, sobrante } = aplicarPagoACuotas(base, 400_000);

  assert.equal(cuotas[0].estado, "pagada");
  assert.equal(cuotas[0].capital, 0);
  assert.equal(cuotas[0].interes, 0);
  // cuota 2: solo bajó capital (250.000 -> 150.000); el interés intacto.
  assert.equal(cuotas[1].capital, 150_000);
  assert.equal(cuotas[1].interes, 50_000);
  assert.equal(cuotas[1].estado, "pendiente");
  assert.equal(sobrante, 0);
  assert.equal(total(cuotas), 800_000);
});

test("pagarSoloInteres: corre el capital a una cuota nueva que repite el mismo interés", () => {
  const base = generarCronograma(1_000_000, 0.1, "quincenal", 4);
  const c = pagarSoloInteres(base);

  assert.equal(c[0].estado, "pagada");
  assert.equal(c[0].capital, 0);
  assert.equal(c[0].interes, 0);
  assert.equal(c.length, 5);
  // cuota nueva al final: mismo capital + MISMO interés que la impaga (penalización).
  assert.equal(c[4].numero, 5);
  assert.equal(c[4].capital, 250_000);
  assert.equal(c[4].interes, 50_000);
  assert.equal(total(c), 1_200_000); // la suma pendiente se conserva...
});

test("INVARIANTE: adelantar nunca baja el total; pagar solo-interés siempre lo sube", () => {
  const base = generarCronograma(1_000_000, 0.1, "quincenal", 4);
  const totalAntes = total(base); // 1.200.000

  // Adelantar: total = pagado + pendiente se conserva (no baja).
  const pago = aplicarPagoACuotas(base, 400_000);
  const aplicado = 400_000 - pago.sobrante;
  assert.equal(aplicado + total(pago.cuotas), totalAntes);

  // Solo-interés: el cliente paga el interés vigente y el pendiente NO baja -> total sube.
  const interesVigente = base[0].interes; // 50.000
  const cuotasSolo = pagarSoloInteres(base);
  assert.ok(interesVigente > 0);
  assert.ok(interesVigente + total(cuotasSolo) > totalAntes);
});
