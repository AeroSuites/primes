import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as api from '../lib/api'

const AuthContext = createContext(null)
const SESSION_KEY = 'aeroprimes-session'

export function AuthProvider({ children }) {
  const [agent, setAgent] = useState(null)

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (raw) setAgent(JSON.parse(raw))
    } catch {
      // session illisible : on repart de zéro
    }
  }, [])

  const login = useCallback(async (identifiant, mdp) => {
    const res = await api.loginAgent(identifiant, mdp)
    if (!res?.ok) {
      if (res?.locked) return { ok: false, error: 'Trop de tentatives : réessayez dans 15 minutes.' }
      return { ok: false, error: 'Identifiant ou mot de passe incorrect.' }
    }
    const session = { identifiant: res.identifiant, nom: res.nom || identifiant }
    setAgent(session)
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    return { ok: true }
  }, [])

  const register = useCallback(async (identifiant, nom, mdp, managerId) => {
    const res = await api.signupAgent(identifiant, nom, mdp, managerId)
    if (res?.error === 'trop_de_tentatives')
      return { ok: false, error: "Trop de tentatives d'inscription. Réessayez dans 15 minutes." }
    if (res?.error === 'identifiant_utilise') return { ok: false, error: 'Cet identifiant est déjà utilisé.' }
    if (res?.error === 'mdp_court') return { ok: false, error: 'Le mot de passe doit contenir au moins 8 caractères.' }
    if (res?.error === 'identifiant_court') return { ok: false, error: "L'identifiant doit contenir au moins 3 caractères." }
    if (res?.error === 'manager_requis') return { ok: false, error: 'Sélectionnez votre manager dans la liste.' }
    if (res?.ok) {
      const session = { identifiant: identifiant.trim().toLowerCase(), nom: nom.trim() }
      setAgent(session)
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
      return { ok: true }
    }
    return { ok: false, error: "Échec de l'inscription." }
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY)
    setAgent(null)
  }, [])

  return (
    <AuthContext.Provider value={{ agent, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider')
  return ctx
}