import React, { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { BrandLogo } from '@/components/BrandLogo'
import { Button } from '@/components/ui/button'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function VerifyEmail() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''

  const [loading, setLoading] = useState(true)
  const [success, setSuccess] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setLoading(false)
      setErrorMessage('Token de verificação ausente ou link incompleto.')
      return
    }

    const verify = async () => {
      try {
        await pb.collection('users').confirmVerification(token)
        setSuccess(true)
      } catch {
        setErrorMessage('Não foi possível verificar o e-mail. O link pode ter expirado.')
      } finally {
        setLoading(false)
      }
    }

    verify()
  }, [token])

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden bg-[#0A0B0E]">
      <div className="w-full max-w-md relative z-10 animate-fadeInUp">
        <div className="flex flex-col items-center text-center mb-8">
          <BrandLogo size="lg" className="mb-4" />
          <h1 className="text-2xl font-bold tracking-tight text-white mt-2">
            Verificação de E-mail
          </h1>
        </div>

        <div className="bg-[#12141A] border border-[#262A33] rounded-2xl p-7 shadow-2xl text-center">
          {loading ? (
            <div className="py-8 space-y-4">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mx-auto" />
              <p className="text-sm text-gray-400">Verificando sua conta comercial...</p>
            </div>
          ) : success ? (
            <div className="py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-semibold text-white">E-mail verificado com sucesso!</h2>
              <p className="text-sm text-gray-400">
                Sua conta de vendedor no bitCRM está ativa e pronta para uso.
              </p>
              <div className="pt-4">
                <Button asChild className="w-full bg-indigo-600 hover:bg-indigo-500 text-white">
                  <Link to="/login">Fazer Login</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 flex items-center justify-center mx-auto">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-semibold text-white">Falha na verificação</h2>
              <p className="text-sm text-red-300">{errorMessage}</p>
              <div className="pt-4">
                <Button asChild variant="outline" className="w-full border-[#262A33] text-gray-300">
                  <Link to="/login">Voltar ao Login</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
