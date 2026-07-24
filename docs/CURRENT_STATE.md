# Estado atual do projeto

Atualizado em: 24/07/2026

## Baseline

- Produto: Connect HUB — Passagem de Plantão.
- Componente em foco: Clinical Copilot — Assistente de Arritmias.
- Base: FOUNDATION 1.0.
- Release funcional em preparação:
  `FOUNDATION-1.0-RC1.2.10-RESPONSIVE-BOUNDARY-FIX`.
- Baseline publicado imediatamente anterior: RC1.2.9 — persistência
  intermediária de Arritmias.
- Arquivo publicado: `passagem.html`.
- Commit de referência na `main`:
  `6d20650b675ea77fe249a2acdc69254b0523668e`.
- Artefato local que originou a publicação:
  `passagem-Arritmias-FOUNDATION-1.0-RC1.2.8-Completion-State-Semantic-Alignment.html`.
- Tamanho registrado do artefato: 1.259.660 bytes.
- SHA-256 registrado:
  `c6396cb91b387e63696f287caac060bc1b402c47a86551d4dcd9bcb2797902d7`.

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
- A confirmação preserva o objeto clínico integral em
  `historico_eventos` com `type: patient_outcome`.
- Registro histórico e retirada do paciente ativo usam uma única transação
  atômica, de criação condicional e idempotente.
- A interface exibe `Encerrando atendimento...` e só retira o paciente depois
  da confirmação da persistência.
- Falha mantém o paciente no HUB e permite nova tentativa.
- As mutações de paciente desta versão consultam o Desfecho determinístico
  antes de gravar. Autosave, salvamento manual, remanejamento, migração,
  divisão e reordenação em voo são aguardados e não recriam o paciente depois
  do encerramento.
- O eco local otimista do Firestore não retira o card antes da confirmação.
- A garantia contra clientes antigos ou gravações externas ainda requer Rules
  imutáveis no projeto Firebase; elas não estão versionadas neste repositório.
- A Área Administrativa ainda não foi modificada para apresentar os novos
  indicadores.

Consulte `docs/OUTCOMES_SPEC.md`.

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
- O artefato RC1.3.0 possui 26.182 linhas, 105 blocos `<style>` e 61 blocos
  `<script>`.
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
