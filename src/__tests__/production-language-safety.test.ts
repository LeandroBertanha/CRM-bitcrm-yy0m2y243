import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const html = readFileSync(resolve(process.cwd(), 'index.html'), 'utf8')

describe('proteção contra tradução automática em produção', () => {
  it('declara português do Brasil como idioma da aplicação', () => {
    expect(html).toContain('<html lang="pt-BR" translate="no">')
  })

  it('impede o tradutor do navegador de modificar o DOM do React', () => {
    expect(html).toContain('<meta name="google" content="notranslate" />')
    expect(html).toContain('<body class="notranslate" translate="no">')
    expect(html).toContain('<div id="root" class="notranslate" translate="no"></div>')
  })
})
