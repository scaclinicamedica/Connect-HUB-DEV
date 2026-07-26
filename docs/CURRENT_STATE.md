# Estado atual do projeto

Atualizado em: 25/07/2026

## Baseline

- Produto: Connect HUB — Passagem de Plantão.
- Componente em foco: Desfecho, inteligência administrativa e segurança do
  Firestore.
- Base: FOUNDATION 1.0.
- Release funcional em preparação:
  `FOUNDATION-1.0-RC1.3.3-OUTCOME-NOSOLOGY-SECTOR-LOS`.
- Baseline publicado imediatamente anterior: RC1.2.10 — correção da fronteira
  responsiva.
- Arquivo da versão publicada anterior: `passagem.html`.
- Commit de referência na `main`:
  `73dea7425f4a06bfb9afcc6222d1b57c113d0cd2`.
- Base local validada da inteligência administrativa: commit `d17ebdb`.
- A camada adicional de segurança do Firestore e autenticação administrativa
  está implementada no candidato local, mas ainda não foi publicada nem
  provisionada no ambiente Firebase real.

Antes de uma mudança funcional, confirme que a `main` ainda corresponde a
esse baseline ou atualize este documento.

## Situação funcional

O Assistente de Arritmias está integrado ao formulário do paciente e ao
Clinical Copilot exibido no card da passagem de plantão.

O fluxo validado contempla:

- seleção direta do assistente;
- abertura automática do módulo selecionado;
- avaliação clínica progressiva;
- Auto Save;
- Auto Advance;
- edição deliberada;
- ação `Finalizar perfil` para FA/Flutter;
- visualização somente leitura;
- recolhimento para resumo compacto;
- resumo assistencial no card;
- acesso direto do card ao módulo;
- funcionamento em mobile e desktop;
- cards verticais e horizontais;
- busca, passagem copiada, snapshot e impressão.

O Assistente de Profilaxia de TEV é considerado homologado na V1. O Clinical
Copilot também consolida Antimicrobianos quando selecionado.

### Desfecho — RC1.3.3

- A ação destrutiva `Excluir` foi substituída por `Desfecho` no card e no
  drawer.
- As opções fechadas são Alta médica, Óbito e Transferência externa; os
  códigos persistidos `treated`, `death` e `transferred` permanecem estáveis.
- Todos os Desfechos exigem CID principal em formato estruturado e médico
  responsável explicitamente confirmado.
- Abertura, navegação e cancelamento não criam evento de Desfecho.
- A confirmação preserva o objeto clínico integral no evento privado
  `historico_eventos/<outcomeId>` com `type: patient_outcome`.
- O guard operacional foi separado em uma lápide mínima
  `connect_hub_v55/<setor>/closed_patients/<patientId>`, sem nome, CID,
  diagnóstico, alertas ou snapshot clínico.
- Evento privado, projeção administrativa mínima, lápide e retirada do
  paciente ativo usam uma única transação atômica, de criação condicional e
  idempotente.
- A interface exibe `Encerrando atendimento...` e só retira o paciente depois
  da confirmação da persistência.
- A abertura do Desfecho confirma primeiro qualquer alteração pendente do
  alerta `Paliativo`; falha de gravação mantém o fluxo bloqueado.
- Hidratação e geração da assinatura do rascunho não disparam autosave
  programático; mudanças reais de Paliativo e PaO₂/FiO₂ mantêm o salvamento
  automático.
- Falha mantém o paciente no HUB e permite nova tentativa.
- As mutações de paciente desta versão consultam a lápide determinística antes
  de gravar. Autosave, salvamento manual, remanejamento, migração, divisão e
  reordenação em voo são aguardados e não recriam o paciente depois do
  encerramento.
- O eco local otimista do Firestore não retira o card antes da confirmação.
- `actorUid` e `closedByUid` vinculam evento, projeção e lápide à sessão
  Firebase que confirmou a operação.
- `firestore.rules` exige as quatro partes no mesmo commit, torna histórico,
  projeção e lápide imutáveis, nega delete avulso e bloqueia recriação do
  mesmo ID em qualquer setor conhecido.
- As Rules da RC1.3.3 passaram em 33/33 cenários no Firestore Emulator; elas
  ainda precisam ser publicadas no projeto Firebase antes do merge da
  aplicação.
- A Área Administrativa apresenta uma aba própria de Desfechos baseada na
  projeção materializada `admin_outcomes` e, exclusivamente para permanência
  setorial, em `admin_sector_transitions`; não consulta eventos privados.
- Novos pacientes iniciam rastreamento setorial com timestamp do servidor.
  Migrações entre setores criam um fato imutável e atômico em
  `admin_sector_transitions`; remanejamentos internos preservam o início do
  setor.
- Ativos legados sem rastreamento não recebem permanência inventada: o
  Desfecho os marca como cobertura setorial indisponível. A primeira migração
  posterior inicia observação parcial.

Consulte `docs/OUTCOMES_SPEC.md`.

### Segurança e acesso administrativo

- O código compartilhado de acesso administrativo foi removido.
- O painel exige Firebase Authentication por e-mail e senha e valida
  `admin_users/<uid>` com `active: true` e papel `admin` ou `coordinator`.
- A autenticação usa a instância Firebase nomeada `connect-hub-admin`, com
  persistência de sessão, sem substituir a sessão anônima clínica.
- Usuário anônimo pode consultar somente uma lápide conhecida por `get`; não
  pode listar lápides nem ler `historico_eventos`.
- Somente usuário não-anônimo, ativo e com papel administrativo pode ler o
  histórico integral.
- Logout, acesso negado e falha de autorização limpam os dados administrativos
  da interface e da memória.
- O atalho histórico da tela clínica não contém mais código compartilhado e
  leva ao login administrativo real.
- Confirmações de transição de cuidados podem ser criadas e lidas, mas passam
  a ser imutáveis nas Rules.
- Um contrato legado fechado preserva a criação por abas antigas durante a
  janela Rules-first, sem aceitar campos arbitrários.
- A leitura histórica indisponível ou truncada bloqueia relatórios e
  exportações para evitar resultado incompleto.
- A aba Desfechos oferece período inicial de 30 dias, filtros por período,
  setor, especialidade, tipo, CID e registro paliativo.
- A projeção administrativa versão 3 preserva
  `palliativeAlertPresentAtOutcome` e acrescenta somente o envelope técnico de
  rastreamento setorial; documentos versão 1 e 2 continuam legíveis.
- A visão apresenta Óbitos gerais registrados, Óbitos com alerta Paliativo,
  cobertura do registro, permanência média/mediana e sua distribuição,
  permanência por tipo, perfil nosológico de todos os Desfechos por CID,
  permanência observada por setor, consolidações e auditoria.
- Gráficos permanecem complementares a tabelas exatas e possuem fallback
  textual; os KPIs do censo atual ficam ocultos na aba histórica.
- A proporção de Óbitos é identificada explicitamente como proporção entre os
  Desfechos registrados, não como mortalidade institucional.
- “Sem alerta Paliativo registrado” não significa “não paliativo”. O perfil
  nosológico usa CIDs estruturados dos três Desfechos, mas não valida a
  terminologia oficial.
- Cada consolidação por setor/especialidade mostra a cobertura local do
  registro do alerta, evitando comparação enganosa entre grupos com proporções
  diferentes de documentos legados.
- O contrato das Rules vincula a presença do alerta no evento ao paciente
  ativo lido pela transação e valida o formato dos novos CIDs e da DIH.
- A aba Desfechos não baixa o evento privado: consulta somente a projeção
  mínima sem `patientSnapshot` e os fatos administrativos de transição. Usa
  timestamps do servidor para período, auditoria e permanência.
- O tempo por setor usa intervalos decorridos em horas, soma retornos ao mesmo
  setor e mostra cobertura completa, parcial ou indisponível. A DIH inclusiva
  continua sendo uma métrica hospitalar separada.
- A auditoria renderiza no máximo 50 registros por página; filtros podem ser
  limpos em uma única ação e tabelas roláveis são navegáveis por teclado.
- O setor legado `uti` participa das consultas e dos totais.
- A validação administrativa isolada passou em 37/37 cenários funcionais
  (15 de autenticação/segurança e 22 de Desfechos) e 16/16 cenários da matriz
  responsiva (8 por superfície). O recorte de Desfechos soma 30 casos:
  22 funcionais e 8 responsivos.
- Antes da publicação é obrigatório habilitar Email/Password, criar a conta
  institucional, cadastrar `admin_users/<uid>` e publicar as Rules.

Consulte `docs/FIRESTORE_SECURITY.md`.

### Persistência intermediária — RC1.2.9

- Cada decisão válida de Arritmias solicita persistência depois de atualizar o
  estado em memória e executar o Auto Advance aplicável.
- Arritmias incompleta pode ser persistida somente pelo Auto Save originado em
  evento real do usuário.
- O salvamento manual permanece bloqueado enquanto o módulo estiver incompleto.
- Ao reabrir, o fluxo restaura as respostas persistidas e posiciona a primeira
  microetapa ainda incompleta.
- Antes de `Finalizar perfil`, `finalized` e `clinicalProfile.completed`
  permanecem `false`, e o estado continua `Em andamento`.
- Visualização, recolhimento e hidratação não modificam o objeto do paciente nem
  produzem escrita, inclusive após os temporizadores conhecidos.

### Fronteira responsiva — RC1.2.10

- O modo horizontal permanece compacto até 791 px.
- O grid horizontal começa em 792 px.
- Os overflows horizontais de 761 e 768 px foram corrigidos.
- As marcações `test.fail` desses dois viewports foram removidas.
- A fronteira estrita foi validada em 759, 760, 761, 768, 790, 791, 792, 793,
  1180 e 1440 px com pacientes exclusivamente fictícios e conteúdos curto e
  extremo.
- Em 390 px, a abertura do Clinical Copilot foi validada com `locator.click` e
  `locator.tap` reais.
- Nenhum JavaScript, handler, temporizador, `z-index`, `pointer-events` ou regra
  clínica foi alterado pela correção responsiva.
- A semântica clínica e a persistência intermediária homologadas na RC1.2.9
  permanecem inalteradas.

## Hierarquia homologada do card

1. Cabeçalho e situação operacional.
2. Alerta superior de prioridade, quando necessário.
3. Hipótese diagnóstica.
4. Pendências.
5. Resumo Assistencial — Clinical Copilot.
6. Outros alertas não consolidados.
7. Ações do card.

Status operacional, como `Aguardando UTI`, permanece separado dos estados
clínicos dos assistentes. Pacientes sem módulos selecionados não exibem um
contêiner vazio.

## Modos de Arritmias

### Recolhido

Formato compacto durante a edição geral do paciente. Exibe módulo, estado,
resumo e ações para visualizar ou editar.

### Visualização

Modo somente leitura aberto pelo olho ou pelo resumo do card quando o módulo
está concluído. Exibe diagnóstico, estabilidade, evolução/conduta e perfil
clínico sem modificar os dados.

### Edição

Aberta deliberadamente pelo lápis, pela continuidade de avaliação incompleta
ou imediatamente após selecionar Arritmias para um novo paciente.

## Seleção de assistentes

Para um novo paciente:

1. `Adicionar assistente clínico` abre diretamente o catálogo.
2. O catálogo funciona como modo de seleção.
3. O cartão inteiro é clicável.
4. Selecionar fecha o catálogo.
5. O módulo é aberto e posicionado na área visível do drawer.
6. `Adicionar outro assistente` permite incluir outro módulo.

Não existe uma etapa adicional obrigando o usuário a clicar em `Concluir`
antes de abrir o primeiro módulo selecionado.

## Compatibilidade mobile e desktop

A RC1.2.10 preserva as correções das RC1.2.5 a RC1.2.8 e a persistência
intermediária homologada na RC1.2.9:

- ações manuais prevalecem sobre temporizadores antigos;
- abrir, recolher, visualizar e selecionar não são revertidos por uma
  atualização automática anterior;
- `click` e `change` funcionam como caminhos complementares;
- solicitações duplicadas são descartadas;
- a rolagem é controlada dentro do drawer;
- uma camada de recuperação confirma que cabeçalho e módulo permaneceram
  abertos no ambiente hospedado.

Larguras registradas na fronteira horizontal: 759, 760, 761, 768, 790, 791,
792, 793, 1180 e 1440 px. A abertura do Clinical Copilot também foi validada
em 390 px com mouse e toque reais.

O risco histórico intermitente de hit-testing do opener no card horizontal em
390 px permanece como observação monitorada, sem falha esperada ativa. Os
overflows de 761 e 768 px não são mais pendências.

## Semântica dos estados

| Estado | Significado |
|---|---|
| `Em andamento` | Existem decisões obrigatórias pendentes. |
| `Conduta registrada` | Houve estabilização após conduta, mas ainda existe etapa pendente. |
| `Concluído` | Todas as etapas aplicáveis foram finalizadas, inclusive após conduta. |
| `Prioridade clínica` | Existe instabilidade atual, persistente ou não resolvida. |

Regras obrigatórias:

- `Conduta registrada` não é sinônimo de `Concluído`.
- Avaliação finalizada após conduta deve exibir `Concluído`.
- `Estabilizou após conduta imediata` permanece no corpo do resumo.
- A cor âmbar pode preservar o histórico de risco, mas não substitui o estado.
- Paciente que permanece instável continua como `Prioridade clínica`.

## Resumo assistencial

O resumo é derivado exclusivamente dos dados estruturados registrados pelo
usuário. Pode apresentar diagnóstico, estado hemodinâmico, resposta à
conduta, padrão do episódio, janela de início, pré-excitação, anticoagulação
prévia, precipitantes e próxima etapa pendente.

O sistema não deve criar informação clínica por inferência. Se o estado
hemodinâmico não estiver documentado, deve informar `Estado hemodinâmico não
informado` em vez de assumir estabilidade.

## Limitações técnicas atuais

- `passagem.html` é monolítico e concentra interface, estilos e scripts.
- O artefato clínico permanece monolítico; as contagens exatas devem ser
  atualizadas depois do congelamento deste candidato.
- O estado é majoritariamente global; a persistência combina Firebase
  Auth/Firestore e fallback por `localStorage`.
- O repositório possui uma suíte portátil de caracterização com Playwright,
  Chromium gerenciado, Firebase em memória e rede restrita a localhost.
- Os testes fortalecidos da RC1.2.9 cobrem Auto Save intermediário,
  reabertura, conclusão explícita, visualização, recolhimento, hidratação e
  isolamento entre pacientes, sempre com `retries: 0`.
- Os testes responsivos da RC1.2.10 cobrem a fronteira estrita do modo
  horizontal e o acionamento real do Clinical Copilot em 390 px, sem retries.
- O teste histórico `test_rc128.cjs` não é portátil: depende de Playwright do
  ambiente e de um Chromium localizado em caminho temporário absoluto.
- A estabilidade desktop em 1440 px permanece protegida por 50 repetições,
  um worker e nenhum retry.
- O baseline local anterior `d17ebdb` passou em 131/131 testes da suíte
  principal, 22/22 cenários de Rules, impressão A4 e estabilidade 50/50.
- O candidato RC1.3.3 passou em 145/145 testes da suíte principal, 33/33
  cenários de Rules, impressão A4 e 50/50 repetições de estabilidade, com um
  worker e zero retries. A configuração global descobre 146 testes em 20
  arquivos, incluindo uma execução do cenário de estabilidade repetido
  separadamente.
- `npm audit --omit=dev` não encontrou vulnerabilidades de produção. A
  auditoria completa registra 21 ocorrências transitivas no `firebase-tools`
  de desenvolvimento/CI (16 altas e 5 moderadas), sem correção não destrutiva
  disponível na versão estável atual; o CLI permanece restrito a runner
  controlado.
- As Rules locais não protegem produção até serem efetivamente publicadas no
  projeto Firebase.
- Esta branch pode ser usada somente em teste controlado com pacientes
  fictícios enquanto o login clínico nominal estiver adiado. Isso não remove o
  bloqueio de publicação de produção.
- Os usuários clínicos permanecem anônimos. O UID registra a sessão do
  Desfecho, mas não comprova a identidade nominal do profissional nem a autoria
  individual de cada campo do paciente ativo.
- O site hospedado é público e o cliente clínico ainda usa Auth anônimo. Sem
  autenticação clínica nominal ou barreira institucional comprovada, qualquer
  visitante capaz de iniciar uma sessão anônima recebe as permissões clínicas
  da V1; isso bloqueia uma nova publicação de produção.
- Antes de uma refatoração ampla, os cenários homologados devem permanecer
  protegidos pelos testes de caracterização do repositório.

## Restrições de manutenção

Até nova homologação:

- não alterar a lógica clínica de Arritmias;
- não remover Auto Save ou Auto Advance;
- não tornar a visualização editável;
- não substituir `Finalizar perfil` por conclusão implícita;
- não mudar a semântica dos estados;
- não alterar a hierarquia homologada do card;
- não quebrar busca, cópia, snapshot ou impressão;
- validar desktop e mobile separadamente;
- não utilizar dados reais de pacientes.
