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
      `<tr><td>${esc(user.full_name)}</td><td>${user.role === 'admin' ? 'Administrador' : 'Profissional'}</td><td>${user.role === 'profissional' ? `${Number(user.commission_rate || 0).toLocaleString('pt-BR')}%` : '—'}</td></tr>`));
  }
  $('#user-role').addEventListener('change', () => {
    const isProfessional = $('#user-role').value === 'profissional';
    $('#commission-field').hidden = !isProfessional;
    $('#role-help').textContent = isProfessional ? 'A comissão é opcional e fica em 0% se não for informada.' : 'Administradores gerenciam o sistema e podem criar outros usuários.';
  });
  $('#user-form').addEventListener('submit', action(async () => {
    const payload = {
      full_name: $('#full-name').value.trim(), email: $('#user-email').value.trim(),
      password: $('#user-password').value, role: $('#user-role').value,
      commission_rate: Number($('#commission').value || 0),
    };
    const { error } = await supabase.functions.invoke('create-user', { body: payload });
    if (error) throw new Error(error.message || 'Não foi possível criar o usuário.');
    $('#user-form').reset();
    $('#commission-field').hidden = false;
    $('#role-help').textContent = 'A comissão é opcional e fica em 0% se não for informada.';
    notice(payload.role === 'admin' ? 'Administrador criado com sucesso.' : 'Profissional criada com sucesso.', false);
    await loadUsers();
  }));
  await loadUsers();
})();