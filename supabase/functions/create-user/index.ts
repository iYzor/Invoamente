import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...cors, 'Content-Type': 'application/json' },
  })
  if (request.method !== 'POST') return respond({ error: 'Método não permitido.' }, 405)

  const authorization = request.headers.get('Authorization')
  if (!authorization) return respond({ error: 'Sessão necessária.' }, 401)
  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const adminClient = createClient(url, serviceKey, { auth: { persistSession: false } })
  const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  })
  const { data: { user }, error: authError } = await userClient.auth.getUser()
  if (authError || !user) return respond({ error: 'Sessão inválida. Entre novamente.' }, 401)
  const { data: profile, error: profileError } = await adminClient
    .from('profiles').select('role').eq('id', user.id).maybeSingle()
  if (profileError) return respond({ error: 'Não foi possível validar a permissão administrativa.' }, 500)
  if (profile?.role !== 'admin') return respond({ error: 'Somente administradores podem criar usuários.' }, 403)

  let input: { full_name?: string; email?: string; password?: string; commission_rate?: number; role?: string }
  try { input = await request.json() } catch { return respond({ error: 'Dados inválidos.' }, 400) }
  const fullName = input.full_name?.trim()
  const email = input.email?.trim().toLowerCase()
  const password = input.password
  const role = input.role ?? 'profissional'
  const rate = role === 'profissional' ? Number(input.commission_rate ?? 0) : 0
  if (!fullName || fullName.length > 150 || !email || !/^\S+@\S+\.\S+$/.test(email)
      || !password || password.length < 8 || !['admin', 'profissional'].includes(role)
      || !Number.isFinite(rate) || rate < 0 || rate > 100) {
    return respond({ error: 'Confira nome, e-mail, senha (mínimo 8 caracteres), tipo de acesso e comissão (0 a 100%).' }, 400)
  }

  const { data, error } = await adminClient.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { full_name: fullName },
  })
  if (error) return respond({ error: error.message }, 400)
  const { error: saveError } = await adminClient.from('profiles').upsert({
    id: data.user.id, full_name: fullName, role, commission_rate: rate,
  }, { onConflict: 'id' })
  if (saveError) {
    await adminClient.auth.admin.deleteUser(data.user.id)
    return respond({ error: 'Não foi possível salvar o perfil; a conta foi desfeita. ' + saveError.message }, 500)
  }
  return respond({ id: data.user.id, email })
})
