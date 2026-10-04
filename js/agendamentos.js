import { $, init, query, supabase, action, esc, money, table, modal, options, today, dayRange, dateTime, notice } from './common.js';
let services=[],appointments=[];
$('#day').value=today();
async function load(){const [start,end]=dayRange($('#day').value||today()); let request=supabase.from('appointments').select('*,clients(name),profiles(full_name),appointment_services(unit_price,services(title))').gte('start_time',start).lt('start_time',end).order('start_time');if($('#professional-filter').value)request=request.eq('professional_id',$('#professional-filter').value);appointments=await query(request);
$('#list').innerHTML=table(['Horário','Cliente / Serviços','Profissional','Status'],appointments.map(a=>{const overlap=a.status!=='cancelado'&&appointments.some(b=>b.id!==a.id&&b.status!=='cancelado'&&b.professional_id===a.professional_id&&new Date(b.start_time)<new Date(a.end_time)&&new Date(b.end_time)>new Date(a.start_time));return `<tr><td>${dateTime(a.start_time)}<small class="d-block">Até ${new Date(a.end_time).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</small>${overlap?'<span class="badge text-bg-light">Atendimento simultâneo</span>':''}</td><td>${esc(a.clients?.name)}<small class="d-block text-secondary">${esc(a.appointment_services.map(s=>s.services?.title).join(', '))}</small></td><td>${esc(a.profiles?.full_name)}</td><td><select aria-label="Status do atendimento" class="form-select" data-status="${a.id}" ${['concluido','cancelado'].includes(a.status)?'disabled':''}>${['pendente','confirmado','em_atendimento','concluido','cancelado'].map(s=>`<option value="${s}" ${s===a.status?'selected':''}>${s.replaceAll('_',' ')}</option>`).join('')}</select></td></tr>`;}));}
$('#day').onchange=action(load);$('#professional-filter').onchange=action(load);
// Erros ficam visíveis dentro do modal, sem ficarem atrás da janela.
const formNotice=document.createElement('div');
formNotice.className='d-none';
formNotice.setAttribute('role','alert');
$('#appointment-form').prepend(formNotice);
$('#new').onclick=()=>{$('#appointment-form').reset();formNotice.className='d-none';$('#start').value=`${$('#day').value||today()}T09:00`;if($('#professional-filter').value)$('#professional-id').value=$('#professional-filter').value;$('#estimate').textContent='Selecione os serviços.';modal('appointment-modal').show();};
function selected(){return [...$('#service-ids').selectedOptions].map(o=>services.find(s=>s.id===o.value));}
function estimate(){const rows=selected(),minutes=rows.reduce((sum,s)=>sum+s.duration_minutes,0);const start=new Date($('#start').value);$('#estimate').textContent=rows.length&&Number.isFinite(start.getTime())?`${minutes} minutos · Término ${dateTime(new Date(start.getTime()+minutes*60000))} · ${money(rows.reduce((sum,s)=>sum+Number(s.price),0))}`:'Selecione os serviços e o horário.';}
$('#service-ids').onchange=estimate;$('#start').onchange=estimate;
$('#appointment-form').onsubmit=action(async()=>{
  formNotice.className='d-none';
  const localStart=$('#start').value;
  const start=new Date(localStart);
  const professional=$('#professional-id').value;
  let savedId;
  try {
    if(!$('#client-id').value||!professional) throw new Error('Selecione cliente e profissional.');
    if(!selected().length) throw new Error('Selecione ao menos um serviço.');
    if(!Number.isFinite(start.getTime())) throw new Error('Informe uma data e horário válidos.');
    savedId=await query(supabase.rpc('create_appointment',{p_client:$('#client-id').value,p_professional:professional,p_start:start.toISOString(),p_services:selected().map(s=>s.id)}));
  } catch(error) {
    formNotice.className='alert alert-danger';
    formNotice.textContent=error.message;
    return;
  }
  // Mostra o dia e a profissional realmente salvos, sem esconder o registro
  // sob os filtros usados antes de abrir o formulário.
  $('#day').value=localStart.slice(0,10);
  if($('#professional-filter').value&&$('#professional-filter').value!==professional) $('#professional-filter').value='';
  modal('appointment-modal').hide();
  try {
    await load();
    const visible=appointments.some(a=>a.id===savedId);
    notice(visible?'Agendamento salvo com sucesso.': 'Agendamento salvo no banco, mas não retornou na consulta. Confira as permissões de leitura da agenda para esta conta.',!visible);
  } catch(error) {
    notice(`O agendamento foi salvo, mas a lista não pôde ser atualizada: ${error.message}. Atualize a página antes de tentar cadastrar novamente.`);
  }
});
$('#list').onchange=action(async event=>{const select=event.target.closest('[data-status]');if(!select)return;const appointment=appointments.find(a=>a.id===select.dataset.status);const status=select.value;select.value=appointment.status;if(status==='concluido'){$('#finish-id').value=appointment.id;$('#finish-summary').textContent=`${appointment.clients?.name} · ${money(appointment.appointment_services.reduce((sum,s)=>sum+Number(s.unit_price),0))}. A comissão será calculada com a taxa atual da profissional.`;modal('finish-modal').show();}else{await query(supabase.rpc('set_appointment_status',{p_id:appointment.id,p_status:status}));await load();}});
$('#finish-form').onsubmit=action(async()=>{await query(supabase.rpc('finish_appointment',{p_id:$('#finish-id').value}));modal('finish-modal').hide();await load();});
await action(async()=>{if(!await init())return;const [clients,profiles,rows]=await Promise.all([query(supabase.from('clients').select('*').order('name')),query(supabase.from('profiles').select('*').eq('role','profissional').order('full_name')),query(supabase.from('services').select('*').eq('is_active',true).order('title'))]);services=rows;$('#client-id').innerHTML=options(clients,'name');$('#professional-id').innerHTML=options(profiles,'full_name');$('#professional-filter').innerHTML='<option value="">Todas as profissionais</option>'+options(profiles,'full_name');$('#service-ids').innerHTML=options(services,'title');await load();})();
