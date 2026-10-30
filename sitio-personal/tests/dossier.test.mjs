import test from 'node:test'
import assert from 'node:assert/strict'
import { systemPrompt } from '../worker/dossier.js'

test('systemPrompt tiene los datos clave', () => {
  const p = systemPrompt()
  assert.ok(p.length > 500)
  for (const clave of ['Sergio Beltrán Coley', '4.34', 'Foundever', 'ideam.sergiobc.com', 'sergiobeltrancoley@gmail.com', 'APTIS', 'pasaporte español', 'repositorio.cuc.edu.co']) {
    assert.ok(p.includes(clave), clave)
  }
  assert.ok(/no inventes/i.test(p))
})

test('systemPrompt cabe en el presupuesto (~2500 tokens)', () => {
  const p = systemPrompt()
  assert.ok(p.length < 11000, `mide ${p.length}`)
})

test('la edad se calcula segun la fecha', () => {
  assert.ok(systemPrompt(Date.UTC(2026, 6, 5)).includes('Edad: 23 años'))   // antes del cumpleaños
  assert.ok(systemPrompt(Date.UTC(2026, 7, 27)).includes('Edad: 24 años'))  // el día del cumpleaños
  assert.ok(systemPrompt(Date.UTC(2027, 0, 1)).includes('Edad: 24 años'))   // después
})
