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
- [ ] Histórico e retirada do ativo são atômicos e idempotentes no Firebase.
- [ ] Retry após perda de confirmação não sobrescreve o primeiro registro.
- [ ] `patientSnapshot` preserva os dados clínicos integrais.
- [ ] Autosave, salvamento manual e reordenação em voo não recriam o paciente
      encerrado.
- [ ] O eco local otimista do Firestore não oculta o card antes do ACK.
- [ ] Histórico local corrompido não é sobrescrito e mantém o paciente ativo.
- [ ] DIH inválida ou futura produz permanência `null`; mesmo dia produz `1`.
- [ ] As Rules publicadas impedem update/delete do evento `patient_outcome`.
- [ ] O modal permanece utilizável e sem overflow nas larguras obrigatórias.

## 10. Revisão do PR

- [ ] Diff limitado ao escopo da tarefa.
- [ ] Nenhum dado real de paciente foi incluído.
- [ ] Nenhuma regra clínica mudou silenciosamente.
- [ ] Testes e larguras executados estão descritos.
- [ ] Evidências visuais foram anexadas quando aplicável.
- [ ] Riscos conhecidos e itens não testados estão explícitos.
- [ ] Documentação e changelog foram atualizados quando necessário.
- [ ] Existe plano de rollback para mudança publicada.

## 11. Dívida do teste histórico

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
