# Changelog

## [Não publicado — login clínico nominal e segurança de Desfecho] — 2026-07-25

### Login clínico nominal

- Removido `signInAnonymously` do HUB e da Passagem.
- Adicionado login institucional por e-mail/senha e perfil exato
  `clinical_users/<uid>` com `active: true` e papel `clinician`.
- O perfil é obtido do servidor antes de qualquer leitura clínica e observado
  em tempo real para revogação imediata.
- Persistência `SESSION` passa a ser obrigatória; configuração, autenticação
  ou permissão ausente encerra qualquer credencial restaurada e falha fechada,
  sem fallback clínico por `localStorage`.
- Sessões anônimas legadas são encerradas.
- Logout aguarda autosave, Desfecho, metadados, confirmação e auditoria em
  voo; depois limpa listeners, pacientes, formulários, modal de Desfecho,
  metadados, impressão e caches clínicos legados de todos os setores.
- HUB e Passagem exibem o nome institucional com inserção textual segura.
- Eventos comuns, confirmações e Desfechos vinculam a autoria ao UID nominal.
- A sessão clínica padrão e a instância administrativa
  `connect-hub-admin` permanecem isoladas nos dois sentidos.

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
- Migrações válidas, atualizações em lote e eventos comuns com `actorUid`
  nominal permanecem compatíveis.

### Acesso administrativo

- Removidos o código compartilhado, a autorização por `sessionStorage` e o
  login anônimo da Área Administrativa.
- Adicionado login Firebase por e-mail e senha, com perfil
  `admin_users/<uid>` ativo e papel `admin` ou `coordinator`.
- A autenticação administrativa usa a instância nomeada `connect-hub-admin`
  para preservar a sessão clínica nominal.
- O atalho da tela clínica deixa de usar código compartilhado e passa a abrir
  o login administrativo real.
- Histórico integral e listagem de lápides ficam restritos a usuário
  Email/Password autorizado; o clínico pode apenas consultar uma lápide
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

- Adicionada suíte de 27 cenários de Firestore Rules no Emulator, cobrindo
  atomicidade, imutabilidade, perfis, ressurreição, migração e compatibilidade.
- `firebase-tools` permanece fixado na versão atual 15.24.0. A auditoria do
  artefato entregue ao navegador (`npm audit --omit=dev`) não apresenta
  vulnerabilidades; a árvore completa ainda recebe alertas altos/moderados
  transitivos do CLI de emulador, sem versão posterior disponível.
- Adicionada caracterização Playwright do login, autorização, isolamento de
  sessão, revogação em tempo real, falha de persistência, logout, confirmação
  concorrente, limpeza de conteúdo, escape e responsividade do painel.
- Adicionados testes funcionais e responsivos da aba Desfechos para período,
  filtros, métricas, CIDs, auditoria, estados seguros e descarte do snapshot.
- Validação isolada da Área Administrativa: 25/25 cenários funcionais e 16/16
  cenários da matriz responsiva.
- Validação funcional de Desfecho: 15/15, incluindo conflito entre sessões.
- O candidato nominal contém 173 testes descobertos: 172 na suíte principal e
  um cenário de estabilidade repetido 50 vezes; a execução final deve ser
  registrada no PR.
- A publicação exige habilitar Email/Password, criar a conta institucional,
  cadastrar `clinical_users/<uid>` e `admin_users/<uid>` e publicar
  `firestore.rules` em janela controlada antes do merge da aplicação.
- As Rules estão versionadas e testadas, mas ainda não estão publicadas no
  projeto Firebase.

### Limitação conhecida

- Todos os clínicos ativos ainda acessam todos os setores.
- As Rules não validam campo a campo o paciente ativo nem comparam
  integralmente o snapshot; login nominal não transforma a V1 em prontuário.
- A implementação está pronta, mas produção continua bloqueada até
  provisionamento institucional, deploy das Rules e smoke test controlado.
- O CLI do Firebase é usado somente em CI/emulador com entrada controlada e
  ainda traz alertas transitivos de desenvolvimento; não integra o HTML
  entregue, mas deve ser reavaliado quando houver atualização do fornecedor.

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
