import test from 'node:test'
import assert from 'node:assert/strict'
import { SYSTEM_PROMPT } from '../worker/dossier.js'

test('SYSTEM_PROMPT tiene los datos clave', () => {
  assert.ok(SYSTEM_PROMPT.length > 500)
  for (const clave of ['Sergio Beltrán Coley', '4.34', 'Foundever', 'ideam.sergiobc.com', 'sergiobeltrancoley@gmail.com']) {
    assert.ok(SYSTEM_PROMPT.includes(clave), clave)
  }
  assert.ok(/no inventes/i.test(SYSTEM_PROMPT))
})

test('SYSTEM_PROMPT cabe en el presupuesto (~2500 tokens)', () => {
  assert.ok(SYSTEM_PROMPT.length < 10000, `mide ${SYSTEM_PROMPT.length}`)
})
