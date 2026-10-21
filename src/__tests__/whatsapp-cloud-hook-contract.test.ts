import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const hookSource = readFileSync(
  new URL('../../pocketbase/hooks/whatsapp_cloud_api.js', import.meta.url),
  'utf8',
)

describe('WhatsApp Cloud API hook contract', () => {
  it('uses a configurable current Graph API version', () => {
    expect(hookSource).toContain("$os.getenv('WHATSAPP_GRAPH_API_VERSION')")
    expect(hookSource).toContain("'v26.0'")
    expect(hookSource).not.toContain('graph.facebook.com/v21.0')
  })

  it('requires an approved template for follow-up until inbound webhook evidence exists', () => {
    expect(hookSource).toContain(
      'Follow-up exige template aprovado pela Meta enquanto não houver confirmação de mensagem recebida pelo webhook.',
    )
    expect(hookSource).not.toContain("noteType === 'ligacao'")
    expect(hookSource).not.toContain("noteText.includes('cliente respondeu')")
    expect(hookSource).not.toMatch(/type:\s*'text',\s*text:\s*\{\s*body:/)
  })

  it('persists the selected product default pricing only after Meta confirms the send', () => {
    expect(hookSource).toContain("oppRecord.set('product', selectedProductPricing.productId)")
    expect(hookSource).toContain(
      "oppRecord.set('product_name', selectedProductPricing.productName)",
    )
    expect(hookSource).toContain("oppRecord.set('value', selectedProductPricing.setupValue)")
    expect(hookSource).toContain(
      "oppRecord.set('recurring_value', selectedProductPricing.recurringValue)",
    )
    expect(hookSource.indexOf('if (!sendSuccess)')).toBeLessThan(
      hookSource.indexOf("oppRecord.set('product', selectedProductPricing.productId)"),
    )
  })
})
