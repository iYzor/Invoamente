import { supabase, configured } from './supabaseClient.js';
export { supabase };
export const $ = selector => document.querySelector(selector);
export const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const money = value => Number(value || 0).toLocaleString('pt-BR', {style:'currency',currency:'BRL'});
export const dateTime = value => new Date(value).toLocaleString('pt-BR');
export const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
export function dayRange(day) { const start = new Date(`${day}T00:00:00`); const end = new Date(start); end.setDate(end.getDate()+1); return [start.toISOString(),end.toISOString()]; }
export function notice(message, danger = true) { $('#notice').className = `alert alert-${danger?'danger':'success'}`; $('#notice').textContent = message; }
export async function query(request) {
  const { data, error } = await request;
  if(error) {
    let message = error.code === '23505' ? 'Já existe um registro com esses dados (verifique o telefone).' : error.message;
    if(error.code === 'PGRST202' && /create_appointment|set_appointment_status|finish_appointment/.test(error.message)) {
      message = 'As funções da agenda não estão disponíveis no Supabase. Execute todo o arquivo supabase/fix-agenda.sql na conexão do projeto configurado em js/config.js e tente novamente.';
    }
    if(error.code === 'PGRST202' && /counter_sale/.test(error.message)) {
      message = 'A função de venda de balcão não está disponível no Supabase. Execute todo o arquivo supabase/fix-sales.sql na conexão do projeto configurado em js/config.js e tente novamente.';
    }
    const failure = new Error(message);
    failure.code = error.code;
    throw failure;
  }
  return data;
}
export function action(fn) { return async event => { event?.preventDefault(); const button = event?.submitter || event?.currentTarget; if(button) button.disabled=true; try { await fn(event); } catch(error) { notice(error.message); } finally { if(button) button.disabled=false; } }; }
export function modal(id) { return bootstrap.Modal.getOrCreateInstance(document.getElementById(id)); }
export function options(rows, label) { return rows.map(row=>`<option value="${esc(row.id)}">${esc(row[label])}</option>`).join(''); }
export function table(headers, rows) { return `<div class="table-responsive"><table class="table align-middle"><thead><tr>${headers.map(h=>`<th scope="col">${h}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${headers.length}" class="text-center text-secondary py-5">Nenhum registro encontrado.</td></tr>`}</tbody></table></div>`; }
export async function init() {
  const links = [['index.html','Visão geral','grid'],['agendamentos.html','Agenda','calendar3'],['clientes.html','Clientes','people'],['servicos-produtos.html','Serviços e estoque','box-seam'],['financeiro.html','Financeiro','wallet2']];
  $('#nav').innerHTML = `<nav class="navbar navbar-expand-lg bg-white border-bottom"><div class="container"><a class="navbar-brand fw-bold" href="index.html"><i class="bi bi-lightbulb me-2"></i>InovaMente</a><button class="navbar-toggler" data-bs-toggle="collapse" data-bs-target="#navigation" aria-label="Abrir menu"><span class="navbar-toggler-icon"></span></button><div id="navigation" class="collapse navbar-collapse"><div class="navbar-nav ms-auto">${links.map(([href,label,icon])=>`<a class="nav-link ${location.pathname.endsWith(href)?'active':''}" href="${href}"><i class="bi bi-${icon} me-1"></i>${label}</a>`).join('')}<button id="logout" class="btn btn-outline-secondary ms-lg-3">Sair</button></div></div></div></nav>`;
  if(!configured) { notice('Configure a URL e a chave pública em js/config.js para conectar ao Supabase.'); return false; }
  const {data:{session},error} = await supabase.auth.getSession(); if(error) throw error;
  if(!session) { location.replace('login.html'); return false; }
  $('#logout').onclick = action(async()=> { await query(supabase.auth.signOut()); location.replace('login.html'); });
  supabase.auth.onAuthStateChange(event=> { if(event==='SIGNED_OUT') location.replace('login.html'); });
  return true;
}
