# Estado atual do projeto

Atualizado em: 25/07/2026

## Baseline

- Produto: Connect HUB — Passagem de Plantão.
- Componente em foco: login clínico nominal, Desfecho, segurança do Firestore
  e acesso administrativo.
- Base: FOUNDATION 1.0.
- Release funcional em preparação:
  `FOUNDATION-1.0-RC1.3.2-ACCESS-MANAGEMENT`.
- Baseline publicado imediatamente anterior: RC1.2.10 — correção da fronteira
  responsiva.
- Arquivo publicado: `passagem.html`.
- Commit de referência na `main`:
  `73dea7425f4a06bfb9afcc6222d1b57c113d0cd2`.
- Candidato de Desfecho validado no PR: commit
  `9248e42096a9e6a2fa8cd92deeabdd63eaba5b8e`.
- A camada de segurança, autenticação nominal e Área Administrativa está
  implementada na branch candidata, mas ainda não foi publicada.

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

### Desfecho — RC1.3.0

- A ação destrutiva `Excluir` foi substituída por `Desfecho` no card e no
  drawer.
- As opções fechadas são Tratado, Óbito e Transferido.
- Óbito exige CID principal; todos os Desfechos exigem médico responsável
  explicitamente confirmado.
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
- As Rules possuem 46 cenários automatizados no Firestore Emulator, mas ainda
  precisam ser publicadas no projeto Firebase antes do merge da aplicação.
- A Área Administrativa apresenta uma aba própria de Desfechos baseada somente
  na projeção materializada `admin_outcomes`.

Consulte `docs/OUTCOMES_SPEC.md`.

### Login clínico nominal

- `index.html` e `passagem.html` não usam mais `signInAnonymously`.
- O acesso exige Email/Password, e-mail verificado e perfil próprio
  `clinical_users/<uid>` exato, ativo e com papel `clinician`.
- Perfis bootstrap v1 permanecem compatíveis e imutáveis. Médicos ativados por
  convite recebem perfil v2 com timestamps, revisão, `inviteId` e
  `lastAccessEventId`.
- O perfil é consultado no servidor antes de qualquer leitura clínica e
  observado em tempo real; desativação encerra a sessão e limpa a interface.
- A persistência obrigatória é `SESSION`. Configuração ausente, falha de
  autenticação ou perda de permissão não abre cache local.
- Logout aguarda autosave, Desfecho, metadados, confirmação e auditoria em
  voo; depois remove listeners, pacientes, formulário, metadados e impressão.
- HUB e Passagem exibem o nome autorizado com inserção textual segura.
- Eventos comuns, confirmações, Desfecho e lápide vinculam a gravação ao UID
  nominal.
- Todos os clínicos ativos ainda acessam todos os setores conhecidos; menor
  privilégio por setor é uma etapa futura.

### Segurança e acesso administrativo

- O código compartilhado de acesso administrativo foi removido.
- O painel exige Firebase Authentication por e-mail e senha e valida
  `admin_users/<uid>` no schema v1 exato, com e-mail verificado,
  `active: true` e papel `admin` ou `coordinator`.
- A autenticação usa a instância Firebase nomeada `connect-hub-admin`, com
  persistência de sessão, sem substituir a sessão clínica nominal.
- Clínico nominal pode consultar somente uma lápide conhecida por `get`; não
  pode listar lápides nem ler `historico_eventos`.
- Somente usuário Email/Password, ativo e com papel administrativo pode ler o
  histórico integral.
- Logout, acesso negado e falha de autorização limpam os dados administrativos
  da interface e da memória.
- A tela clínica não oferece atalho administrativo aos médicos. O HUB exibe o
  card administrativo somente para um perfil administrativo próprio válido;
  a URL continua protegida pelas Rules.
- O papel `admin` é apresentado como Gestor e recebe a aba Usuários.
  Coordenadores permanecem somente leitura e não consultam as coleções de
  gestão de acesso.
- O Gestor cria convites de 72 horas, envia ou reenvia o Firebase Email Link
  diretamente para a caixa postal cadastrada, revoga convites pendentes,
  edita o nome, ativa/desativa perfis v2 e solicita redefinição genérica de
  senha. Toda mutação persistente é atômica e grava `access_audit`.
- Não há domínio institucional obrigatório nesta etapa: o Gestor pode
  convidar qualquer endereço de e-mail sintaticamente válido.
- A Área Administrativa não disponibiliza a URL de ação. `cadastro.html` só
  prossegue quando recebe um Firebase Email Link válido junto do fragmento
  canônico `#invite=invite_<32hex>`; qualquer combinação ausente ou
  malformada falha fechada.
- Depois de abrir a mensagem recebida, o médico redigita o e-mail e
  `signInWithEmailLink` confirma a posse da caixa postal. O cadastro exige
  `additionalUserInfo.isNewUser === true`; conta Firebase preexistente é
  desconectada, orientada a procurar o Gestor e não pode reivindicar convite,
  entrar ou redefinir senha nessa tela.
- Somente a conta comprovadamente nova define senha, encerra a sessão Email
  Link e reautentica por Password antes de reivindicar o convite. Recuperação
  de falha parcial só existe na mesma navegação depois da confirmação de
  `isNewUser === true`; após recarga, o Gestor revisa e remove a conta órfã no
  Firebase Console e emite um novo convite.
- Nenhuma leitura Firestore ocorre antes da reautenticação Password.
- O fluxo usa o plano Firebase gratuito atual; não depende de Cloud Functions
  nem de Supabase nesta etapa. O limite atual do Spark é de cinco Email Links
  ao dia; o envio inicial e cada reenvio feito pelo Gestor consomem essa cota.
  Os acessos seguintes usam senha.
- Confirmações de transição de cuidados podem ser criadas e lidas, mas passam
  a ser imutáveis nas Rules.
- Um contrato legado fechado preserva a criação por abas antigas durante a
  janela Rules-first, sem aceitar campos arbitrários.
- A leitura histórica indisponível ou truncada bloqueia relatórios e
  exportações para evitar resultado incompleto.
- A aba Desfechos oferece período inicial de 30 dias, filtros por período,
  setor, especialidade e tipo, contagens, permanência média/mediana com
  cobertura, proporção de Óbitos entre Desfechos, consolidações, CIDs e tabela
  de auditoria.
- A proporção de Óbitos é identificada explicitamente como proporção entre os
  Desfechos registrados, não como mortalidade institucional.
- A aba Desfechos não baixa o evento privado: consulta somente a projeção
  mínima sem `patientSnapshot` e usa o timestamp do servidor para período,
  auditoria e permanência.
- O setor legado `uti` participa das consultas e dos totais.
- As Rules ampliadas passaram em 46/46 cenários no Emulator local. A validação
  dinâmica completa das novas telas será repetida no CI com Java 21 e
  Chromium.
- A descoberta Playwright contém 212 testes: 131 funcionais, 80 da matriz
  responsiva e um cenário de estabilidade repetido 50 vezes separadamente.
  Os 211 primeiros compõem a suíte principal.
- Antes da publicação é obrigatório habilitar Email/Password e Email Link,
  revisar contas verificadas existentes, criar e verificar manualmente somente
  o primeiro Gestor, cadastrar os dois perfis desse UID, validar envio,
  reenvio, cadastro e reset e publicar as Rules. O e-mail real do Gestor nunca
  deve ser incluído no repositório.

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
- O artefato continua monolítico, com grande volume de HTML, CSS e JavaScript
  inline.
- O estado é majoritariamente global; a persistência clínica exige Firebase
  Auth/Firestore e falha fechada.
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
- As Rules locais não protegem produção até serem efetivamente publicadas no
  projeto Firebase.
- O login nominal remove o acesso clínico anônimo, mas não valida campo a
  campo os pacientes nem restringe o profissional a setores específicos.
- As Rules locais não têm efeito até o deploy; o merge continua bloqueado por
  provisionamento do primeiro Gestor e publicação controlada, não por falta
  de implementação.
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
