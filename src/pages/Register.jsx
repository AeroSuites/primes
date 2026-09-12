import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { UserPlus, Plane, ArrowLeft } from 'lucide-react'

export default function Register({ onGoBack }) {
  const { register } = useAuth()
  const [identifiant, setIdentifiant] = useState('')
  const [nom, setNom] = useState('')
  const [mdp, setMdp] = useState('')
  const [mdp2, setMdp2] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    if (!identifiant.trim() || !nom.trim()) {
      setError("Renseignez l'identifiant et le nom de l'agent.")
      return
    }
    if (!mdp || mdp.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères.')
      return
    }
    if (mdp !== mdp2) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }
    setBusy(true)
    setError('')
    const res = await register(identifiant, nom, mdp)
    if (!res.ok) setError(res.error)
    setBusy(false)
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-2">
          <Plane className="h-8 w-8 text-sky-500" />
          <h1 className="text-2xl font-bold text-slate-900">Créer un compte agent</h1>
        </div>
        <p className="text-slate-500 mb-6">
          Votre compte servira uniquement pour AeroPrimes (déclarations). L'enregistrement est
          immédiat.
        </p>

        <div className="space-y-3">
          <input
            value={identifiant}
            onChange={(e) => setIdentifiant(e.target.value)}
            placeholder="Identifiant (ex : matricule ou pseudo)"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
            autoFocus
          />
          <input
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder="Nom complet (ex : AYAD (FARID))"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          <input
            value={mdp}
            onChange={(e) => setMdp(e.target.value)}
            type="password"
            placeholder="Mot de passe (8 caractères minimum)"
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          <input
            value={mdp2}
            onChange={(e) => setMdp2(e.target.value)}
            type="password"
            placeholder="Confirmer le mot de passe"
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            onClick={submit}
            disabled={busy}
            className="w-full flex items-center justify-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-md hover:bg-sky-700 disabled:opacity-50 text-sm font-semibold"
          >
            <UserPlus className="h-4 w-4" /> {busy ? 'Création…' : 'Créer mon compte'}
          </button>
          <button
            onClick={onGoBack}
            className="w-full flex items-center justify-center gap-2 text-slate-500 hover:text-slate-800 text-sm py-1"
          >
            <ArrowLeft className="h-4 w-4" /> Retour à la connexion
          </button>
        </div>
      </div>
    </div>
  )
}