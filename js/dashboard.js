import { $, init, query, supabase, money, today, dayRange, action, table, esc, dateTime } from './common.js';
await action(async()=> { if(!await init()) return; const [start,end]=dayRange(today());
  const [transactions,appointments,products]=await Promise.all([
    query(supabase.from('financial_transactions').select('*').eq('type','receita').gte('transaction_date',start).lt('transaction_date',end)),
    query(supabase.from('appointments').select('*,clients(name),profiles(full_name)').gte('start_time',start).lt('start_time',end).order('start_time')),
    query(supabase.from('products').select('*'))]);
  $('#revenue').textContent=money(transactions.reduce((sum,t)=>sum+Number(t.amount),0));
  $('#appointments').textContent=appointments.filter(a=>a.status!=='cancelado').length;
  const low=products.filter(p=>p.stock_quantity<=p.min_stock_level); $('#low').textContent=low.length;
  $('#schedule').innerHTML=table(['Horário','Cliente','Profissional','Status'],appointments.map(a=>`<tr><td>${dateTime(a.start_time)}</td><td>${esc(a.clients?.name)}</td><td>${esc(a.profiles?.full_name)}</td><td>${esc(a.status)}</td></tr>`));
  $('#stock').innerHTML=low.length?low.map(p=>`<div class="d-flex justify-content-between py-2 border-bottom"><span>${esc(p.name)}</span><span class="badge text-bg-danger">${p.stock_quantity} un.</span></div>`).join(''):'Estoque em dia.';
})();
