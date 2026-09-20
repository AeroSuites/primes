import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Plane, LogIn, KeyRound } from 'lucide-react'

export default function Login({ onGoRegister }) {
  const { login } = useAuth()
  const [identifiant, setIdentifiant] = useState('')
  const [mdp, setMdp] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!identifiant.trim() || !mdp) {
      setError("Renseignez l'identifiant et le mot de passe.")
      return
    }
    setBusy(true)
    setError('')
    const res = await login(identifiant, mdp)
    if (!res.ok) setError(res.error)
    setBusy(false)
  }

  return (
    <div className="auth-screen min-h-screen flex items-center justify-center p-4">
      <div className="relative z-10 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl w-full max-w-md p-6 overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-1.5 bg-[#e4002b]" />
        <div className="flex items-center justify-center gap-3 mb-1">
          <Plane className="h-7 w-7 text-[#002157]" />
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-[0.18em] text-[#002157]">
            AEROPRIMES
          </h1>
        </div>
        <p className="text-center text-slate-500 mb-6">
          Déclaration des interventions (prime toilettes). Connectez-vous avec votre identifiant
          personnel.
        </p>

        <div className="space-y-3">
          <input
            value={identifiant}
            onChange={(e) => setIdentifiant(e.target.value)}
            placeholder="Identifiant"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:border-[#003a8c] focus:outline-none"
            autoFocus
          />
          <input
            value={mdp}
            onChange={(e) => setMdp(e.target.value)}
            type="password"
            placeholder="Mot de passe"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:border-[#003a8c] focus:outline-none"
          />
          {error && <p className="text-sm text-[#e4002b]">{error}</p>}
          <button
            onClick={submit}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 bg-[#002157] text-white px-4 py-2 rounded-md hover:bg-[#003a8c] disabled:opacity-50 text-sm font-semibold"
          >
            <LogIn className="h-4 w-4" /> {busy ? 'Connexion…' : 'Se connecter'}
          </button>
          <button
            onClick={onGoRegister}
            className="w-full flex items-center justify-center gap-2 border border-slate-300 text-slate-600 px-4 py-2 rounded-md hover:bg-slate-50 text-sm font-semibold"
          >
            <KeyRound className="h-4 w-4" /> Créer un compte agent
          </button>
        </div>
      </div>
    </div>
  )
}