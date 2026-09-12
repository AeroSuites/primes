import { supabase } from './supabase'

export async function signupAgent(identifiant, nom, mdp) {
  const { data, error } = await supabase.rpc('signup_agent', {
    p_identifiant: identifiant,
    p_nom: nom,
    p_mdp: mdp,
  })
  if (error) throw error
  return data
}

export async function loginAgent(identifiant, mdp) {
  const { data, error } = await supabase.rpc('login_agent', {
    p_identifiant: identifiant,
    p_mdp: mdp,
  })
  if (error) throw error
  return data
}

export async function getPrimeMontant() {
  const { data, error } = await supabase.rpc('get_prime_montant')
  if (error) throw error
  return data
}

export async function submitDeclaration(agent, avion, element, date, description) {
  const { data, error } = await supabase.rpc('agent_submit_declaration', {
    p_identifiant: agent.identifiant,
    p_nom: agent.nom,
    p_avion: avion,
    p_element: element,
    p_date_intervention: date || null,
    p_description: description,
  })
  if (error) throw error
  return data
}

export async function myDeclarations(identifiant) {
  const { data, error } = await supabase.rpc('my_declarations', {
    p_identifiant: identifiant,
  })
  if (error) throw error
  return data
}