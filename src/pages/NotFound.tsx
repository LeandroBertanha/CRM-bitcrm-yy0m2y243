import React from 'react'
import { Link } from 'react-router-dom'
import { BrandLogo } from '@/components/BrandLogo'
import { Button } from '@/components/ui/button'
import { AlertCircle, Home } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#0A0B0E] text-white text-center">
      <div className="w-full max-w-md space-y-6 animate-fadeInUp">
        <BrandLogo variant="full" size="lg" className="mx-auto mb-2" />
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8" />
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight">404 - Página Não Encontrada</h1>
        <p className="text-sm text-gray-400">
          A rota solicitada não existe ou foi movida no sistema bitCRM.
        </p>
        <Button asChild className="bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl">
          <Link to="/">
            <Home className="w-4 h-4 mr-2" />
            Voltar para o Início
          </Link>
        </Button>
      </div>
    </div>
  )
}
