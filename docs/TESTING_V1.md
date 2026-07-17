# Suíte portátil de caracterização da V1

Esta suíte executa a V1 diretamente a partir de `passagem.html`. Ela não
depende de build da aplicação, Firebase real, caminhos temporários absolutos
ou navegador instalado manualmente.

Todos os pacientes usados nos testes são explicitamente fictícios. Não copie
informações de prontuário para fixtures, traces, screenshots ou PDFs.

A identificação funcional atualmente caracterizada é
`FOUNDATION-1.0-RC1.2.10-RESPONSIVE-BOUNDARY-FIX`.

## Pré-requisitos

- Node.js 22, 24 ou 26.
- npm.
- Git disponível no `PATH` para a verificação de integridade.

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

## Isolamento

Durante cada teste, somente `127.0.0.1` pode acessar a rede. As solicitações
dos scripts Firebase são atendidas por um test double em memória; qualquer
outro destino é bloqueado e registrado no artefato de rede do teste.

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
