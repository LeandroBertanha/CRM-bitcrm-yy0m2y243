import pb from '@/lib/pocketbase/client'
import type { Product } from '@/types/crm'

/**
 * Busca todos os produtos ativos do catálogo, ordenados por display_order e nome.
 * Lido 100% do banco, sem valores hardcoded.
 */
export async function getActiveProducts(): Promise<Product[]> {
  try {
    return await pb.collection('products').getFullList<Product>({
      filter: 'is_active = true',
      sort: 'display_order,name',
    })
  } catch (err) {
    console.error('Erro ao buscar produtos ativos:', err)
    return []
  }
}

/**
 * Busca produto específico por ID ou pelo nome exato.
 */
export async function getProductById(id: string): Promise<Product | null> {
  try {
    return await pb.collection('products').getOne<Product>(id)
  } catch {
    return null
  }
}

export async function getProductByName(name: string): Promise<Product | null> {
  try {
    return await pb.collection('products').getFirstListItem<Product>(`name = "${name}"`)
  } catch {
    return null
  }
}

/**
 * Cria ou atualiza um produto no catálogo (apenas administradores têm permissão na regra da collection).
 */
export async function saveProduct(data: Partial<Product>, id?: string): Promise<Product> {
  if (id) {
    return pb.collection('products').update<Product>(id, data)
  }
  return pb.collection('products').create<Product>(data)
}
