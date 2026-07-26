# Suíte portátil de caracterização da V1

Esta suíte executa a V1 diretamente a partir de `passagem.html`. Ela não
depende de build da aplicação, Firebase real, caminhos temporários absolutos
ou navegador instalado manualmente.

Todos os pacientes usados nos testes são explicitamente fictícios. Não copie
informações de prontuário para fixtures, traces, screenshots ou PDFs.
Datas de previsão usadas para exercitar pacientes não atrasados devem ser
determinísticas e permanecer no futuro, sem depender da data de execução.

A identificação funcional atualmente caracterizada é
`FOUNDATION-1.0-RC1.3.2-ADMIN-INTELLIGENCE`.

## Pré-requisitos

- Node.js 22, 24 ou 26.
- npm.
- Git disponível no `PATH` para a verificação de integridade.
- Java 21 ou superior para o Firestore Emulator usado pelas Rules.

## Instalação

```bash
npm ci
npx playwright install chromium
```

Em Linux/CI, instale também as dependências do Chromium:

```bash
npx playwright install --with-deps chromium
```

## Execução

Suíte principal:

```bash
npm test
```

Estabilidade desktop em 1440 px, com 50 repetições, um worker e sem retries:

```bash
npm run test:stability
```

Impressão A4 com oito pacientes fictícios:

```bash
npm run test:print
```

Integridade do artefato clínico:

```bash
npm run verify:integrity
```

Firestore Rules no Emulator:

```bash
npm run test:rules
```

Autenticação e autorização da Área Administrativa em 1180 px:

```bash
npx playwright test tests/e2e/admin-auth.spec.ts \
  --project=functional-1180
```

Matriz responsiva do acesso administrativo:

```bash
npx playwright test tests/e2e/admin-auth.matrix.spec.ts
```

Indicadores administrativos de Desfecho em 1180 px:

```bash
npx playwright test tests/e2e/admin-outcomes.spec.ts \
  --project=functional-1180
```

Matriz responsiva da aba Desfechos:

```bash
npx playwright test tests/e2e/admin-outcomes.matrix.spec.ts
```

## Cobertura fortalecida na RC1.2.9

- persistência intermediária das decisões e dos precipitantes de Arritmias;
- Auto Advance e reabertura na primeira microetapa incompleta;
- `finalized=false`, `clinicalProfile.completed=false` e `Em andamento` antes
  de `Finalizar perfil`;
- salvamento manual bloqueado para Arritmias incompleta;
- zero escrita em visualização, recolhimento e hidratação;
- novo paciente sem herdar estado clínico;
- conclusão exclusivamente por `Finalizar perfil`.

A configuração global e os cenários de estabilidade permanecem com
`retries: 0`.

## Cobertura de Desfecho na RC1.3.0

- substituição da ação Excluir por Desfecho no card e no drawer;
- ausência de escrita ao abrir ou cancelar;
- enumeração fechada Tratado, Óbito e Transferido;
- CID principal obrigatório somente no Óbito;
- persistência do médico responsável, setor, especialidade, DIH e permanência;
- preservação integral do snapshot clínico;
- transação condicional, atômica e idempotente entre evento privado, lápide
  mínima e retirada do paciente ativo;
- estado `Encerrando atendimento...` enquanto o commit está pendente;
- falha atômica mantendo o paciente e permitindo retry;
- retry após perda de confirmação sem sobrescrever o registro imutável;
- atualização concorrente mantendo campos administrativos e snapshot
  consistentes entre si;
- coordenação com autosave, salvamento manual e reordenação em voo sem
  recriação tardia;
- confirmação do alerta `Paliativo` pendente antes de liberar o modal;
- hidratação de paciente já Paliativo sem escrita ou timer recorrente, mantendo
  autosave em alterações reais;
- preservação visual durante o eco local otimista do Firestore;
- datas de permanência inválidas, futuras e no mesmo dia;
- falha fechada quando o histórico local está corrompido;
- limpeza de dados TEV desmarcados no snapshot do drawer;
- modal sem overflow na matriz responsiva.

## Cobertura de segurança do Desfecho

`npm run test:rules` executa 22 cenários contra o Firestore Emulator:

- criação conjunta de evento privado, projeção mínima, lápide e exclusão do
  ativo;
- negação de cada parte isolada e de combinações incompletas;
- vínculo de `actorUid` e `closedByUid` ao UID autenticado;
- obrigatoriedade do médico e do CID no Óbito;
- imutabilidade do `patient_outcome`, `patient_outcome_admin` e
  `patient_closed`;
- bloqueio de recriação no mesmo setor e nos demais setores conhecidos;
- separação entre `get` clínico da lápide e leitura administrativa do
  histórico;
- autorização de `admin` e `coordinator` não-anônimos e ativos;
- negação de usuário anônimo, perfil ausente/inativo ou papel não permitido na
  leitura histórica;
- preservação de create/update/get/list de pacientes ativos;
- preservação de migração válida e atualização atômica em lote;
- negação de delete avulso do paciente;
- compatibilidade imutável de eventos legados reconhecidos;
- reserva do ID determinístico `patient_outcome_*`;
- criação/leitura e imutabilidade das confirmações de transição de cuidados.
- compatibilidade transitória do contrato legado de confirmação, sem campos
  extras nem timestamp fornecido pelo cliente.
- leitura histórica da projeção administrativa v1, negação de novas criações
  v1, obrigatoriedade do booleano na v2 e negação de divergência em relação ao
  evento privado ou ao paciente ativo;
- rejeição de CID livre/identificável fora do formato estruturado.
- rejeição de DIH com sufixo ou fora do formato estruturado.

Os testes usam exclusivamente o projeto de demonstração
`demo-connect-hub-rules`. Nenhuma credencial ou dado do Firebase real deve ser
fornecido ao Emulator.

## Cobertura do acesso administrativo

Os testes Playwright da Área Administrativa verificam:

- remoção do código compartilhado e do login anônimo;
- redirecionamento do atalho clínico para o login administrativo real;
- login por e-mail/senha e consulta de `admin_users/<uid>`;
- autorização somente para perfil ativo `admin` ou `coordinator`;
- instância nomeada `connect-hub-admin` e preservação da sessão clínica;
- zero leitura de pacientes ou histórico antes da autorização;
- zero escrita pelo painel;
- limpeza de dados, gráficos e relatórios no logout;
- escape de conteúdo persistido no contexto privilegiado;
- bloqueio de relatório/exportação quando o histórico falha ou ultrapassa
  5.000 eventos;
- invalidação de relatório anterior após falha de atualização;
- ausência de repovoamento tardio após logout;
- degradação segura quando a biblioteca de gráficos falha;
- foco previsível e contenção responsiva do login e do dashboard.

As contas, senhas, pacientes e históricos da suíte são totalmente fictícios e
existem somente no test double em memória.

## Cobertura da aba Desfechos

Os testes dedicados verificam:

- período inicial inclusivo de 30 dias, bordas D-29/D-30, período
  personalizado e intervalo invertido;
- uso exclusivo do timestamp de servidor convertido para a data civil de
  `America/Sao_Paulo`;
- inclusão somente de `patient_outcome_admin` versões 1 ou 2 e tipos
  homologados;
- exclusão de `patient_deleted`, esquemas desconhecidos e eventos fora do
  período;
- contagens de Tratados, Óbitos e Transferidos;
- separação de Óbitos gerais, com alerta Paliativo, sem alerta e registro
  histórico indisponível, com cobertura e denominador zero;
- proporção de Óbitos entre Desfechos, média, mediana par/ímpar e cobertura que
  exclui permanências inválidas;
- distribuição em faixas, permanência por tipo, consolidações por setor e
  especialidade, perfil nosológico dos Óbitos por CID e auditoria;
- combinação dos filtros por setor, especialidade, tipo e alerta Paliativo;
- restauração conjunta dos filtros para o período padrão;
- distinção entre histórico vazio e filtro sem resultados;
- estados negado, carregando, erro e truncado sem números parciais, inclusive
  quando a leitura de pacientes falha;
- permanência recalculada por `admissionDate + createdAt`, ignorando campos
  locais e valor persistido adulteráveis;
- descarte de DIH com sufixo ou data impossível na permanência e auditoria;
- escape de todos os campos persistidos exibidos, ausência de transferência de
  `patientSnapshot` e zero escrita;
- inclusão do setor legado `uti` em consultas e totais;
- auditoria paginada em lotes de 50, com ordenação e limites de página;
- fallback de gráficos preservando números e tabelas exatas;
- separação visual entre KPIs do censo atual e indicadores históricos;
- contenção do layout, filtros, gráficos e tabelas em todos os oito viewports
  da matriz.

Validação focada da inteligência de Desfechos nesta branch: 15/15 cenários
funcionais e 8/8 cenários responsivos.

Validação funcional de Desfecho: 18/18, incluindo concorrência do alerta
Paliativo, recuperação após autosave falho, salvamento manual e conflito entre
sessões. A descoberta completa contém 132 testes, incluindo o caso de
estabilidade executado separadamente.

Validação integrada final: 131/131 testes da suíte principal, 22/22 cenários
de Rules, impressão A4 incluída e estabilidade desktop 50/50, com um worker e
zero retries.

## Isolamento

Durante cada teste Playwright, somente `127.0.0.1` pode acessar a rede. As
solicitações dos scripts Firebase são atendidas por um test double em memória;
Chart.js e XLSX recebem doubles controlados nos cenários administrativos.
Qualquer outro destino é bloqueado e registrado no artefato de rede do teste.

O vídeo está desativado por instabilidade comprovada no encerramento paralelo
do Chromium no Windows. Em diagnóstico controlado com quatro workers,
`ERR_STREAM_WRITE_AFTER_END` e os timeouts de `browserContext.close`
desapareceram; erros isolados de `GpuControl.CreateCommandBuffer` permaneceram
sem causar falhas.

Falhas continuam preservando trace, screenshot, diagnósticos de console,
tentativas de rede externa e, nos cenários temporais, uma linha do tempo das
mudanças relevantes do DOM. Essa estabilização não reduziu asserts, não
aumentou timeouts nem adicionou retries.

Os resultados ficam em `test-results/` e o relatório HTML em
`playwright-report/`. Esses diretórios não devem ser versionados.

## Fronteira responsiva na RC1.2.10

- O modo horizontal permanece compacto até 791 px e usa grid a partir de
  792 px.
- Os overflows horizontais de 761 e 768 px foram corrigidos, e as respectivas
  marcações `test.fail` foram removidas.
- A fronteira estrita exige `scrollWidth === innerWidth` em 759, 760, 761, 768,
  790, 791, 792, 793, 1180 e 1440 px.
- Cada largura valida ordem, contenção, ausência de sobreposição e recorte em
  dois cards com pacientes exclusivamente fictícios: um com conteúdo curto e
  outro com conteúdo extremo.
- Em 390 px, a abertura do Clinical Copilot e do painel de Arritmias foi
  validada por interações reais com `locator.click` e `locator.tap`.
- O risco histórico intermitente de hit-testing em 390 px permanece como
  observação monitorada, mas não como falha esperada ativa.

A correção responsiva não alterou JavaScript, handlers, temporizadores,
`z-index`, `pointer-events` ou regras clínicas. A semântica clínica e a
persistência intermediária homologadas na RC1.2.9 permanecem inalteradas.

## Atualização do Playwright

Atualize de forma deliberada, fixando a versão no `package.json`, atualizando
o lockfile e reinstalando o Chromium correspondente. A atualização deve ser
revisada separadamente porque muda também a versão do navegador de teste.
