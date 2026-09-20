import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { jsPDF } from 'jspdf'
import autoTable from 'jspdf-autotable'
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
  ChevronDown,
  ChevronRight,
  FileDown,
} from 'lucide-react'

const STATUT_STYLES = {
  soumise: { label: 'Soumise', cls: 'bg-amber-100 text-amber-800', icon: <Clock className="h-3.5 w-3.5" /> },
  validee: { label: 'Validée', cls: 'bg-green-100 text-green-800', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  refusee: { label: 'Refusée', cls: 'bg-[#fce7eb] text-[#e4002b]', icon: <XCircle className="h-3.5 w-3.5" /> },
}

const CATEGORIES = {
  V034: 'Toilette T1 (V034)',
  V035: 'Toilette T2 (V035)',
}

const DAYS = Array.from({ length: 31 }, (_, i) => String(i + 1).padStart(2, '0'))
const MONTHS = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
]
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = [String(CURRENT_YEAR), String(CURRENT_YEAR - 1)]

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
  const [dDay, setDDay] = useState('')
  const [dMonth, setDMonth] = useState('')
  const [dYear, setDYear] = useState('')
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
    if (!avion.trim()) {
      setError('Le matricule avion est obligatoire.')
      return
    }
    if (!element.trim()) {
      setError("L'élément est obligatoire.")
      return
    }
    if (!description.trim()) {
      setError('La description de l’intervention est obligatoire.')
      return
    }
    let isoDate = null
    if (dDay || dMonth || dYear) {
      if (!dDay || !dMonth || !dYear) {
        setError("Complétez la date d'intervention (jour, mois et année) ou laissez-la vide.")
        return
      }
      const y = Number(dYear)
      const m = Number(dMonth)
      const dd = Number(dDay)
      const dt = new Date(y, m - 1, dd)
      if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== dd) {
        setError("La date d'intervention est invalide.")
        return
      }
      isoDate = `${dYear}-${dMonth}-${dDay}`
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await api.submitDeclaration(agent, avion.trim(), element.trim(), isoDate, description.trim())
      if (res?.error === 'avion_requis') setError('Le matricule avion est obligatoire.')
      else if (res?.error === 'element_requis') setError("L'élément est obligatoire.")
      else if (res?.error === 'description_requise') setError('La description de l’intervention est obligatoire.')
      else if (res?.error) setError("Échec de l'envoi.")
      else {
        setAvion('')
        setElement('Toilettes')
        setDDay('')
        setDMonth('')
        setDYear('')
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

  // Mois disponibles (avec compteurs) — pour le pliage et l'export
  const monthList = useMemo(() => {
    const by = {}
    ;(declarations || []).forEach((d) => {
      const key = primeDay(d).slice(0, 7)
      if (!key) return
      if (!by[key]) by[key] = { key, label: formatMonth(key), count: 0, valid: 0 }
      by[key].count += 1
      if (d.statut === 'validee') by[key].valid += 1
    })
    return Object.values(by).sort((a, b) => b.key.localeCompare(a.key))
  }, [declarations])

  const [expandedMonths, setExpandedMonths] = useState(null)
  const toggleMonth = (key) =>
    setExpandedMonths((prev) => {
      const cur = prev === null ? monthList.map((m) => m.key) : prev
      return cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]
    })

  // Par défaut : seul le mois en cours est déplié (sinon le plus récent)
  useEffect(() => {
    if (expandedMonths !== null || !monthList.length) return
    const nowKey = new Date().toISOString().slice(0, 7)
    const initial = monthList.some((m) => m.key === nowKey) ? [nowKey] : [monthList[0].key]
    setExpandedMonths(initial)
  }, [monthList, expandedMonths])

  const [exportSel, setExportSel] = useState([])
  const [exportYear, setExportYear] = useState(String(new Date().getFullYear()))

  const toggleExportMonth = (key) =>
    setExportSel((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))

  const exportPdf = (monthKeys, titleOverride) => {
    const keys = [...new Set(monthKeys || [])].filter(Boolean)
    const items = (declarations || [])
      .filter((d) => keys.includes(primeDay(d).slice(0, 7)))
      .sort((a, b) => primeDay(a).localeCompare(primeDay(b)))
    if (!items.length) return
    const doc = new jsPDF()
    const valid = items.filter((d) => d.statut === 'validee').length
    const pending = items.filter((d) => d.statut === 'soumise').length
    const refused = items.filter((d) => d.statut === 'refusee').length
    doc.setFontSize(16)
    doc.setFont('helvetica', 'bold')
    doc.text('AeroPrimes - historique de primes', 14, 16)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`${agent.nom} - ${agent.identifiant}`, 14, 22)
    const period =
      titleOverride ||
      (keys.length === 1
        ? formatMonth(keys[0])
        : keys.length <= 3
          ? keys.map(formatMonth).join(', ')
          : `Periode (${keys.length} mois)`)
    doc.text(`Periode : ${period}`, 14, 27)
    doc.text(
      `Total : ${items.length} declaration(s) - ${valid} validee(s) - ${pending} en attente - ${refused} refusee(s)`,
      14,
      32
    )
    autoTable(doc, {
      startY: 37,
      head: [['Date', 'Avion', 'Element', 'TRFX', 'Description', 'Categorie', 'Statut']],
      body: items.map((d) => [
        primeDay(d)
          ? new Date(`${primeDay(d)}T12:00:00`).toLocaleDateString('fr-FR')
          : '-',
        d.avion || '',
        d.element || '',
        d.trfx || '',
        d.description || '',
        d.statut === 'validee' && d.categorie ? CATEGORIES[d.categorie] || d.categorie : '-',
        (STATUT_STYLES[d.statut] || STATUT_STYLES.soumise).label,
      ]),
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: [15, 23, 42] },
      columnStyles: { 4: { cellWidth: 55 } },
    })
    const date = new Date().toISOString().slice(0, 10)
    const name =
      keys.length === 1 ? `aeroprimes-${keys[0]}` : `aeroprimes-${keys[0]}_${keys[keys.length - 1]}`
    doc.save(`${name}-${date}.pdf`)
  }

  const yearsList = useMemo(() => {
    const ys = new Set((declarations || []).map((d) => primeDay(d).slice(0, 4)).filter(Boolean))
    ys.add(String(new Date().getFullYear()))
    return [...ys].sort((a, b) => b.localeCompare(a))
  }, [declarations])

  // Regroupement par mois pour l'affichage (avec séparateurs de jours)
  const byMonth = useMemo(() => {
    const map = {}
    ;(declarations || []).forEach((d) => {
      const key = primeDay(d).slice(0, 7)
      if (!map[key]) map[key] = []
      map[key].push(d)
    })
    Object.values(map).forEach((list) =>
      list.sort((a, b) => primeDay(b).localeCompare(primeDay(a)))
    )
    return map
  }, [declarations])

  return (
    <div className="min-h-screen bg-[#f2f5f9]">
      <header className="bg-gradient-to-br from-[#001a45] via-[#002157] to-[#003a8c] text-white border-b-4 border-[#e4002b]">
        <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0 sm:w-56">
            <Plane className="h-6 w-6 text-sky-300 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs text-slate-200 truncate max-w-[38vw] sm:max-w-[180px]">
                {agent.nom}
              </p>
              <p className="text-[10px] text-slate-400 font-mono truncate max-w-[38vw] sm:max-w-[180px]">
                {agent.identifiant}
              </p>
            </div>
          </div>
          <h1 className="text-xl sm:text-3xl font-extrabold tracking-[0.2em] text-white text-center">
            AEROPRIMES
          </h1>
          <div className="sm:w-56 flex justify-end">
            <button
              onClick={logout}
              className="flex items-center gap-1.5 text-slate-200 hover:text-white hover:bg-white/10 rounded-md px-3 py-2 text-sm shrink-0"
              title="Se déconnecter"
            >
              <LogOut className="h-4 w-4" /> Quitter
            </button>
          </div>
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
        <div className="bg-white rounded-xl shadow p-5 border-l-4 border-l-[#002157]">
          <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-[#002157]" /> Nouvelle déclaration
          </h2>
          <p className="text-xs text-slate-500 mb-4">
            La déclaration est transmise au manager pour validation.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-medium text-slate-600">
              Avion / immatriculation <span className="text-red-500">*</span>
              <input
                value={avion}
                onChange={(e) => setAvion(e.target.value)}
                placeholder="Ex : F-GKXT"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-1"
              />
            </label>
            <label className="text-xs font-medium text-slate-600">
              Élément <span className="text-red-500">*</span>
              <input
                value={element}
                onChange={(e) => setElement(e.target.value)}
                placeholder="Ex : Toilettes avant"
                className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm mt-1"
              />
            </label>
            <label className="text-xs font-medium text-slate-600 sm:col-span-2">
              Date de l'intervention (facultatif — jour / mois / année)
              <div className="grid grid-cols-3 gap-2 mt-1">
                <select
                  value={dDay}
                  onChange={(e) => setDDay(e.target.value)}
                  className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
                >
                  <option value="">Jour</option>
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  value={dMonth}
                  onChange={(e) => setDMonth(e.target.value)}
                  className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
                >
                  <option value="">Mois</option>
                  {MONTHS.map((name, i) => (
                    <option key={name} value={String(i + 1).padStart(2, '0')}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={dYear}
                  onChange={(e) => setDYear(e.target.value)}
                  className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
                >
                  <option value="">Année</option>
                  {YEARS.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Description de l'intervention <span className="text-red-500">*</span>
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

        {/* Export PDF */}
        {declarations && declarations.length > 0 && (
          <div className="bg-white rounded-xl shadow p-5">
            <h2 className="text-lg font-semibold mb-1 flex items-center gap-2">
              <FileDown className="h-5 w-5 text-[#002157]" /> Exporter en PDF
            </h2>
            <p className="text-xs text-slate-500 mb-3">
              Cochez les mois à exporter, ou exportez une année complète.
            </p>
            <div className="flex flex-wrap gap-2 mb-3">
              {monthList.map((m) => {
                const active = exportSel.includes(m.key)
                return (
                  <button
                    key={m.key}
                    onClick={() => toggleExportMonth(m.key)}
                    className={`px-2.5 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-[#002157] border-[#002157] text-white'
                        : 'bg-white border-slate-300 text-slate-600 hover:border-[#003a8c]'
                    }`}
                  >
                    {m.label} ({m.count})
                  </button>
                )
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => exportPdf(exportSel)}
                disabled={exportSel.length === 0}
                className="flex items-center gap-2 bg-[#002157] text-white px-4 py-2 rounded-md hover:bg-[#003a8c] disabled:opacity-50 text-sm font-semibold"
              >
                <FileDown className="h-4 w-4" /> Exporter la sélection ({exportSel.length})
              </button>
              <select
                value={exportYear}
                onChange={(e) => setExportYear(e.target.value)}
                className="border border-slate-300 rounded-md px-2 py-2 text-sm bg-white"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button
                onClick={() =>
                  exportPdf(
                    monthList.filter((m) => m.key.startsWith(exportYear)).map((m) => m.key),
                    `Annee ${exportYear}`
                  )
                }
                className="flex items-center gap-2 border border-slate-300 text-slate-700 px-4 py-2 rounded-md hover:bg-slate-50 text-sm font-semibold"
              >
                Exporter l'année {exportYear}
              </button>
            </div>
          </div>
        )}

        {/* Historique */}
        <div className="bg-white rounded-xl shadow p-5">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <History className="h-5 w-5 text-[#002157]" /> Historique
            {declarations && (
              <span className="text-sm font-normal text-slate-400">
                ({declarations.length} prime{declarations.length > 1 ? 's' : ''})
              </span>
            )}
          </h2>
          {declarations === null && <p className="text-sm text-slate-400">Chargement…</p>}
          {declarations && declarations.length === 0 && (
            <p className="text-sm text-slate-400 italic">
              Aucune déclaration pour le moment. Utilisez le formulaire ci-dessus.
            </p>
          )}
          {declarations && declarations.length > 0 && (
            <div className="space-y-3">
              {monthList.map((m) => {
                const items = byMonth[m.key] || []
                const open = (expandedMonths || []).includes(m.key)
                let lastDay = null
                return (
                  <div key={m.key} className="border border-slate-200 rounded-xl overflow-hidden">
                    <button
                      onClick={() => toggleMonth(m.key)}
                      className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-left"
                    >
                      <span className="flex items-center gap-2 font-semibold text-slate-800 text-sm">
                        {open ? (
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-500" />
                        )}
                        {m.label}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-xs font-bold bg-[#dbe7f7] text-[#002157] rounded-full px-2 py-0.5">
                          {m.count} prime{m.count > 1 ? 's' : ''}
                        </span>
                        {m.valid > 0 && (
                          <span className="text-xs font-bold bg-emerald-100 text-emerald-800 rounded-full px-2 py-0.5">
                            {m.valid} validée{m.valid > 1 ? 's' : ''}
                          </span>
                        )}
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation()
                            exportPdf([m.key])
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.stopPropagation()
                              exportPdf([m.key])
                            }
                          }}
                          className="text-slate-400 hover:text-[#003a8c] p-1"
                          title={`Exporter ${m.label} en PDF`}
                        >
                          <FileDown className="h-4 w-4" />
                        </span>
                      </span>
                    </button>
                    {open && (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm min-w-[680px]">
                          <thead>
                            <tr className="text-left bg-slate-50">
                              <th className="px-3 py-2 font-semibold text-slate-700">Avion</th>
                              <th className="px-3 py-2 font-semibold text-slate-700">Élément</th>
                              <th className="px-3 py-2 font-semibold text-slate-700">TRFX</th>
                              <th className="px-3 py-2 font-semibold text-slate-700">Description</th>
                              <th className="px-3 py-2 font-semibold text-slate-700">Catégorie</th>
                              <th className="px-3 py-2 font-semibold text-slate-700">Statut</th>
                              <th className="px-3 py-2 font-semibold text-slate-700">Motif / décision</th>
                            </tr>
                          </thead>
                          <tbody>
                            {items.map((d) => {
                              const pd = primeDay(d)
                              const newDay = pd !== lastDay
                              lastDay = pd
                              const st = STATUT_STYLES[d.statut] || STATUT_STYLES.soumise
                              return (
                                <Fragment key={d.id}>
                                  {newDay && (
                                    <tr className="bg-slate-50">
                                      <td
                                        colSpan={7}
                                        className="px-3 py-1 font-semibold text-slate-500 text-xs"
                                      >
                                        {formatDay(pd)}
                                      </td>
                                    </tr>
                                  )}
                                  <tr className="border-b hover:bg-slate-50 align-top">
                                    <td className="px-3 py-2 font-mono font-bold text-[#002157]">
                                      {d.avion || '—'}
                                    </td>
                                    <td className="px-3 py-2">{d.element || '—'}</td>
                                    <td className="px-3 py-2 font-mono text-xs">{d.trfx || '—'}</td>
                                    <td className="px-3 py-2 max-w-[240px]">
                                      <span className="truncate block" title={d.description}>
                                        {d.description}
                                      </span>
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
                                      <span
                                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold ${st.cls}`}
                                      >
                                        {st.icon} {st.label}
                                      </span>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-slate-500">
                                      {d.statut === 'refusee' && d.motif_refus ? d.motif_refus : '—'}
                                    </td>
                                  </tr>
                                </Fragment>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )
              })}
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
      <div className="text-2xl font-bold text-[#002157]">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  )
}