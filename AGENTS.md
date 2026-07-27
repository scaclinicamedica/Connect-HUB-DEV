# Connect HUB — instruções para agentes

## Escopo

Este repositório contém o Connect HUB — Passagem de Plantão, publicado em:

`https://scaclinicamedica.github.io/Connect-HUB-DEV/`

A página central do fluxo assistencial é `passagem.html`. A versão atual é a
V1/DEV e permanece como referência funcional durante a construção paralela da
Phoenix V2.

Antes de propor ou implementar alterações, leia:

1. `docs/PROJECT_CONTEXT.md`;
2. `docs/CURRENT_STATE.md`;
3. `docs/ARRHYTHMIAS_SPEC.md` quando Arritmias estiver no escopo;
4. `docs/OUTCOMES_SPEC.md` quando Desfecho ou indicadores administrativos
   estiverem no escopo;
5. `docs/QA_CHECKLIST.md`;
6. `docs/ROADMAP_PHOENIX.md` para trabalhos da V2;
7. `docs/CODEX_ONBOARDING.md` para configuração do ambiente;
8. `CHANGELOG.md`.

## Regras obrigatórias

- Nunca trabalhar diretamente na `main` como fluxo normal.
- Criar uma branch específica e apresentar as mudanças por pull request.
- Não alterar regras, perguntas, opções, estados ou resumos clínicos sem
  aprovação clínica explícita.
- Não inferir informações clínicas que não tenham sido registradas pelo
  usuário.
- Não utilizar dados reais ou identificáveis de pacientes em código, testes,
  capturas de tela ou documentação.
- Não misturar uma refatoração estrutural com mudança clínica ou visual não
  solicitada.
- Preservar compatibilidade com os dados existentes ou documentar claramente
  qualquer migração necessária.
- Não substituir a V1/DEV pela Phoenix sem homologação técnica, visual e
  clínica, além de um procedimento de rollback.

## Comportamentos homologados que não podem regredir

- Auto Save das decisões registradas.
- Auto Advance entre decisões sequenciais.
- Edição deliberada de respostas anteriores.
- Ação `Finalizar perfil` para concluir o perfil de FA/Flutter.
- Visualização somente leitura sem mutação dos dados.
- Seleção de um assistente abrindo diretamente o módulo correspondente.
- Abertura, visualização e recolhimento estáveis no mobile e no desktop.
- Resumo Assistencial — Clinical Copilot no card do paciente.
- Ordem do card: cabeçalho, prioridade quando aplicável, hipótese,
  pendências, Clinical Copilot, outros alertas e ações.
- Busca, passagem copiada, snapshot de confirmação e impressão contendo o
  resumo assistencial.
- Novo paciente sem herdar o estado clínico do paciente anterior.

## Semântica obrigatória dos estados de Arritmias

- `Concluído`: todas as etapas obrigatórias aplicáveis foram finalizadas,
  inclusive quando houve conduta imediata.
- `Conduta registrada`: o paciente estabilizou após conduta imediata, mas o
  módulo ainda possui etapa obrigatória pendente.
- `Prioridade clínica`: existe instabilidade atual, persistente ou ainda não
  resolvida.
- `Em andamento`: fluxo incompleto sem os critérios anteriores.

`Conduta registrada` nunca deve substituir `Concluído` em uma avaliação
finalizada. O texto `Estabilizou após conduta imediata` pode permanecer no
corpo do resumo e a cor âmbar pode preservar o histórico de risco.

## Arquitetura atual

- A V1 é uma aplicação web estática.
- `passagem.html` concentra grande volume de HTML, CSS e JavaScript inline.
- A persistência usa Firebase Auth anônimo/Firestore quando disponíveis e
  `localStorage` como fallback.
- O arquivo possui sucessivas camadas de compatibilidade; eventos e
  temporizadores podem competir entre si.
- Uma correção local deve considerar handlers antigos, reconstruções do DOM,
  rolagem do drawer e diferenças de tempo entre mouse e toque.
- Evite acrescentar um novo patch tardio antes de localizar a regra existente
  responsável pelo mesmo estado.
- Se uma mudança exigir refatoração ampla, primeiro crie testes de
  caracterização e proponha um plano separado.
- Não renomeie campos persistidos, valores enumerados, chaves de
  `localStorage`, coleções Firestore ou IDs de DOM sem mapear consumidores e
  preparar compatibilidade ou migração.
- Não registre objetos de pacientes no console.

## Fluxo de trabalho esperado

1. Ler os documentos aplicáveis e inspecionar o código relacionado.
2. Reproduzir o comportamento atual antes de editar.
3. Explicar causa, escopo e risco da mudança.
4. Implementar a menor alteração coerente.
5. Executar o checklist de regressão aplicável.
6. Revisar o diff procurando mutações clínicas, duplicidades e regressões.
7. Atualizar documentação e changelog quando necessário.
8. Abrir PR inicialmente como rascunho.

## Execução e validação

A V1 não possui etapa de build. A suíte portátil e os comandos oficiais de
validação estão descritos em `docs/TESTING_V1.md`; não substitua esses comandos
por dependências ou caminhos específicos da máquina local.

Para uma visualização local simples, a aplicação estática pode ser servida na
raiz do repositório, por exemplo:

```bash
python3 -m http.server 8000
```

Abra `http://localhost:8000/passagem.html` e use somente dados fictícios.

Mudanças no Clinical Copilot devem ser verificadas, no mínimo, em 390, 494,
768, 1180 e 1440 px. Siga `docs/QA_CHECKLIST.md`.

## Definição de pronto

Uma tarefa só está pronta quando:

- o comportamento solicitado foi demonstrado;
- os comportamentos homologados relacionados continuam funcionando;
- desktop e mobile foram testados separadamente;
- não há erro JavaScript bloqueante ou overflow horizontal;
- acessibilidade básica dos controles foi preservada;
- não houve alteração silenciosa de dados ao visualizar;
- o PR descreve mudanças, riscos, verificações e evidências;
- qualquer mudança clínica possui aprovação explícita.
