# Changelog

## [Não publicado — RC1.3.3: CID universal e permanência setorial] — 2026-07-25

### Desfecho

- Os rótulos visíveis passam a ser Alta médica, Óbito e Transferência externa,
  preservando os códigos persistidos `treated`, `death` e `transferred`.
- CID principal em formato estruturado passa a ser obrigatório nos três
  Desfechos, antes da confirmação.
- Novos eventos privados usam esquema 2 e novas projeções administrativas usam
  esquema 3; as versões anteriores permanecem somente para leitura histórica.

### Permanência por setor

- Novos pacientes iniciam um episódio setorial com timestamp do servidor.
- Cada migração entre setores cria um fato administrativo imutável na mesma
  transação que move o paciente; remanejamento interno não reinicia o relógio.
- O painel calcula intervalos decorridos em horas, soma retornos ao mesmo setor
  e separa cobertura completa, parcial e indisponível.
- Pacientes legados não recebem tempo retroativo inventado: uma primeira
  migração inicia observação parcial e um Desfecho sem rastreamento permanece
  indisponível para a métrica setorial.

### Área Administrativa

- O filtro e o perfil nosológico passam a usar CID nos três tipos de Desfecho.
- A composição por CID discrimina Altas médicas, Óbitos e Transferências
  externas em gráfico e tabela exata.
- A permanência observada por setor ganha média, mediana, total de horas,
  episódios e cobertura, com gráfico complementar e fallback textual.
- Falha ou truncamento dos fatos setoriais bloqueia somente essa análise; os
  demais indicadores de Desfecho permanecem disponíveis quando íntegros.
- Fatos de versão desconhecida, baseline retroativo e cadeias contraditórias são
  recusados; intervalos válidos de duração zero permanecem representados como
  `0 h`.

### Segurança e compatibilidade

- O snapshot clínico privado é derivado integralmente do paciente autoritativo
  lido na transação e precisa ser idêntico a ele nas Rules.
- O identificador determinístico de episódio mantém IDs legados literalmente,
  inclusive `%`, alinhado ao contrato do Firestore.

### Validação

- Gate local concluído: 145/145 testes principais, 25/25 cenários funcionais de
  Desfecho, 37/37 administrativos funcionais, 16/16 administrativos
  responsivos, impressão A4, 33/33 Rules e estabilidade 50/50, com um worker e
  zero retries.
- A descoberta contém 145 testes na suíte principal e 146 no conjunto global,
  que inclui uma execução do cenário repetido separadamente no gate 50/50.
- `npm audit --omit=dev` não encontrou vulnerabilidades no artefato de
  produção. A auditoria completa encontrou 21 ocorrências transitivas
  (16 altas e 5 moderadas) no `firebase-tools` usado somente em
  desenvolvimento/CI. A versão 15.24.0 já é a estável mais recente e não há
  correção não destrutiva disponível; o CLI deve permanecer restrito a runner
  controlado até a atualização upstream.

## [Candidato local RC1.3.2 — inteligência administrativa de Desfechos] — 2026-07-25

### Indicadores

- A projeção administrativa evolui para o esquema 2 com o único campo
  `palliativeAlertPresentAtOutcome`, derivado do alerta estruturado `Paliativo` no
  paciente autoritativo da transação.
- Projeções versão 1 continuam nos totais com registro do alerta
  indisponível, sem inferência retrospectiva.
- A Área Administrativa passa a separar Óbitos gerais registrados, Óbitos com
  alerta Paliativo, Óbitos sem esse alerta e registros indisponíveis, sempre
  com cobertura.
- Permanência ganha distribuição por faixas e segmentação por tipo de
  Desfecho, preservando média, mediana e denominadores válidos.
- O perfil nosológico é apresentado somente pelos CIDs principais dos Óbitos,
  pois esta versão não captura CID homologado para os demais Desfechos.
- Setor e especialidade passam a detalhar Óbitos gerais, com alerta Paliativo
  e cobertura local do registro; a auditoria individual mostra o estado
  disponível.
- A auditoria passa a renderizar 50 registros por página, com navegação
  explícita, e os seis filtros podem ser restaurados em uma única ação.

### Qualidade e segurança

- Novo filtro do alerta Paliativo combina com período, setor, especialidade
  e tipo.
- Gráficos de composição, permanência e CIDs complementam tabelas exatas e
  degradam para mensagens textuais sem ocultar os dados.
- Os KPIs do censo atual são ocultados na aba histórica para evitar mistura de
  conceitos.
- O painel continua lendo projeções legadas v1 como registro indisponível;
  novas criações são obrigatoriamente v2 e vinculam o booleano administrativo
  ao evento privado e ao paciente ativo.
- Novos CIDs são limitados ao formato estruturado; isso não substitui validação
  contra terminologia oficial, e valores legados fora do formato não entram no
  agrupamento nem na cobertura.
- DIH com sufixo ou data impossível não é truncada: fica fora da permanência e
  aparece como indisponível na auditoria; novas gravações fora do formato são
  negadas.
- O Desfecho confirma alterações pendentes do alerta `Paliativo` antes de abrir
  o modal, evitando consolidar o estado anterior.
- Cálculos programáticos usados na hidratação e na assinatura do rascunho
  deixam de reagendar o autosave; alterações reais de Paliativo e PaO₂/FiO₂
  continuam salvando normalmente.
- Novas projeções são obrigatoriamente versão 2; documentos versão 1 permanecem
  apenas como leitura histórica.
- A cobertura focada passa a 15 cenários funcionais, 8 viewports e 22 cenários
  de Rules.
- Validação integrada: suíte principal 131/131, impressão A4 incluída,
  estabilidade desktop 50/50, um worker e zero retries.

### Limites

- “Óbitos gerais” significa todos os Óbitos registrados nesta ferramenta, não
  mortalidade institucional.
- “Sem alerta Paliativo registrado” não significa “não paliativo”.
- O login clínico nominal pode permanecer adiado somente em teste controlado
  com pacientes fictícios; continua bloqueando merge/deploy de produção.

## [Candidato local anterior — segurança de Desfecho e acesso administrativo] — 2026-07-24

### Segurança do Desfecho

- Separado o guard operacional mínimo
  `connect_hub_v55/<setor>/closed_patients/<patientId>` do evento clínico
  privado `historico_eventos/<outcomeId>`.
- O encerramento passa a exigir evento privado, projeção administrativa
  mínima, lápide e exclusão do paciente ativo na mesma transação atômica.
- A lápide não contém nome, CID, diagnóstico, alertas nem `patientSnapshot`.
- `actorUid` e `closedByUid` vinculam as quatro partes à sessão Firebase que
  confirmou a operação.
- Retry idempotente consulta apenas a lápide e não lê nem reescreve o histórico
  privado.
- Rules versionadas tornam evento e lápide imutáveis, negam delete avulso e
  bloqueiam recriação do mesmo ID em qualquer setor conhecido.
- Migrações válidas, atualizações em lote e eventos legados reconhecidos
  permanecem compatíveis.

### Acesso administrativo

- Removidos o código compartilhado, a autorização por `sessionStorage` e o
  login anônimo da Área Administrativa.
- Adicionado login Firebase por e-mail e senha, com perfil
  `admin_users/<uid>` ativo e papel `admin` ou `coordinator`.
- A autenticação administrativa usa a instância nomeada `connect-hub-admin`
  para preservar a sessão anônima clínica.
- O atalho da tela clínica deixa de usar código compartilhado e passa a abrir
  o login administrativo real.
- Histórico integral e listagem de lápides ficam restritos a usuário
  não-anônimo e autorizado; o clínico pode apenas consultar uma lápide
  individual.
- Logout e perda de autorização limpam os dados administrativos.
- Falha ou truncamento da leitura histórica invalida relatórios anteriores e
  bloqueia geração/exportação incompleta.
- Conteúdo persistido é escapado antes da renderização privilegiada; Chart.js
  e XLSX foram fixados com SRI.
- Adicionada aba Desfechos com período inicial de 30 dias, filtros por período,
  setor, especialidade e tipo, contagens, permanência média/mediana com
  cobertura, proporção de Óbitos entre Desfechos, CIDs e auditoria.
- A proporção de Óbitos é distinguida de mortalidade institucional.
- A aba Desfechos consulta somente `admin_outcomes`, uma projeção materializada
  sem `patientSnapshot`, diagnóstico, alertas ou estado clínico.
- Período, ordenação, auditoria e permanência usam o `createdAt` do servidor,
  convertido para a data civil de `America/Sao_Paulo`; campos locais do
  navegador não participam das métricas.
- O setor legado `uti` passa a integrar consultas e totais administrativos.
- Confirmações de transição de cuidados recebem esquema, setor, UID e
  timestamp do servidor e se tornam imutáveis nas Rules e na interface em
  nuvem. Um contrato legado estrito preserva abas antigas durante a transição.

### Testes e publicação

- Adicionada suíte de 21 cenários de Firestore Rules no Emulator, cobrindo
  atomicidade, imutabilidade, perfis, ressurreição, migração e compatibilidade.
- `firebase-tools` atualizado para 15.24.0; a auditoria deixou de apresentar
  vulnerabilidades altas ou críticas nas dependências de desenvolvimento.
- Adicionada caracterização Playwright do login, autorização, isolamento de
  sessão, logout, falhas históricas, escape de conteúdo e responsividade do
  painel.
- Adicionados testes funcionais e responsivos da aba Desfechos para período,
  filtros, métricas, CIDs, auditoria, estados seguros e descarte do snapshot.
- Validação isolada da Área Administrativa: 25/25 cenários funcionais e 16/16
  cenários da matriz responsiva.
- Validação funcional de Desfecho: 15/15, incluindo conflito entre sessões.
- Validação integrada: suíte principal 123/123, impressão A4 1/1 e estabilidade
  desktop 50/50, sem retries.
- A publicação exige habilitar Email/Password, criar a conta institucional,
  cadastrar `admin_users/<uid>` e publicar `firestore.rules` antes do merge da
  aplicação.
- As Rules estão versionadas e testadas, mas ainda não estão publicadas no
  projeto Firebase.

### Limitação conhecida

- Os usuários clínicos continuam anônimos. Os UIDs registram a sessão do
  Desfecho, mas não comprovam autoria nominal nem a autenticidade individual
  de cada campo do paciente ativo.
- Como o site atual é público, essa autenticação anônima permanece um
  bloqueador de produção até existir autenticação clínica nominal ou uma
  barreira institucional de acesso comprovada.

## [FOUNDATION 1.0 RC1.3.0 — OUTCOMES] — 2026-07-24

### Adicionado

- Fluxo de Desfecho com Tratado, Óbito e Transferido.
- Médico responsável obrigatório e CID principal obrigatório no Óbito.
- Registro `patient_outcome` compatível com o histórico administrativo.
- Snapshot clínico integral, setor, especialidade, DIH e permanência.
- Estado bloqueante `Encerrando atendimento...`.

### Segurança de dados

- A antiga exclusão direta do paciente foi removida do card e do drawer.
- Histórico e retirada do registro ativo usam transação atômica e idempotente
  no Firebase.
- O identificador determinístico impede duplicatas e o primeiro registro
  confirmado não é sobrescrito em retries.
- Falha de persistência mantém o paciente no HUB.
- Autosave, salvamento manual, remanejamento, migração, divisão e reordenação
  em voo são coordenados para impedir recriação tardia.
- Todas as mutações desta versão consultam o registro de Desfecho antes de
  escrever um paciente.
- Campos administrativos e `patientSnapshot` são derivados do mesmo paciente
  autoritativo lido pela transação, inclusive após atualização concorrente.
- O listener preserva o card durante o eco local otimista do Firestore e só
  aplica a retirada após a confirmação.
- Histórico local ilegível falha de forma fechada, sem apagar o valor anterior
  nem retirar o paciente.

### Testes

- Cobertura funcional para cancelamento sem escrita, três Desfechos, CID,
  persistência, snapshot, falha atômica, retry idempotente, autosave,
  salvamento manual e reordenação concorrentes.
- Cobertura de datas de permanência, limpeza de dados TEV desmarcados e
  histórico local corrompido.
- Cobertura de atualização concorrente antes da confirmação do Desfecho.
- Cobertura responsiva do modal em todos os viewports da matriz.
- Test double do Firebase passa a representar transações atômicas, eco local
  otimista, falhas, atrasos e perda de confirmação determinísticos.
- Datas fictícias de previsão foram fixadas no futuro para que animações de
  atraso não tornem a suíte dependente do dia em que ela é executada.

### Preservado

- O Clinical Copilot e os Assistentes Clínicos permanecem funcionalmente
  congelados.
- A Área Administrativa ainda não foi alterada; esta entrega cria sua fonte
  histórica real.

## [FOUNDATION-1.0-RC1.2.10-RESPONSIVE-BOUNDARY-FIX] — 2026-07-17

### Correção responsiva

- O card horizontal permanece no modo compacto até 791 px e passa ao grid a
  partir de 792 px.
- Corrigidos os overflows horizontais observados em 761 e 768 px.

### Testes

- Removidas as marcações `test.fail` de 761 e 768 px após a correção.
- Fronteira estrita validada em 759, 760, 761, 768, 790, 791, 792, 793, 1180
  e 1440 px, com conteúdo fictício curto e extremo.
- Abertura do Clinical Copilot em 390 px validada com `locator.click` e
  `locator.tap` reais.
- Todos os pacientes usados nos cenários são exclusivamente fictícios.

### Preservado

- Nenhum JavaScript, handler, temporizador, `z-index`, `pointer-events` ou
  regra clínica foi alterado pela correção responsiva.
- A semântica clínica e a persistência intermediária homologadas na RC1.2.9
  permanecem inalteradas.

### Observação monitorada

- O risco histórico intermitente de hit-testing em 390 px permanece
  monitorado, sem marcação de falha esperada ativa.

## [FOUNDATION 1.0 RC1.2.9] — 2026-07-16

### Corrigido

- Decisões intermediárias válidas de Arritmias passam a ser persistidas pelo
  Auto Save depois da atualização do estado em memória.
- Reabertura de avaliação incompleta restaura as respostas e posiciona a
  primeira microetapa ainda não respondida.

### Protegido

- Auto Save de Arritmias incompleta autorizado somente para evento real do
  usuário.
- Salvamento manual incompleto continua bloqueado pela validação existente.
- `Finalizar perfil` permanece como única ação de conclusão do perfil.
- Visualização, recolhimento e hidratação permanecem com zero mutação e zero
  escrita.

### Testes

- Cobertura fortalecida para decisões intermediárias, precipitantes,
  reabertura, novo paciente e conclusão explícita.
- Testes de leitura aguardam além dos temporizadores conhecidos e falham diante
  de escrita inesperada.
- Suíte principal e estabilidade permanecem sem retries.

### Pendências responsivas

- Interceptação do opener no card horizontal em 390 px.
- Overflow horizontal em 761 px.
- Overflow horizontal em 768 px.

## [FOUNDATION 1.0 RC1.2.8] — 2026-07-16

### Corrigido

- Separada a conclusão do fluxo do histórico de conduta imediata.
- Avaliação finalizada após conduta passa a exibir `Concluído`.
- `Conduta registrada` identifica somente fluxos ainda incompletos.
- Paciente que permanece instável continua como `Prioridade clínica`.

### Preservado

- Texto `Estabilizou após conduta imediata` no resumo.
- Aparência âmbar como histórico de maior risco.
- Pergunta explícita sobre pré-excitação.
- Correções de interação no desktop, mobile, visualização e impressão.

## [FOUNDATION 1.0 RC1.2.7] — 2026-07-16

### Adicionado

- Recuperação da abertura do Assistente Clínico no desktop hospedado.
- Confirmação de que o módulo selecionado permaneceu aberto.
- Pergunta `O ECG apresenta sinais de pré-excitação?` com respostas clínicas
  completas.

## [FOUNDATION 1.0 RC1.2.6] — 2026-07-16

### Corrigido

- Seleção no desktop deixou de depender apenas de `change`.
- Cartão inteiro passou a ser acionador.
- Eventos `click` e `change` passaram a ser deduplicados.
- Rolagem passou a ser controlada dentro do drawer.

## [FOUNDATION 1.0 RC1.2.5] — 2026-07-16

### Corrigido

- Condições de corrida que fechavam o assistente ou reabriam Arritmias após
  ação manual.
- Atualizações antigas passaram a ser descartadas após nova interação.

## [FOUNDATION 1.0 RC1.2.4] — 2026-07-16

### Alterado

- Selecionar um assistente passou a abrir o módulo imediatamente.
- Ações de visualizar e editar foram convertidas em olho e lápis acessíveis.

### Corrigido

- Removido o texto sobreposto `EditarEditando`.

## [FOUNDATION 1.0 RC1.2.3] — 2026-07-16

### Alterado

- Clinical Copilot horizontal convertido em linhas compactas.
- Removida a etapa redundante ao adicionar o primeiro assistente.
- Catálogo transformado em modo exclusivo de seleção.
- Visualização de Arritmias simplificada e somente leitura.

## [FOUNDATION 1.0 RC1.2.2] — 2026-07-16

### Adicionado

- Separação entre Recolhido, Visualização e Edição.
- Visualização somente leitura sem alterar dados.
- Catálogo progressivo de assistentes.

## [FOUNDATION 1.0 RC1.2.1] — 2026-07-16

### Adicionado

- `Resumo Assistencial — Clinical Copilot`.
- Consolidação de Arritmias, Profilaxia de TEV e Antimicrobianos.
- Sinalização compacta de prioridade e acesso direto aos módulos.

### Alterado

- Hierarquia do card padronizada.
- Status operacional movido para o cabeçalho.

## [FOUNDATION 1.0 RC1.2.0] — 2026-07-16

### Adicionado

- Resumo estruturado de Arritmias no card.
- Estados Concluído, Em andamento, Prioridade e Conduta registrada.
- Conteúdo do resumo na busca, cópia, snapshot e impressão.

## [FOUNDATION 1.0 RC1.1.4]

### Adicionado

- Clinical Copilot Framework para Arritmias.
- Indicador de avaliação concluída ou em andamento.
- Acesso direto ao módulo e rótulos dinâmicos do assistente.
- Suporte para teclado e tecnologias assistivas.

### Preservado

- Persistência, Auto Save, Auto Advance e Perfil Clínico.

### Corrigido

- Novo paciente deixa de herdar estado clínico do paciente anterior.
