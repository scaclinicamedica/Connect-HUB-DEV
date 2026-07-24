# Checklist de QA

Use dados clínicos fictícios. Registre no PR quais itens foram executados e
anexe evidências para qualquer mudança visual ou responsiva.

## 1. Antes da alteração

- [ ] Identificar a release e o commit usados como baseline.
- [ ] Ler `AGENTS.md`, `docs/CURRENT_STATE.md` e a especificação aplicável.
- [ ] Reproduzir o comportamento atual.
- [ ] Confirmar se a tarefa é correção, melhoria visual, mudança clínica ou
      refatoração.
- [ ] Separar mudanças clínicas de mudanças técnicas.

## 2. Verificação básica

- [ ] A página abre sem erro JavaScript bloqueante.
- [ ] Não existem IDs estáticos duplicados introduzidos pela mudança.
- [ ] Os controles modificados continuam alcançáveis por teclado.
- [ ] Botões somente por ícone mantêm nome acessível e dica de ação.
- [ ] Estados não dependem exclusivamente de cor.
- [ ] Visualizar não altera o objeto clínico serializado.

## 3. Larguras obrigatórias

Verificar separadamente:

- [ ] 390 px — mobile.
- [ ] 494 px — mobile largo/intermediário.
- [ ] 768 px — tablet/intermediário.
- [ ] 1180 px — desktop.
- [ ] 1440 px — desktop amplo.
- [ ] 759, 760 e 761 px — fronteira entre regras compactas e desktop.

Em todas as larguras:

- [ ] Não existe overflow horizontal.
- [ ] O drawer permanece utilizável.
- [ ] Textos, selos, ícones e botões não se sobrepõem.
- [ ] O módulo aberto é posicionado dentro da área visível do drawer.

## 4. Novo paciente e catálogo

- [ ] Novo paciente não herda o estado do paciente anterior.
- [ ] `Adicionar assistente clínico` abre diretamente o catálogo.
- [ ] O catálogo não mistura painéis clínicos com as opções.
- [ ] Clicar no cartão inteiro seleciona o módulo.
- [ ] Seleção por teclado/evento `change` continua possível.
- [ ] A seleção fecha o catálogo e abre o módulo escolhido.
- [ ] Arritmias abre em edição para o novo fluxo.
- [ ] Profilaxia de TEV abre o painel correspondente.
- [ ] `Adicionar outro assistente` permite selecionar um segundo módulo.

## 5. Assistente de Arritmias

- [ ] Auto Save permanece ativo.
- [ ] Auto Advance permanece ativo.
- [ ] Editar uma decisão anterior invalida apenas os estados dependentes.
- [ ] `Finalizar perfil` continua obrigatório para FA/Flutter.
- [ ] A etapa de ECG pergunta `O ECG apresenta sinais de pré-excitação?`.
- [ ] As respostas distinguem ausência, suspeita e ECG ainda não avaliado.
- [ ] Módulo incompleto abre em continuidade/edição.
- [ ] Módulo concluído abre em visualização.
- [ ] O olho abre visualização somente leitura.
- [ ] O lápis abre edição deliberada.
- [ ] Não aparece texto duplicado como `EditarEditando`.
- [ ] `Recolher` permanece recolhido no desktop e no mobile.
- [ ] Abertura manual não é revertida por temporizador antigo.

## 6. Estados do resumo

- [ ] Fluxo incompleto comum: `Em andamento`.
- [ ] Estabilizou após conduta, mas há etapa pendente:
      `Conduta registrada`.
- [ ] Finalizou todas as etapas após conduta: `Concluído`.
- [ ] Permanece instável: `Prioridade clínica`.
- [ ] `Estabilizou após conduta imediata` permanece no corpo quando aplicável.
- [ ] A aparência âmbar não substitui o selo de conclusão.
- [ ] Estado hemodinâmico ausente é informado, sem assumir estabilidade.

## 7. Card do paciente

- [ ] Ordem: cabeçalho, prioridade quando aplicável, hipótese, pendências,
      Clinical Copilot, outros alertas e ações.
- [ ] Status operacional, como `Aguardando UTI`, não é confundido com o
      estado do assistente.
- [ ] Paciente sem módulos não exibe Clinical Copilot vazio.
- [ ] Arritmias, TEV e Antimicrobianos aparecem consolidados quando presentes.
- [ ] O card vertical permanece legível.
- [ ] O card horizontal mantém Hipótese, Pendências, Clinical Copilot e
      Ações em regiões legíveis.
- [ ] O clique no resumo abre o paciente e o módulo correto.
- [ ] Um módulo concluído abre pelo card em visualização, sem editar dados.

## 8. Passagem de caso e impressão

- [ ] A busca encontra termos do resumo assistencial.
- [ ] O texto copiado inclui o Clinical Copilot aplicável.
- [ ] O snapshot da transição inclui o resumo aplicável.
- [ ] A impressão inclui o resumo sem cabeçalhos duplicados.
- [ ] O cenário homologado de oito pacientes cabe em uma página A4.
- [ ] O modo horizontal da tela não altera indevidamente a impressão.

## 9. Desfecho

- [ ] Card e drawer apresentam `Desfecho`, sem ação `Excluir` do paciente.
- [ ] Existem somente Tratado, Óbito e Transferido.
- [ ] Abrir, navegar e cancelar não criam escrita de Desfecho.
- [ ] Óbito exige CID principal; os demais não persistem CID.
- [ ] Médico responsável é obrigatório e explicitamente confirmado.
- [ ] `Encerrando atendimento...` permanece visível durante a persistência.
- [ ] O paciente permanece ativo quando a persistência falha.
- [ ] Evento privado, lápide mínima e retirada do ativo são atômicos e
      idempotentes no Firebase.
- [ ] A lápide contém somente identificadores técnicos, tipo, timestamps e
      `closedByUid`, sem nome, CID, diagnóstico, alertas ou snapshot.
- [ ] Retry após perda de confirmação não sobrescreve o primeiro registro.
- [ ] Retry confirmado consulta somente a lápide e não lê nem reescreve o
      histórico privado.
- [ ] `actorUid` e `closedByUid` correspondem ao UID Firebase autenticado.
- [ ] `patientSnapshot` preserva os dados clínicos integrais.
- [ ] Autosave, salvamento manual e reordenação em voo não recriam o paciente
      encerrado.
- [ ] O eco local otimista do Firestore não oculta o card antes do ACK.
- [ ] Histórico local corrompido não é sobrescrito e mantém o paciente ativo.
- [ ] DIH inválida ou futura produz permanência `null`; mesmo dia produz `1`.
- [ ] As Rules negam evento, lápide ou exclusão isolados e combinações
      incompletas.
- [ ] As Rules impedem update/delete de `patient_outcome` e
      `patient_closed`.
- [ ] As Rules impedem recriar o mesmo `patientId` no setor original e nos
      demais setores conhecidos.
- [ ] Migração válida e atualizações em lote de pacientes ativos continuam
      permitidas.
- [ ] O modal permanece utilizável e sem overflow nas larguras obrigatórias.

## 10. Firestore e Área Administrativa

- [ ] `npm run test:rules` conclui os 21 cenários no Firestore Emulator.
- [ ] Cliente clínico anônimo pode consultar por `get` uma lápide conhecida,
      mas não pode listar lápides nem ler/listar `historico_eventos`.
- [ ] Usuário não-anônimo com `admin_users/<uid>` ativo e papel `admin` lê o
      histórico.
- [ ] Usuário não-anônimo com papel `coordinator` ativo lê o histórico.
- [ ] Perfil ausente, inativo ou com outro papel é negado antes da consulta de
      pacientes.
- [ ] Não existe código compartilhado, senha, token ou credencial administrativa
      no HTML, testes ou documentação.
- [ ] O login usa e-mail e senha, persistência de sessão e a instância Firebase
      nomeada `connect-hub-admin`.
- [ ] Login/logout administrativo não substitui nem encerra a sessão anônima
      clínica.
- [ ] O atalho administrativo da tela clínica abre o login real e não revela
      histórico protegido ou código compartilhado.
- [ ] Confirmações de transição podem ser criadas e lidas, mas update/delete
      são negados pelas Rules.
- [ ] O contrato legado estrito mantém abas antigas funcionais na janela
      Rules-first e nega campos extras ou timestamp do cliente.
- [ ] Logout ou perda de autorização limpa pacientes, histórico, gráficos,
      tabelas e relatórios administrativos.
- [ ] Falha ou truncamento do histórico invalida relatório anterior e bloqueia
      geração/exportação incompleta.
- [ ] Conteúdo persistido é escapado antes de ser inserido no HTML do painel.
- [ ] A aba Desfechos consulta somente `admin_outcomes` com
      `patient_outcome_admin` versão 1 e tipos homologados.
- [ ] O período padrão cobre 30 dias e os filtros por data, setor,
      especialidade e tipo funcionam em conjunto.
- [ ] Hoje e D-29 entram no período padrão; D-30 fica fora, e intervalo
      invertido exibe erro sem métricas.
- [ ] Período, ordenação e auditoria usam exclusivamente `createdAt` do
      servidor convertido para `America/Sao_Paulo`.
- [ ] Permanência é recalculada de `admissionDate` até o timestamp do servidor
      e ignora `lengthOfStayDays` ou datas locais adulteradas.
- [ ] Total, Tratados, Óbitos, Transferidos, média, mediana e cobertura usam
      somente os registros filtrados.
- [ ] A proporção de Óbitos é rotulada como proporção entre Desfechos e não
      como mortalidade institucional.
- [ ] Consolidações por setor/especialidade, CIDs de Óbitos e auditoria
      correspondem ao mesmo conjunto filtrado.
- [ ] A auditoria permite rastrear cada linha pelo `outcomeId`.
- [ ] Estados carregando, pronto, vazio, filtro vazio, negado, erro e truncado
      não exibem números parciais ou antigos.
- [ ] Falha na leitura de pacientes ou do histórico encerra o estado de
      carregamento e apresenta erro.
- [ ] `patientSnapshot` e eventos privados de Desfecho não são retornados pela
      consulta da aba; somente a projeção mínima permanece em memória.
- [ ] O setor legado `uti` participa de consultas, filtros e totais.
- [ ] Login e painel permanecem acessíveis e sem overflow nas larguras
      obrigatórias.
- [ ] Email/Password está habilitado no Firebase Authentication.
- [ ] A conta institucional foi criada e seu UID foi cadastrado em
      `admin_users/<uid>` com `active: true` e papel permitido.
- [ ] O acesso clínico anônimo do site público foi substituído por autenticação
      nominal ou protegido por barreira institucional comprovada.
- [ ] `firestore.rules` foi publicado e o smoke test pós-deploy de
      `docs/FIRESTORE_SECURITY.md` passou antes do merge da aplicação.

## 11. Revisão do PR

- [ ] Diff limitado ao escopo da tarefa.
- [ ] Nenhum dado real de paciente foi incluído.
- [ ] Nenhuma regra clínica mudou silenciosamente.
- [ ] Testes e larguras executados estão descritos.
- [ ] Evidências visuais foram anexadas quando aplicável.
- [ ] Riscos conhecidos e itens não testados estão explícitos.
- [ ] Documentação e changelog foram atualizados quando necessário.
- [ ] Existe plano de rollback para mudança publicada.

## 12. Dívida do teste histórico

O comando `node test_rc128.cjs` foi usado na workspace de homologação, mas
esse teste ainda não faz parte de uma suíte portátil do repositório: depende
do Playwright do ambiente e de um caminho temporário absoluto para Chromium.

Antes de adotá-lo como verificação oficial:

- [ ] criar manifesto de dependências;
- [ ] remover caminhos absolutos de `/tmp`;
- [ ] gravar PDFs e artefatos em diretório temporário;
- [ ] executar repetidamente os cenários desktop;
- [ ] eliminar a alternância observada em 1440 px;
- [ ] incluir smoke test no site hospedado para mudanças de interação.
