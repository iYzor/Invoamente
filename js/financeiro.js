import { $, init, query, supabase, action, esc, money, table, options, dateTime, today, dayRange, notice } from './common.js';
let products=[],cart=[],saleKey=null;
$('#from').value=today();$('#to').value=today();
async function load(){if($('#from').value>$('#to').value)throw new Error('O início deve ser anterior ao fim.');const [start]=dayRange($('#from').value),[,end]=dayRange($('#to').value);const [rows,commissions,stock]=await Promise.all([query(supabase.from('financial_transactions').select('*').gte('transaction_date',start).lt('transaction_date',end).order('transaction_date',{ascending:false})),query(supabase.from('commissions').select('*,profiles(full_name)').order('created_at',{ascending:false})),query(supabase.from('products').select('*').eq('is_internal_use_only',false).order('name'))]);products=stock;$('#product').innerHTML=options(products,'name');
$('#cash-list').innerHTML=table(['Data','Descrição','Tipo','Valor'],rows.map(t=>`<tr><td>${dateTime(t.transaction_date)}</td><td>${esc(t.description)}</td><td>${esc(t.type)}</td><td>${money(t.amount)}</td></tr>`));$('#balance').textContent=money(rows.reduce((sum,t)=>sum+(t.type==='receita'?1:-1)*Number(t.amount),0));
$('#commission-list').innerHTML=table(['Profissional','Comissão','Situação',''],commissions.map(c=>`<tr><td>${esc(c.profiles?.full_name)}</td><td>${money(c.commission_amount)}</td><td>${c.is_paid?'Paga':'Pendente'}</td><td>${c.is_paid?'':`<button class="btn btn-sm btn-primary" data-pay="${c.id}">Pagar comissão</button>`}</td></tr>`));}
$('#filter').onsubmit=action(load);
$('#transaction-form').onsubmit=action(async()=>{const description=$('#description').value.trim();if(!description)throw new Error('Informe a descrição.');await query(supabase.from('financial_transactions').insert({type:$('#type').value,description,amount:Number($('#amount').value),transaction_date:new Date().toISOString()}));$('#transaction-form').reset();await load();});
function renderCart(){saleKey=null;$('#cart').innerHTML=table(['Produto','Quantidade','Subtotal',''],cart.map(item=>`<tr><td>${esc(item.name)}</td><td>${item.quantity}</td><td>${money(item.quantity*item.sale_price)}</td><td><button class="btn btn-sm btn-outline-danger" data-remove="${item.id}">Remover</button></td></tr>`));$('#sale-total').textContent=money(cart.reduce((s,i)=>s+i.quantity*i.sale_price,0));}
$('#add-product').onclick=action(async()=>{const product=products.find(p=>p.id===$('#product').value),quantity=Number($('#quantity').value);if(!product||!Number.isInteger(quantity)||quantity<1)throw new Error('Selecione um produto e uma quantidade inteira positiva.');const existing=cart.find(i=>i.id===product.id);if(quantity+(existing?.quantity||0)>product.stock_quantity)throw new Error('Quantidade superior ao estoque disponível.');if(existing)existing.quantity+=quantity;else cart.push({...product,quantity});renderCart();});
$('#cart').onclick=event=>{const button=event.target.closest('[data-remove]');if(button){cart=cart.filter(i=>i.id!==button.dataset.remove);renderCart();}};
$('#sale-form').onsubmit=action(async()=>{
  if(!cart.length)throw new Error('Adicione produtos à venda.');
  await query(supabase.rpc('counter_sale',{p_items:cart.map(i=>({product_id:i.id,quantity:i.quantity})),p_client:$('#sale-client').value||null,p_key:(saleKey ||= crypto.randomUUID())}));
  cart=[];
  renderCart();
  try {
    await load();
    notice('Venda registrada com sucesso. Receita e estoque atualizados.',false);
  } catch(error) {
    notice(`A venda foi registrada, mas a tela não pôde ser atualizada: ${error.message}. Recarregue a página antes de fazer outra venda.`);
  }
});
$('#commission-list').onclick=action(async event=>{const button=event.target.closest('[data-pay]');if(button){await query(supabase.from('commissions').update({is_paid:true}).eq('id',button.dataset.pay).eq('is_paid',false));await load();}});
await action(async()=>{if(!await init())return;const clients=await query(supabase.from('clients').select('*').order('name'));$('#sale-client').innerHTML='<option value="">Cliente não identificado</option>'+options(clients,'name');renderCart();await load();})();
