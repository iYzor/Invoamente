"""Gera a instalação independente da função usada pelas vendas de balcão."""
from pathlib import Path

root = Path(__file__).resolve().parent.parent
setup = (root / 'supabase/setup.sql').read_text(encoding='utf-8')
helper = setup[setup.index('create or replace function public.is_admin()'):setup.index('-- RLS:')]
start = setup.index('-- A chave de operação')
end = setup.index('revoke all on function public.is_admin(),public.create_appointment', start)
sales = setup[start:end].replace('create table public.atelier_sale_requests', 'create table if not exists public.atelier_sale_requests')
sql = '''-- Execute TODO este arquivo no projeto Supabase configurado em js/config.js.
-- Correção repetível: não recria as tabelas de produtos/transações/itens.
-- Requer a trigger de baixa de estoque em sale_items descrita no projeto.
begin;

'''+helper+sales+'''
revoke all on function public.is_admin(),public.counter_sale(jsonb,uuid,uuid) from public,anon;
grant execute on function public.is_admin(),public.counter_sale(jsonb,uuid,uuid) to authenticated;
notify pgrst, 'reload schema';
commit;

-- Confira que a assinatura contém p_items jsonb, p_client uuid e p_key uuid.
select p.proname as function, pg_get_function_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname='counter_sale';

-- Mostra as triggers existentes: a baixa deve ocorrer uma única vez por item.
select tgname, pg_get_triggerdef(oid) as definition
from pg_trigger
where tgrelid='public.sale_items'::regclass and not tgisinternal;
'''
(root / 'supabase/fix-sales.sql').write_text(sql,encoding='utf-8')
