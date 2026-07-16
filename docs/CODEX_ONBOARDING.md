# Como abrir o Connect HUB no Codex

## 1. Autorizar o GitHub

O Codex precisa ter acesso ao código, e não apenas conseguir visualizar o
repositório público.

1. Abra o Codex e acesse as configurações de GitHub/Codex Cloud.
2. Instale ou reconecte o aplicativo GitHub para a conta
   `scaclinicamedica`.
3. Autorize o repositório `scaclinicamedica/Connect-HUB-DEV`.
4. Confirme que a integração pode criar branches, commits e pull requests.

Se o repositório puder ser lido, mas uma branch retornar `403 Resource not
accessible by integration`, a instalação ainda não possui acesso de escrita
ao conteúdo. Reinstale ou ajuste o acesso do aplicativo GitHub e selecione o
repositório novamente.

Documentação oficial:

- <https://learn.chatgpt.com/docs/cloud>
- <https://learn.chatgpt.com/docs/environments/cloud-environment>

## 2. Criar o ambiente

1. Abra <https://chatgpt.com/codex/settings/environments>.
2. Crie um ambiente para `scaclinicamedica/Connect-HUB-DEV`.
3. Use `main` como branch de referência, sem trabalhar diretamente nela.
4. Neste primeiro momento, não configure script de build: a V1 é estática e
   o repositório ainda não possui dependências padronizadas.
5. Mantenha as permissões padrão até uma necessidade concreta aparecer.

## 3. Primeiro prompt

Use:

> Abra o repositório `scaclinicamedica/Connect-HUB-DEV`. Leia integralmente
> `AGENTS.md`, `docs/PROJECT_CONTEXT.md`, `docs/CURRENT_STATE.md` e
> `docs/QA_CHECKLIST.md`. Não altere a `main`. Primeiro faça um diagnóstico
> da arquitetura e confirme quais comportamentos homologados precisam ser
> preservados. Use apenas dados fictícios e não faça mudanças clínicas sem
> aprovação explícita.

## 4. Fluxo para cada tarefa

1. Descrever o objetivo e os prints relevantes.
2. Pedir ao Codex que planeje antes de editar quando a mudança for ampla.
3. Criar branch `agent/<descrição-curta>`.
4. Implementar a menor mudança coerente.
5. Executar `docs/QA_CHECKLIST.md`.
6. Revisar o diff e as evidências visuais.
7. Abrir PR de rascunho.
8. Homologar antes do merge.

## 5. Separação V1 e Phoenix

- Correções pequenas da versão publicada permanecem em branches da V1.
- Trabalhos da Phoenix usam branches próprias e preview separado.
- Nenhum trabalho da Phoenix deve alterar silenciosamente o site atual.
- A `main` só recebe mudanças aprovadas por PR.
