import { useEffect, useState } from 'react'
import Modal from '@/components/Modal'
import Boton from '@/components/ui/Boton'
import Campo from '@/components/ui/Campo'
import { validarCampo, validarReferencia, type CampoTexto, type DatosFicha, type Referencia } from '@/lib/ficha'
import { GRUPOS_REVISION } from '@/lib/revision'

type Ref = 'referencia_1' | 'referencia_2'
const esRef = (c: string): c is Ref => c === 'referencia_1' || c === 'referencia_2'
/** Lo que el dueño no corrige: el celular viene del enlace; sexo y RH, solo del código. */
const NO_EDITABLES = new Set(['celular', 'sexo', 'rh'])
/** Siempre se pueden corregir, aunque el prospecto no los haya enviado. */
const SIEMPRE = new Set(['cedula', 'nombres', 'apellidos'])

/**
 * Corrección de datos antes de aprobar. Valida con las mismas reglas del
 * formulario del prospecto (_shared/ficha.ts). No guarda nada: devuelve los datos
 * corregidos, que viajan con "Aprobar" (el servidor marca "Corregido por el dueño").
 */
export default function CorregirDatosModal({
  open,
  datos,
  onClose,
  onGuardar,
}: {
  open: boolean
  datos: DatosFicha
  onClose: () => void
  onGuardar: (datos: DatosFicha) => void
}) {
  const [textos, setTextos] = useState<Record<string, string>>({})
  const [refs, setRefs] = useState<Partial<Record<Ref, Partial<Referencia>>>>({})
  const [errores, setErrores] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!open) return
    const t: Record<string, string> = {}
    for (const [k, v] of Object.entries(datos)) if (typeof v === 'string') t[k] = v
    setTextos(t)
    setRefs({ referencia_1: datos.referencia_1, referencia_2: datos.referencia_2 })
    setErrores({})
  }, [open, datos])

  const grupos = GRUPOS_REVISION.map((g) => ({
    ...g,
    campos: g.campos.filter(
      (c) => !NO_EDITABLES.has(c.campo) && (SIEMPRE.has(c.campo) || datos[c.campo as keyof DatosFicha] !== undefined),
    ),
  })).filter((g) => g.campos.length > 0)

  function guardar() {
    const nuevos: Record<string, string> = {}
    const salida: DatosFicha = { ...datos }
    for (const g of grupos) {
      for (const { campo } of g.campos) {
        if (esRef(campo)) {
          const r = refs[campo]
          const vacia = !r || (!r.nombre?.trim() && !r.telefono?.trim() && !r.parentesco?.trim())
          if (vacia) {
            delete salida[campo]
            continue
          }
          const [ref, errs] = validarReferencia(r)
          if (ref) salida[campo] = ref
          for (const [k, e] of Object.entries(errs)) nuevos[`${campo}.${k}`] = e
          continue
        }
        const [valor, error] = validarCampo(campo as CampoTexto, textos[campo] ?? '')
        if (error) nuevos[campo] = error
        else if (!valor && SIEMPRE.has(campo)) nuevos[campo] = 'Este dato es obligatorio.'
        else if (valor) (salida as Record<string, unknown>)[campo] = valor
        else delete (salida as Record<string, unknown>)[campo]
      }
    }
    setErrores(nuevos)
    if (Object.keys(nuevos).length) return
    onGuardar(salida)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      titulo="Corregir datos"
      footer={
        <>
          <Boton variante="secundario" onClick={onClose}>
            Cancelar
          </Boton>
          <Boton onClick={guardar}>Usar estos datos</Boton>
        </>
      }
    >
      <p className="mb-4 text-[14px] text-tinta-2">
        Lo que cambie queda marcado «Corregido por el dueño» en la ficha del cliente. Se guarda al aprobar.
      </p>
      <div className="flex flex-col gap-5">
        {grupos.map((g) => (
          <fieldset key={g.titulo} className="flex flex-col gap-3">
            <legend className="mb-1 text-[13px] font-semibold text-tinta">{g.titulo}</legend>
            {g.campos.map(({ campo, nombre }) =>
              esRef(campo) ? (
                <div key={campo} className="flex flex-col gap-2 rounded-control border border-borde p-3">
                  <p className="text-[13px] font-semibold text-tinta-2">{nombre}</p>
                  {(['nombre', 'telefono', 'parentesco'] as const).map((k) => (
                    <Campo key={k} etiqueta={{ nombre: 'Nombre', telefono: 'Teléfono', parentesco: 'Parentesco' }[k]} error={errores[`${campo}.${k}`]}>
                      {(p) => (
                        <input
                          className="input"
                          {...p}
                          inputMode={k === 'telefono' ? 'tel' : undefined}
                          value={refs[campo]?.[k] ?? ''}
                          onChange={(e) => setRefs((x) => ({ ...x, [campo]: { ...x[campo], [k]: e.target.value } }))}
                        />
                      )}
                    </Campo>
                  ))}
                </div>
              ) : (
                <Campo key={campo} etiqueta={nombre} error={errores[campo]}>
                  {(p) =>
                    campo === 'tipo_vivienda' ? (
                      <select className="select" {...p} value={textos[campo] ?? ''} onChange={(e) => setTextos((x) => ({ ...x, [campo]: e.target.value }))}>
                        <option value="">Elija una opción</option>
                        <option value="propia">Propia</option>
                        <option value="arriendo">Arriendo</option>
                        <option value="familiar">Familiar</option>
                      </select>
                    ) : (
                      <input
                        className="input"
                        {...p}
                        type={campo === 'fecha_nacimiento' ? 'date' : campo === 'correo' ? 'email' : 'text'}
                        inputMode={campo === 'cedula' || campo === 'ingresos' || campo === 'telefono_alterno' ? 'numeric' : undefined}
                        value={textos[campo] ?? ''}
                        onChange={(e) => setTextos((x) => ({ ...x, [campo]: e.target.value }))}
                      />
                    )
                  }
                </Campo>
              ),
            )}
          </fieldset>
        ))}
      </div>
    </Modal>
  )
}
