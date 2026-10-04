import { $, init, query, supabase, action, esc, money, table, modal, notice } from './common.js';
let services=[],products=[];
async function load(){ [services,products]=await Promise.all([query(supabase.from('services').select('*').order('title')),query(supabase.from('products').select('*').order('name'))]);
$('#services-list').innerHTML=table(['Serviço','Preço','Duração','Situação',''],services.map(s=>`<tr><td>${esc(s.title)}<small class="d-block text-secondary">${esc(s.description)}</small></td><td>${money(s.price)}</td><td>${s.duration_minutes} min</td><td>${s.is_active?'Ativo':'Inativo'}</td><td><button class="btn btn-sm btn-outline-secondary" data-service="${s.id}">Editar</button></td></tr>`));
$('#products-list').innerHTML=table(['Produto','Custo / Venda','Estoque','Uso',''],products.map(p=>`<tr><td>${esc(p.name)}<small class="d-block text-secondary">${esc(p.category)}</small></td><td>${money(p.cost_price)} / ${money(p.sale_price)}</td><td><span class="badge ${p.stock_quantity<=p.min_stock_level?'text-bg-danger':'text-bg-light'}">${p.stock_quantity} un.</span> <small>Mín. ${p.min_stock_level}</small></td><td>${p.is_internal_use_only?'Interno exclusivo':'Venda'}</td><td><button class="btn btn-sm btn-outline-secondary" data-product="${p.id}">Editar</button> <button class="btn btn-sm btn-outline-secondary" data-stock="${p.id}">Ajustar estoque</button></td></tr>`)); }
for(const type of ['service','product']){ $(`#new-${type}`).onclick=()=>{ $(`#${type}-form`).reset(); $(`#${type}-id`).value=''; if(type==='service') $('#is_active').checked=true; modal(`${type}-modal`).show(); }; $(`#${type}-form`).onsubmit=action(async()=>{ const form=$(`#${type}-form`),payload={}; for(const el of form.elements){if(!el.name)continue; payload[el.name]=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value.trim();} const id=$(`#${type}-id`).value; if(type==='product') delete payload.stock_quantity; // Ajustes usam RPC com bloqueio de linha para não perder vendas concorrentes.
await query(id?supabase.from(type==='service'?'services':'products').update(payload).eq('id',id):supabase.from(type==='service'?'services':'products').insert(type==='product'?{...payload,stock_quantity:0}:payload)); modal(`${type}-modal`).hide(); await load(); }); }
document.addEventListener('click',event=>{for(const type of ['service','product']){const button=event.target.closest(`[data-${type}]`);if(button){const row=(type==='service'?services:products).find(r=>r.id===button.dataset[type]);$(`#${type}-id`).value=row.id;for(const el of $(`#${type}-form`).elements){if(el.name){if(el.type==='checkbox')el.checked=row[el.name];else el.value=row[el.name]??'';}}modal(`${type}-modal`).show();}} const button=event.target.closest('[data-stock]');if(button){$('#stock-id').value=button.dataset.stock;$('#stock-form').reset();$('#stock-id').value=button.dataset.stock;modal('stock-modal').show();}});
$('#stock-form').onsubmit=action(async()=>{
  const delta=Number($('#delta').value);
  if(!Number.isInteger(delta)||delta===0||delta < -2147483648||delta > 2147483647) throw new Error('Informe uma quantidade inteira diferente de zero, dentro do limite permitido.');
  try {
    await query(supabase.rpc('adjust_stock',{p_product:$('#stock-id').value,p_delta:delta}));
  } catch(error) {
    if(error.code==='PGRST202') {
      modal('stock-modal').hide();
      throw new Error('A função de ajuste de estoque não está disponível no Supabase. Execute o arquivo supabase/fix-stock.sql no SQL Editor do projeto configurado em js/config.js e tente novamente.');
    }
    throw error;
  }
  modal('stock-modal').hide();
  await load();
  notice('Estoque ajustado com sucesso.',false);
});
await action(async()=>{if(await init()) await load();})();
