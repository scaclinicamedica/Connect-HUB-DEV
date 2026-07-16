# Suíte portátil de caracterização da V1

Esta suíte executa a V1 diretamente a partir de `passagem.html`. Ela não
depende de build da aplicação, Firebase real, caminhos temporários absolutos
ou navegador instalado manualmente.

Todos os pacientes usados nos testes são explicitamente fictícios. Não copie
informações de prontuário para fixtures, traces, screenshots ou PDFs.

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

## Isolamento

Durante cada teste, somente `127.0.0.1` pode acessar a rede. As solicitações
dos scripts Firebase são atendidas por um test double em memória; qualquer
outro destino é bloqueado e registrado no artefato de rede do teste.

Falhas preservam trace, screenshot, vídeo, console, tentativas de rede externa
e, nos cenários temporais, uma linha do tempo das mudanças relevantes do DOM.

Os resultados ficam em `test-results/` e o relatório HTML em
`playwright-report/`. Esses diretórios não devem ser versionados.

## Regressão conhecida caracterizada

No baseline V1/DEV, o modo horizontal produz documento de 792 px nos
viewports de 761 e 768 px. O teste dedicado continua executando nessas duas
larguras e é marcado como falha esperada do baseline. Esses overflows são
pendências da V1 e não representam critérios concluídos da suíte. Uma correção
futura em `passagem.html` deverá transformar essas ocorrências em sucesso e
remover a marcação somente depois da homologação correspondente.

## Atualização do Playwright

Atualize de forma deliberada, fixando a versão no `package.json`, atualizando
o lockfile e reinstalando o Chromium correspondente. A atualização deve ser
revisada separadamente porque muda também a versão do navegador de teste.
