# Contexto do projeto

## Identificação

- Produto: Connect HUB.
- Fluxo principal: Passagem de Plantão.
- Repositório: `scaclinicamedica/Connect-HUB-DEV`.
- Ambiente V1/DEV:
  `https://scaclinicamedica.github.io/Connect-HUB-DEV/`.
- Branch padrão: `main`.

## Propósito

O Connect HUB organiza informações clínicas e operacionais do paciente para
tornar a passagem de caso mais rápida, legível e funcional.

O Clinical Copilot transforma dados estruturados registrados nos assistentes
clínicos em um Resumo Assistencial dentro do card do paciente. Esse resumo
também deve permanecer disponível na busca, na passagem copiada, no snapshot
de transição de cuidados e na impressão.

O sistema apoia a organização do caso. Não substitui avaliação médica,
evolução, prescrição, prontuário institucional ou julgamento clínico.

## Superfícies conhecidas

- `index.html`: entrada do projeto.
- `passagem.html`: passagem de plantão e Clinical Copilot.
- `hub_uti.html`: área relacionada ao HUB UTI.
- `area_administrativa.html`: área administrativa.

Antes de modificar qualquer uma delas, confirme as relações de navegação e
persistência no código atual.

## Clinical Copilot

O primeiro módulo de referência do framework é o Assistente de Arritmias.
Ele estabelece padrões que deverão ser reutilizáveis nos próximos módulos:

- seleção progressiva;
- avaliação estruturada;
- Auto Save;
- Auto Advance;
- visualização somente leitura;
- edição deliberada;
- resumo compacto no card;
- estados clínicos e de conclusão;
- comportamento responsivo.

O Resumo Assistencial atualmente consolida, quando selecionados:

- Arritmias;
- Profilaxia de TEV;
- Antimicrobianos.

O Assistente de Profilaxia de TEV é considerado homologado na V1. Os demais
módulos do catálogo não devem ser declarados homologados sem evidência.

Módulos futuros ou em evolução incluem, entre outros, SCA, AVC, TEP, Sepse,
insuficiência cardíaca, lesão renal, cirrose, paliativos e anticoagulação.

## Arquitetura atual — V1/DEV

A aplicação atual é essencialmente estática. O artefato RC1.2.8 possui
1.259.660 bytes, 25.417 linhas, 104 blocos `<style>` e 60 blocos `<script>`,
incluindo scripts externos do Firebase Compat 10.12.5. `passagem.html`
concentra lógica clínica, persistência, renderização, responsividade e camadas
sucessivas de compatibilidade.

O estado principal é global. A persistência usa Firebase Auth anônimo e
Firestore quando disponíveis, com `localStorage` como fallback. A ordem dos
scripts, wrappers, observadores e temporizadores faz parte do comportamento
atual.

Esse desenho permitiu evolução rápida, mas aumenta o risco de:

- regras duplicadas ou sobrepostas;
- condições de corrida entre eventos e temporizadores;
- correções diferentes para mobile e desktop;
- dificuldade de localizar a fonte real de um estado;
- regressões distantes do ponto alterado;
- baixa reprodutibilidade dos testes.

Por isso, correções da V1 devem ser pequenas e caracterizadas por testes. A
modularização ampla pertence à Phoenix V2.

## Linhas de trabalho

### V1/DEV

- Continua sendo a referência funcional e o ambiente atualmente publicado.
- Recebe correções pequenas, isoladas e homologadas.
- Não deve ser reescrita impulsivamente.

### Phoenix V2

- Será desenvolvida em paralelo.
- Tem como objetivo modularizar interface, regras clínicas, estado,
  persistência e geração de resumos.
- Primeiro deve alcançar paridade com os comportamentos homologados.
- Só substituirá a V1 após homologação e rollback testado.

Consulte `docs/ROADMAP_PHOENIX.md`.

## Vocabulário do produto

- **Assistente Clínico:** módulo estruturado de apoio à coleta e organização
  de informações.
- **Clinical Copilot:** camada que consolida resultados dos assistentes.
- **Resumo Assistencial:** síntese exibida no card e nas superfícies de
  passagem de caso.
- **Recolhido:** módulo compacto.
- **Visualização:** leitura sem edição nem mutação dos dados.
- **Edição:** fluxo deliberadamente editável.
- **Homologado:** comportamento revisado e aprovado nos cenários definidos;
  não é sinônimo de simplesmente implementado.
