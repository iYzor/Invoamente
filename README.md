# InovaMente

Sistema acadêmico de gestão de salão com HTML5, CSS, JavaScript modular, Bootstrap 5 e Supabase. As páginas usam dados reais; não incluem dados fictícios nem um backend local.

## Configuração

1. Preencha `js/config.js` com a URL do projeto e sua chave pública anon/publishable. Nunca use a chave service_role.
2. Com as nove tabelas e as duas triggers do enunciado existentes, execute `supabase/setup.sql` no SQL Editor. O script aplica permissões, RLS e RPCs transacionais. Execute uma vez; as políticas e a tabela auxiliar não são recriáveis sem remoção prévia. Revise políticas antigas: políticas permissivas podem ampliar acesso.
3. Crie usuários pelo painel Auth do Supabase. A trigger existente cria os perfis. Pelo SQL Editor, atribua `role = 'admin'` ao administrador e `role = 'profissional'` às profissionais; defina `full_name` e `commission_rate` de 0 a 100 (30 representa 30%). Não existe cadastro público nem alteração de papel pelo navegador.
4. Na pasta do projeto execute `python -m http.server 8000` e abra `http://localhost:8000/login.html`. Módulos ES precisam de HTTP; não abra via `file://`. É necessário acesso à internet para os CDNs e Supabase.

## Comportamento

- Administradores gerenciam todos os módulos. Profissionais consultam cadastros, sua agenda e suas comissões e podem agendar/concluir seus próprios atendimentos. O banco impõe essas permissões; operações administrativas feitas por profissionais exibem erro de autorização.
- Telefones são normalizados para dígitos; a unicidade depende da restrição UNIQUE existente. Normalize dados antigos para evitar variantes do mesmo telefone.
- Horários e filtros seguem o fuso local do navegador e são enviados como ISO UTC para TIMESTAMPTZ. Configure os dispositivos com o fuso do salão.
- Agendamentos permitem sobreposição; o preço fica registrado em appointment_services. Conclusões usam esse preço e a taxa atual da profissional, calculando comissão apenas sobre serviços.
- Conclusão, venda e ajuste de estoque são transacionais no servidor. Vendas usam preços atuais do banco; a trigger existente dá baixa em estoque. Produtos começam com zero unidades, e a entrada inicial é registrada em Ajustar estoque.
- A cliente opcional de balcão é registrada na descrição da transação, porque o esquema fornecido não possui client_id em financial_transactions.
- Receitas e despesas operacionais são lançadas na data atual. Não há estorno, exclusão de registros financeiros ou reabertura de atendimento concluído.

## Verificação manual com um projeto de teste

Se a venda de balcão informar função `counter_sale` ausente no cache, execute **supabase/fix-sales.sql** inteiro no mesmo projeto de `js/config.js`. A correção instala a função, a tabela auxiliar de proteção contra repetição e as permissões de execução; pode ser repetida. A baixa continua sendo feita pela trigger existente em `sale_items`, sem desconto adicional pela função. A consulta final mostra as triggers para conferência.

Se a agenda informar função `create_appointment`, `set_appointment_status` ou `finish_appointment` ausente no cache, execute **supabase/fix-agenda.sql** inteiro no mesmo projeto de `js/config.js`. A correção é repetível, instala as três funções e solicita a atualização do cache. Não recria tabelas nem altera atendimentos existentes. Inclui permissões de consulta para a agenda; a configuração completa de RLS dos demais módulos continua em setup.sql.

Se Ajustar estoque apresentar `Could not find the function public.adjust_stock ... in the schema cache`, execute **supabase/fix-stock.sql** inteiro no SQL Editor do mesmo projeto configurado em `js/config.js`. Ele instala/republica somente a função de estoque e suas permissões, e solicita a atualização do cache da API. Pode ser repetido; não execute setup.sql inteiro novamente para essa correção. Depois recarregue a página e ajuste o estoque com uma conta cujo perfil tenha `role = 'admin'`.

1. Faça login com admin e profissional; confirme que uma profissional não altera estoque, caixa ou comissão nem acessa agenda alheia.
2. Cadastre uma cliente, tente repetir o telefone e consulte histórico/aniversário.
3. Cadastre serviços e produtos; entre estoque, baixe insumos e tente ultrapassar o saldo. Verifique alerta no mínimo e exclusão de produtos internos da venda.
4. Agende dois atendimentos simultâneos, confira duração total e badge. Conclua um e repita a chamada: deve existir uma receita e uma comissão.
5. Venda múltiplos produtos, confira o estoque e o caixa. Tente vender saldo insuficiente: nenhuma parte da venda deve persistir.
6. Lance despesa, filtre período, confira saldo e pague comissão.

`scripts/build_pages.py` é apenas o gerador das páginas entregues; não precisa ser executado para usar o sistema.

## Teste de execução da venda

`scripts/test_sales.mjs` executa o SQL real de `fix-sales.sql` em PostgreSQL isolado via PGlite 0.3.7. O teste reproduz a ambiguidade antiga entre a variável `p` e o alias de produtos, instala a correção e valida venda de dois produtos (R$ 350), baixa de estoque, repetição da mesma operação, rejeição de estoque insuficiente, produto interno, quantidade zero, carrinho vazio e falta de permissão. Também executa a migração novamente. A trigger de baixa é uma fixture equivalente à regra fornecida; não verifica a trigger efetivamente instalada no Supabase.

Ambiente de teste local: Node 22.14.0 portátil em `.test-tools/node.exe` e pacote PGlite extraído em `.test-tools/package`. Execute `.\.test-tools\node.exe scripts/test_sales.mjs`. Esses arquivos de ferramentas não são versionados. O teste não acessa o projeto Supabase.
