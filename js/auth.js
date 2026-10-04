import { supabase, configured } from './supabaseClient.js';
import { $, action, notice, query } from './common.js';
if(!configured) notice('Configure js/config.js com a URL e a chave pública do Supabase.');
$('#login').addEventListener('submit', action(async()=> {
  if(!configured) throw new Error('Conexão ao Supabase ainda não configurada.');
  await query(supabase.auth.signInWithPassword({email:$('#email').value.trim(),password:$('#password').value}));
  location.replace('index.html');
}));
