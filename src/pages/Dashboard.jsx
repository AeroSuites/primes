import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import * as api from '../lib/api'
import {
  Plane,
  LogOut,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  ClipboardList,
  History,
} from 'lucide-react'

const STATUT_STYLES = {
  soumise: { label: 'Soumise', cls: 'bg-amber-100 text-amber-800', icon: <Clock className="h-3.5 w-3.5" /> },
  validee: { label: 'Validée', cls: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  refusee: { label: 'Refusée', cls: 'bg-red-100 text-red-800', icon: <XCircle className="h-3.5 w-3.5" /> },
}

const CATEGORIES = {
  V034: 'Toilette T1 (V034)',
  V035: 'Toilette T2 (V035)',
}

const primeDay = (d) =>
  d.date_intervention || (d.created_at ? String(d.created_at).slice(0, 10) : '')

const formatDay = (iso) => {
  if (!iso) return '—'
  const label = new Date(`${iso}T12:00:00`).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

const formatMonth = (ym) => {
  if (!ym) return '—'
  const [y, m] = ym.split('-')
  const label = new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export default function Dashboard() {
  const { agent, logout } = useAuth()
  const [declarations, setDeclarations] = useState(null)
  const [error, setError] = useState('')

  const [avion, setAvion] = useState('')
  const [element, setElement] = useState('Toilettes')
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const load = useCallback(async () => {
    try {
      const dRes = await api.myDeclarations(agent.identifiant)
      setDeclarations(dRes?.declarations || [])
    } catch {
      setError('Impossible de charger vos déclarations.')
    }
  }, [agent])

  useEffect(() => {
    load()
  }, [load])

  const submit = async () => {
    if (!description.trim()) {
      setError('La description de l’intervention est obligatoire.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await api.submitDeclaration(agent, avion.trim(), element.trim(), date || null, description.trim())
      if (res?.error) setError("Échec de l'envoi.")
      else {
        setAvion('')
        setElement('Toilettes')
        setDate('')
        setDescription('')
        await load()
      }
    } catch (err) {
      setError(`Échec de l'envoi : ${err?.message || 'hors ligne ?'}`)
    }
    setSubmitting(false)
  }

  const validCount = (declarations || []).filter((d) => d.statut === 'validee').length
  const refusedCount = (declarations || []).filter((d) => d.statut === 'refusee').length

  const historyGroups = useMemo(() => {
    const sorted = [...(declarations || [])].sort((a, b) =>
      primeDay(b).localeCompare(primeDay(a))
    )
    const out = []
    let month = null
    let day = null
    for (const d of sorted) {
      const pd = primeDay(d)
      const mKey = pd.slice(0, 7)
      if (mKey !== month) {
        month = mKey
        out.push({ type: 'month', key: `m-${mKey}`, label: formatMonth(mKey) })
        day = null
      }
      if (pd !== day) {
        day = pd
        out.push({ type: 'day', key: `d-${pd}`, label: formatDay(pd) })
      }
      out.push({ type: 'row', key: d.id, data: d })
    }
    return out
  }, [declarations])

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Plane className="h-7 w-7 text-sky-400" />
            <div>
              <p className="text-lg font-bold leading-tight">AeroPrimes</p>
              <p className="text-xs text-slate-300">
                {agent.nom} · {agent.identifiant}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            className="flex items-center gap-1.5 text-slate-300 hover:text-white hover:bg-slate-800 rounded-md px-3 py-2 text-sm"
            title="Se déconnecter"
          >
            <LogOut className="h-4 w-4" /> Quitter
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Déclarations" value={declarations?.length ?? '…'} />
          <Stat label="En attente" value={(declarations || []).filter((d) => d.statut === 'soumise').length} />
          <Stat label="Validées" value={validCount} />
          <Stat label="Refusées" value={refusedCount} />
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3">{error}</p>
        )}

        {/* Formulaire */}
        <div className="bg-white rounded-xl shadow p-5 border-l-4 border-l-sky-600">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-sky-500" /> Nouvelle déclaration
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            La déclaration est transmise au manager pour validation.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600">
              Avion / immatriculation
              <input
                value={avion}
                onChange={(e) => setAvion(e.target.value)}
                placeholder="Ex : F-GKXT"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-1"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Élément
              <input
                value={element}
                onChange={(e) => setElement(e.target.value)}
                placeholder="Ex : Toilettes avant"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-1"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Date de l'intervention
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-1"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Description de l'intervention
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex : Remplacement filtre toilette avant…"
                rows={2}
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-1 resize-y"
              />
            </label>
          </div>
          <div className="flex justify-end mt-3">
            <button
              onClick={submit}
              disabled={submitting}
              className="flex items-center gap-2 bg-sky-600 text-white px-5 py-2 rounded-md hover:bg-sky-700 disabled:opacity-50 text-sm font-semibold"
            >
              <Send className="h-4 w-4" /> {submitting ? 'Envoi…' : 'Envoyer la déclaration'}
            </button>
          </div>
        </div>

        {/* Historique */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <History className="h-5 w-5 text-sky-500" /> Historique
          </h2>
          {declarations === null && <p className="text-sm text-slate-400">Chargement…</p>}
          {declarations && declarations.length === 0 && (
            <p className="text-sm text-slate-400 italic">
              Aucune déclaration pour le moment. Utilisez le formulaire ci-dessus.
            </p>
          )}
          {declarations && declarations.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[680px]">
                <thead>
                  <tr className="text-left bg-slate-50">
                    <th className="px-3 py-2 font-semibold text-slate-700">Avion</th>
                    <th className="px-3 py-2 font-semibold text-slate-700">Élément</th>
                    <th className="px-3 py-2 font-semibold text-slate-700">Description</th>
                    <th className="px-3 py-2 font-semibold text-slate-700">Catégorie</th>
                    <th className="px-3 py-2 font-semibold text-slate-700">Statut</th>
                    <th className="px-3 py-2 font-semibold text-slate-700">Motif / décision</th>
                  </tr>
                </thead>
                <tbody>
                  {historyGroups.map((g) => {
                    if (g.type === 'month')
                      return (
                        <tr key={g.key} className="bg-slate-100">
                          <td
                            colSpan={6}
                            className="px-3 py-1.5 font-bold text-slate-700 text-[13px] uppercase tracking-wide"
                          >
                            {g.label}
                          </td>
                        </tr>
                      )
                    if (g.type === 'day')
                      return (
                        <tr key={g.key} className="bg-slate-50">
                          <td colSpan={6} className="px-3 py-1 font-semibold text-slate-500 text-xs">
                            {g.label}
                          </td>
                        </tr>
                      )
                    const d = g.data
                    const st = STATUT_STYLES[d.statut] || STATUT_STYLES.soumise
                    return (
                      <tr key={g.key} className="border-b hover:bg-slate-50 align-top">
                        <td className="px-3 py-2 font-mono font-bold text-sky-700">{d.avion || '—'}</td>
                        <td className="px-3 py-2">{d.element || '—'}</td>
                        <td className="px-3 py-2 max-w-[240px]">
                          <span className="truncate block" title={d.description}>{d.description}</span>
                        </td>
                        <td className="px-3 py-2">
                          {d.statut === 'validee' && d.categorie ? (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                              {CATEGORIES[d.categorie] || d.categorie}
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${st.cls}`}>
                            {st.icon} {st.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-500">
                          {d.statut === 'refusee' && d.motif_refus ? d.motif_refus : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

function Stat({ label, value }) {
  return (
    <div className="bg-white rounded-xl shadow p-3 text-center">
      <div className="text-2xl font-bold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}