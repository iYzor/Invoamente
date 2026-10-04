// PostgreSQL isolado via PGlite. Não acessa nem modifica o Supabase.
import { PGlite } from '../.test-tools/package/dist/index.js';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
const admin='00000000-0000-0000-0000-000000000001';
const client='00000000-0000-0000-0000-000000000002';
const shampoo='00000000-0000-0000-0000-000000000003';
const conditioner='00000000-0000-0000-0000-000000000004';
const internal='00000000-0000-0000-0000-000000000005';
const key='00000000-0000-0000-0000-000000000006';
await db.exec(`
create role anon; create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create table profiles(id uuid primary key,role text);
create table clients(id uuid primary key,name varchar(250));
create table products(id uuid primary key,name varchar(200),sale_price numeric(10,2),stock_quantity integer not null,is_internal_use_only boolean not null);
create table financial_transactions(id uuid primary key,appointment_id uuid,type varchar(10) not null check(type in ('receita','despesa')),description varchar(250) not null,amount numeric(10,2) not null,transaction_date timestamptz not null);
create table sale_items(id uuid primary key,transaction_id uuid not null references financial_transactions(id),product_id uuid not null references products(id),quantity integer not null check(quantity>0),unit_price numeric(10,2) not null);
create function test_decrement() returns trigger language plpgsql as $$ begin update products set stock_quantity=stock_quantity-new.quantity where id=new.product_id; return new; end $$;
create trigger test_stock after insert on sale_items for each row execute function test_decrement();
insert into profiles values('${admin}','admin');
insert into clients values('${client}','Layzah');
insert into products values('${shampoo}','SHAMPOO',15,50,false),('${conditioner}','Condicionador',20,50,false),('${internal}','Insumo interno',10,50,true);
select set_config('request.jwt.claim.sub','${admin}',false);
`);
// Executa o arquivo inteiro duas vezes para verificar reinstalação.
const sql=readFileSync(new URL('../supabase/fix-sales.sql',import.meta.url),'utf8');
await db.exec(sql);
await db.exec(sql);
console.log('PASS: migração executada e repetida em PostgreSQL');
async function sale(items,operation=key){return (await db.query('select counter_sale($1::jsonb,$2::uuid,$3::uuid) as id',[JSON.stringify(items),client,operation])).rows[0].id;}
const cart=[{product_id:conditioner,quantity:10},{product_id:shampoo,quantity:10}];
// Reproduz o defeito anterior antes de conferir a versão corrigida.
await db.exec(sql.replaceAll('v_product','p'));
await assert.rejects(()=>sale(cart),/column reference "p.id" is ambiguous/);
assert.equal((await db.query('select count(*)::int n from financial_transactions')).rows[0].n,0);
await db.exec(sql);
console.log('PASS: erro original reproduzido; transação revertida; versão corrigida reinstalada');
const transaction=await sale(cart);
const result=(await db.query('select amount,description from financial_transactions where id=$1',[transaction])).rows[0];
assert.equal(Number(result.amount),350);
assert.match(result.description,/Layzah/);
assert.equal((await db.query('select count(*)::int n from sale_items')).rows[0].n,2);
assert.deepEqual((await db.query('select stock_quantity from products where id in ($1,$2) order by id',[shampoo,conditioner])).rows.map(r=>r.stock_quantity),[40,40]);
console.log('PASS: 2 produtos, receita R$ 350, cliente e baixa de 10 unidades por produto');
assert.equal(await sale(cart),transaction);
assert.equal((await db.query('select count(*)::int n from financial_transactions')).rows[0].n,1);
assert.equal((await db.query('select stock_quantity from products where id=$1',[shampoo])).rows[0].stock_quantity,40);
console.log('PASS: repetir chave não duplica receita nem baixa estoque');
let number=10;
async function rejected(items,pattern){
 const operation=`00000000-0000-0000-0000-${String(number++).padStart(12,'0')}`;
 await assert.rejects(()=>sale(items,operation),pattern);
 assert.equal((await db.query('select count(*)::int n from financial_transactions')).rows[0].n,1);
 assert.equal((await db.query('select count(*)::int n from sale_items')).rows[0].n,2);
}
await rejected([{product_id:shampoo,quantity:41}],/estoque insuficiente/);
await rejected([{product_id:internal,quantity:1}],/Produto interno/);
await rejected([{product_id:shampoo,quantity:0}],/Quantidade inválida/);
await rejected([],/Carrinho vazio/);
console.log('PASS: estoque insuficiente, produto interno, quantidade zero e carrinho vazio sem gravação parcial');
await db.exec(`select set_config('request.jwt.claim.sub','',false);`);
await rejected(cart,/Somente administradores/);
console.log('PASS: chamada sem usuário rejeitada');
await db.exec(`select set_config('request.jwt.claim.sub','${admin}',false); update profiles set role='profissional';`);
await rejected(cart,/Somente administradores/);
console.log('PASS: profissional não pode vender');
await db.close();
