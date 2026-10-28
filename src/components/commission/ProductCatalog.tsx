import { useCallback, useEffect, useState } from 'react'
import { Edit3, Loader2, PackagePlus, Plus, RefreshCw, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { getAllProducts, saveProduct } from '@/services/productService'
import type { Product } from '@/types/crm'

type ProductForm = {
  name: string
  description: string
  setupValue: string
  recurringValue: string
  recurringInterval: string
  commissionRulesNote: string
  displayOrder: string
  isActive: boolean
}

const EMPTY_FORM: ProductForm = {
  name: '',
  description: '',
  setupValue: '',
  recurringValue: '',
  recurringInterval: 'mensal',
  commissionRulesNote: '',
  displayOrder: '0',
  isActive: true,
}

function parseMoney(value: string): number {
  const normalized = value.trim().replace(/\./g, '').replace(',', '.')
  return Math.max(0, Number(normalized) || 0)
}

function formatMoneyInput(value?: number): string {
  return value === undefined || value === null ? '' : value.toFixed(2).replace('.', ',')
}

export default function ProductCatalog() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<ProductForm>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadProducts = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setProducts(await getAllProducts())
    } catch (err) {
      console.error('Erro ao carregar catálogo de produtos:', err)
      setError('Não foi possível carregar o catálogo de produtos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  const startNew = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM, displayOrder: String(products.length + 1) })
    setError(null)
    setSuccess(null)
    setShowForm(true)
  }

  const startEdit = (product: Product) => {
    setEditingId(product.id)
    setForm({
      name: product.name,
      description: product.description || '',
      setupValue: formatMoneyInput(product.setup_value),
      recurringValue: formatMoneyInput(product.recurring_value),
      recurringInterval: product.recurring_interval || 'mensal',
      commissionRulesNote: product.commission_rules_note || '',
      displayOrder: String(product.display_order || 0),
      isActive: product.is_active !== false,
    })
    setError(null)
    setSuccess(null)
    setShowForm(true)
  }

  const updateForm = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const handleSave = async () => {
    if (!form.name.trim()) {
      setError('Informe o nome do produto.')
      return
    }
    if (!form.setupValue.trim()) {
      setError('Informe o valor de setup/implantação.')
      return
    }

    try {
      setSaving(true)
      setError(null)
      setSuccess(null)
      await saveProduct(
        {
          name: form.name.trim(),
          description: form.description.trim(),
          setup_value: parseMoney(form.setupValue),
          recurring_value: parseMoney(form.recurringValue),
          recurring_interval: form.recurringInterval.trim() || 'mensal',
          commission_base_type: 'setup',
          commission_rules_note: form.commissionRulesNote.trim(),
          display_order: Math.max(0, parseInt(form.displayOrder, 10) || 0),
          is_active: form.isActive,
        },
        editingId || undefined,
      )
      setSuccess(editingId ? 'Produto atualizado com sucesso.' : 'Produto cadastrado com sucesso.')
      setShowForm(false)
      setEditingId(null)
      setForm(EMPTY_FORM)
      await loadProducts()
    } catch (err) {
      console.error('Erro ao salvar produto:', err)
      setError(
        'Não foi possível salvar o produto. Confirme sua sessão de proprietário e tente novamente.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-2xl border border-[#262A33] bg-[#12141A] p-5 shadow-xl sm:p-6">
        <div className="flex flex-col gap-3 border-b border-[#262A33] pb-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/10 p-2 text-indigo-400">
              <PackagePlus className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Catálogo de produtos</h2>
              <p className="text-xs text-gray-400">
                Produtos ativos ficam disponíveis para todos nos campos de escolha do bitCRM.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadProducts}
              disabled={loading}
              className="h-9 rounded-xl border-[#262A33] bg-transparent text-gray-300"
            >
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
            <Button
              size="sm"
              onClick={startNew}
              className="h-9 rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" /> Novo produto
            </Button>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-rose-600/40 bg-rose-950/40 p-3 text-xs text-rose-200">
            {error}
          </div>
        )}
        {success && (
          <div className="mt-4 rounded-xl border border-emerald-600/40 bg-emerald-950/40 p-3 text-xs text-emerald-200">
            {success}
          </div>
        )}

        {showForm && (
          <div className="mt-5 space-y-4 rounded-xl border border-indigo-500/30 bg-[#0E1017] p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white">
                {editingId ? 'Editar produto' : 'Cadastrar produto'}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowForm(false)}
                className="h-8 w-8 text-gray-400"
                title="Fechar formulário"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-xs font-semibold text-gray-300">
                Nome do produto *
                <Input
                  value={form.name}
                  onChange={(event) => updateForm('name', event.target.value)}
                  className="border-[#262A33] bg-[#12141A] text-white"
                />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-gray-300">
                Ordem de exibição
                <Input
                  type="number"
                  min="0"
                  value={form.displayOrder}
                  onChange={(event) => updateForm('displayOrder', event.target.value)}
                  className="border-[#262A33] bg-[#12141A] text-white"
                />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-gray-300">
                Setup / implantação (R$) *
                <Input
                  inputMode="decimal"
                  value={form.setupValue}
                  onChange={(event) => updateForm('setupValue', event.target.value)}
                  placeholder="0,00"
                  className="border-[#262A33] bg-[#12141A] text-white"
                />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-gray-300">
                Mensalidade / recorrência (R$)
                <Input
                  inputMode="decimal"
                  value={form.recurringValue}
                  onChange={(event) => updateForm('recurringValue', event.target.value)}
                  placeholder="0,00"
                  className="border-[#262A33] bg-[#12141A] text-white"
                />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-gray-300">
                Intervalo da recorrência
                <Input
                  value={form.recurringInterval}
                  onChange={(event) => updateForm('recurringInterval', event.target.value)}
                  placeholder="mensal"
                  className="border-[#262A33] bg-[#12141A] text-white"
                />
              </label>
              <div className="flex items-center justify-between rounded-xl border border-[#262A33] bg-[#12141A] px-3 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-gray-300">Produto ativo</p>
                  <p className="text-[11px] text-gray-500">Disponível nos seletores do sistema</p>
                </div>
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(checked) => updateForm('isActive', checked)}
                />
              </div>
              <label className="space-y-1.5 text-xs font-semibold text-gray-300 md:col-span-2">
                Descrição
                <Textarea
                  value={form.description}
                  onChange={(event) => updateForm('description', event.target.value)}
                  className="min-h-20 border-[#262A33] bg-[#12141A] text-white"
                />
              </label>
              <label className="space-y-1.5 text-xs font-semibold text-gray-300 md:col-span-2">
                Regra de comissão
                <Textarea
                  value={form.commissionRulesNote}
                  onChange={(event) => updateForm('commissionRulesNote', event.target.value)}
                  className="min-h-20 border-[#262A33] bg-[#12141A] text-white"
                />
              </label>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-indigo-600 text-white hover:bg-indigo-500"
              >
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Salvar produto
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowForm(false)}
                className="rounded-xl border-[#262A33] bg-transparent text-gray-300"
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}

        <div className="mt-5 overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
            </div>
          ) : products.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-500">Nenhum produto cadastrado.</p>
          ) : (
            <table className="w-full min-w-[760px] border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-[#262A33] text-[10px] uppercase tracking-wider text-gray-400">
                  <th className="px-3 py-3">Produto</th>
                  <th className="px-3 py-3 text-right">Setup</th>
                  <th className="px-3 py-3 text-right">Recorrência</th>
                  <th className="px-3 py-3 text-center">Status</th>
                  <th className="px-3 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262A33]/70">
                {products.map((product) => (
                  <tr key={product.id} className="hover:bg-[#181B24]">
                    <td className="px-3 py-3">
                      <strong className="block text-sm text-white">{product.name}</strong>
                      <span className="line-clamp-1 text-[11px] text-gray-500">
                        {product.description || 'Sem descrição'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold text-white">
                      {product.setup_value.toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                    </td>
                    <td className="px-3 py-3 text-right text-gray-300">
                      {(product.recurring_value || 0).toLocaleString('pt-BR', {
                        style: 'currency',
                        currency: 'BRL',
                      })}
                      {product.recurring_interval ? ` / ${product.recurring_interval}` : ''}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                          product.is_active !== false
                            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                            : 'border-gray-600/40 bg-gray-800/40 text-gray-400'
                        }`}
                      >
                        {product.is_active !== false ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => startEdit(product)}
                        className="h-8 rounded-lg border-[#262A33] bg-transparent text-gray-300"
                      >
                        <Edit3 className="mr-1.5 h-3.5 w-3.5" /> Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
