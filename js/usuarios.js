import { $, init, query, supabase, action, table, esc } from './common.js';

await action(async () => {
  if (!await init()) return;
  const profile = await query(supabase.from('profiles').select('role').eq('id', (await supabase.auth.getUser()).data.user.id).single());
  if (profile.role !== 'admin') {
    $('#user-form').innerHTML = '<p class="mb-0">Somente administradores podem criar usuários.</p>';
    return;
  }
  async function loadUsers() {
    const users = await query(supabase.from('profiles').select('full_name,role,commission_rate').order('full_name'));
    $('#user-list').innerHTML = table(['Nome','Perfil','Comissão'], users.map(user =>
      `<tr><td>${esc(user.full_name)}</td><td>${esc(user.role)}</td><td>${user.role === 'profissional' ? `${Number(user.commission_rate || 0).toLocaleString('pt-BR')}%` : '—'}</td></tr>`));
  }
  $('#user-form').addEventListener('submit', action(async () => {
    const payload = {
      full_name: $('#full-name').value.trim(), email: $('#user-email').value.trim(),
      password: $('#user-password').value, commission_rate: Number($('#commission').value),
    };
    const { error } = await supabase.functions.invoke('create-user', { body: payload });
    if (error) throw new Error(error.message || 'Não foi possível criar o usuário.');
    $('#user-form').reset();
    notice('Profissional criada com sucesso.', false);
    await loadUsers();
  }));
  await loadUsers();
})();
