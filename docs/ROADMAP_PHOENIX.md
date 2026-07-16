# Roadmap — Phoenix V2

## Objetivo

Construir uma versão modular do Connect HUB que preserve os comportamentos
clínicos e operacionais homologados, reduza a dependência do arquivo
monolítico `passagem.html` e permita evoluções mais seguras e testáveis.

A Phoenix será desenvolvida em paralelo e não substituirá automaticamente:

`https://scaclinicamedica.github.io/Connect-HUB-DEV/`

## Estado de partida

- A V1/DEV permanece como referência funcional.
- Arritmias é o módulo de referência atual.
- Profilaxia de TEV está homologada na V1.
- Existe uma primeira entrega Foundation Alpha ainda não executada e validada
  localmente.
- Mobile e desktop precisam ser homologados separadamente.

A confirmar:

- localização e integridade da Foundation Alpha;
- baseline formal da migração;
- repositório, pasta ou branch definitiva da Phoenix;
- mecanismo e endereço de preview;
- regra atual de publicação do GitHub Pages.

## Princípios

1. Preservar lógica e linguagem clínica durante a reorganização técnica.
2. Migrar incrementalmente, módulo por módulo.
3. Separar regras clínicas, estado, interface, persistência e resumo.
4. Definir um contrato comum para os assistentes clínicos.
5. Versionar formatos de dados e oferecer migração/rollback.
6. Alcançar paridade antes de introduzir melhorias.
7. Validar responsividade em computador, tablet e celular.
8. Rastrear decisões por documentação, issues, branches e PRs.
9. Usar somente dados fictícios em testes.
10. Manter retorno rápido à versão estável.

## Contrato mínimo de um assistente

Cada módulo deverá expor de forma padronizada:

- identificação;
- estado da avaliação e etapa atual;
- dados clínicos registrados;
- resumo assistencial;
- estado de conclusão;
- ações de visualizar, editar, recolher e retomar;
- versão do schema de dados.

## Fases

### Fase 0 — Baseline

- inventariar arquitetura, persistência e pontos de entrada;
- registrar fluxos homologados e problemas conhecidos;
- criar matriz de paridade e dados fictícios reproduzíveis;
- incorporar testes de caracterização essenciais.

### Fase 1 — Foundation Alpha

- localizar, executar e documentar o pacote existente;
- comparar sua arquitetura com a V1 atual;
- classificar o que será aproveitado, ajustado ou descartado;
- não incorporar nada à `main` nesta fase.

### Fase 2 — Fundação modular

- criar shell da aplicação e componentes compartilhados;
- definir contrato de estado e resumo dos assistentes;
- isolar persistência e navegação;
- implantar testes e preview separado.

### Fase 3 — Primeiro módulo

- migrar Arritmias sem alterar a lógica clínica;
- reproduzir seleção, Auto Save, Auto Advance, edição, visualização,
  recolhimento e resumo no card;
- comparar V1 e Phoenix pela matriz de paridade.

### Fase 4 — Segundo módulo

- migrar Profilaxia de TEV para validar que o framework é reutilizável;
- remover dependências específicas de Arritmias;
- documentar como criar um novo módulo.

### Fase 5 — Compatibilidade de dados

- identificar o formato atual dos pacientes;
- definir schema versionado;
- testar registros antigos, incompletos e parcialmente editados;
- impedir perda silenciosa e documentar rollback.

### Fase 6 — Homologação paralela

- publicar preview separado;
- executar casos fictícios equivalentes na V1 e Phoenix;
- validar resumos e fluxos em computador, tablet e celular;
- encerrar divergências críticas sem desativar a V1.

### Fase 7 — Promoção controlada

- criar release candidata;
- executar checklist completo;
- registrar aprovação técnica, visual e clínica;
- criar tag recuperável da V1;
- testar rollback;
- promover somente após autorização explícita.

## Critérios para substituir a V1

- módulos previstos para a primeira release homologados;
- paridade funcional documentada;
- dados compatíveis ou migráveis;
- desktop e mobile aprovados;
- rollback testado;
- nenhuma divergência clínica crítica aberta;
- aprovação explícita para publicação.

## Decisões ainda não tomadas

Não definir silenciosamente:

- framework ou biblioteca;
- JavaScript, TypeScript ou outro stack;
- mesmo repositório ou repositório independente;
- backend, autenticação e perfis de acesso;
- armazenamento local, remoto ou híbrido;
- sincronização, funcionamento offline e migração de pacientes;
- requisitos institucionais, LGPD, auditoria e retenção;
- navegadores e dispositivos oficialmente suportados;
- responsáveis finais por homologação;
- data de substituição da V1.
