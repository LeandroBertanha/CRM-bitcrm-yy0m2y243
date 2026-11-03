import { describe, expect, it } from 'vitest'
import { parseClientDocumentText } from '@/lib/clientDocumentRecognition'

describe('reconhecimento de dados em documentos de clientes', () => {
  it('extrai dados estruturados de um cartão CNPJ', () => {
    const result = parseClientDocumentText(
      `
      NÚMERO DE INSCRIÇÃO 12.345.678/0001-95
      NOME EMPRESARIAL EXEMPLO SERVICOS DIGITAIS LTDA
      TÍTULO DO ESTABELECIMENTO (NOME DE FANTASIA) EXEMPLO DIGITAL
      INSCRIÇÃO ESTADUAL 110.042.490.114
      LOGRADOURO AVENIDA PAULISTA
      NÚMERO 1000
      COMPLEMENTO CONJUNTO 81
      CEP 01310-100
      BAIRRO/DISTRITO BELA VISTA
      MUNICÍPIO SAO PAULO
      UF SP
      TELEFONE (11) 98765-4321
      contato@exemplo.com.br
      `,
      'cnpj_card_files',
    )

    expect(result).toMatchObject({
      legal_name: 'EXEMPLO SERVICOS DIGITAIS LTDA',
      name: 'EXEMPLO DIGITAL',
      cnpj: '12345678000195',
      state_registration: '110.042.490.114',
      street: 'AVENIDA PAULISTA',
      address_number: '1000',
      complement: 'CONJUNTO 81',
      zip_code: '01310100',
      district: 'BELA VISTA',
      city: 'SAO PAULO',
      state: 'SP',
      contact_email: 'contato@exemplo.com.br',
      contact_phone: '(11) 98765-4321',
    })
  })

  it('extrai contratante e representante de contrato', () => {
    const result = parseClientDocumentText(
      `
      CONTRATANTE: ROMAZZINO INCORPORADORA LTDA
      CNPJ: 45.723.174/0001-10
      REPRESENTANTE LEGAL: Maria da Silva
      E-mail: maria@romazzino.com.br
      Telefone: 11 99876-5432
      ENDEREÇO: Rua das Flores, 250, Sala 4
      CEP: 04567-000
      CIDADE: São Paulo
      UF: SP
      `,
      'contract_files',
    )

    expect(result).toMatchObject({
      legal_name: 'ROMAZZINO INCORPORADORA LTDA',
      contact_name: 'Maria da Silva',
      contact_email: 'maria@romazzino.com.br',
      contact_phone: '11 99876-5432',
      street: 'Rua das Flores',
      address_number: '250',
      complement: 'Sala 4',
      zip_code: '04567000',
      city: 'São Paulo',
      state: 'SP',
    })
    expect(result.name).toBeUndefined()
  })

  it('ignora CNPJ inválido', () => {
    const result = parseClientDocumentText('CNPJ: 11.111.111/1111-11', 'proposal_files')
    expect(result.cnpj).toBeUndefined()
  })

  it('não confunde o início de um e-mail lido pelo OCR com nome de contato', () => {
    const result = parseClientDocumentText(
      'TELEFONE: (11) 98765-4321\ncontatoQexemplo.com.br',
      'cnpj_card_files',
    )
    expect(result.contact_name).toBeUndefined()
  })
})
