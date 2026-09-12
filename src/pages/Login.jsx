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
      <div className="relative z-10 bg-white/95 backdrop-blur-sm rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-2">
          <Plane className="h-8 w-8 text-sky-500" />
          <h1 className="text-2xl font-bold text-slate-900">AeroPrimes</h1>
        </div>
        <p className="text-slate-500 mb-6">
          Déclaration des interventions (prime toilettes). Connectez-vous avec votre identifiant
          personnel.
        </p>

        <div className="space-y-3">
          <input
            value={identifiant}
            onChange={(e) => setIdentifiant(e.target.value)}
            placeholder="Identifiant"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            autoFocus
          />
          <input
            value={mdp}
            onChange={(e) => setMdp(e.target.value)}
            type="password"
            placeholder="Mot de passe"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={submit}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 disabled:opacity-50 text-sm font-semibold"
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