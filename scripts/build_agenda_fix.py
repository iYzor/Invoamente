"""Extrai as funções já usadas pelo sistema para uma migração independente."""
from pathlib import Path

root = Path(__file__).resolve().parent.parent
setup = (root / 'supabase/setup.sql').read_text(encoding='utf-8')
helper = setup[setup.index('create or replace function public.is_admin()'):setup.index('-- RLS:')]
functions = setup[setup.index('create or replace function public.create_appointment('):setup.index('create or replace function public.adjust_stock(')]
sql = '''-- Correção da agenda: execute TODO o arquivo no mesmo Supabase de js/config.js.
-- Pode ser repetido. Não recria tabelas nem altera os agendamentos existentes.
begin;

'''+helper+functions+'''
revoke all on function public.is_admin(),
 public.create_appointment(uuid,uuid,timestamptz,uuid[]),
 public.set_appointment_status(uuid,text),public.finish_appointment(uuid)
 from public,anon;
grant execute on function public.is_admin(),
 public.create_appointment(uuid,uuid,timestamptz,uuid[]),
 public.set_appointment_status(uuid,text),public.finish_appointment(uuid)
 to authenticated;

-- A agenda deve continuar consultável quando RLS já estiver habilitado.
grant select on public.appointments,public.appointment_services to authenticated;
do $$
begin
 if not exists(select 1 from pg_policies where schemaname='public'
   and tablename='appointments' and policyname='atelier_appointments_read') then
   create policy atelier_appointments_read on public.appointments
   for select to authenticated
   using(public.is_admin() or professional_id=auth.uid());
 end if;
 if not exists(select 1 from pg_policies where schemaname='public'
   and tablename='appointment_services' and policyname='atelier_appointment_services_read') then
   create policy atelier_appointment_services_read on public.appointment_services
   for select to authenticated
   using(exists(select 1 from public.appointments a where a.id=appointment_id));
 end if;
end;
$$;

notify pgrst, 'reload schema';
commit;

-- Resultado esperado: as três funções com seus parâmetros.
select p.proname as function, pg_get_function_arguments(p.oid) as arguments
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='public' and p.proname in
 ('create_appointment','set_appointment_status','finish_appointment')
order by p.proname;
'''
(root / 'supabase/fix-agenda.sql').write_text(sql,encoding='utf-8')
