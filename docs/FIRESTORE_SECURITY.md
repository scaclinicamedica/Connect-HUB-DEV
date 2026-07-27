# Segurança do Firestore e acesso administrativo — V1

Atualizado em: 25/07/2026

## Estado

`firestore.rules` e `firebase.json` estão versionados e cobertos por testes no
Firestore Emulator. Nesta branch, eles ainda não foram publicados no projeto
Firebase. O merge que disponibiliza o novo fluxo de Desfecho deve permanecer
bloqueado até o acesso clínico anônimo do site público ser resolvido, a
configuração de Authentication e o cadastro administrativo serem concluídos e
o deploy das Rules ser validado.

Este documento não contém e não deve receber senhas, tokens, chaves privadas ou
outras credenciais.

## Modelo de dados protegido

O modelo protegido envolve os documentos abaixo. O Desfecho usa quatro
mutações atômicas; migrações entre setores usam o fato de transição:

| Documento | Finalidade | Conteúdo sensível |
|---|---|---|
| `connect_hub_v55/<setor>/pacientes/<patientId>` | Paciente ativo, removido no Desfecho | Sim |
| `connect_hub_v55/<setor>/closed_patients/<patientId>` | Lápide mínima contra ressurreição | Não deve conter dados clínicos ou nominais |
| `historico_eventos/<outcomeId>` | Histórico privado e imutável do Desfecho | Sim, inclusive `patientSnapshot` |
| `admin_outcomes/<outcomeId>` | Projeção administrativa mínima e imutável | Apenas campos administrativos explícitos |
| `admin_sector_transitions/<factId>` | Fato imutável de mudança entre setores | Identificadores técnicos, locais e timestamps |

A lápide possui somente versão do esquema, tipo, identificadores técnicos,
tipo do Desfecho, timestamp e UID da sessão que confirmou o encerramento. Ela
não contém nome, CID, diagnóstico, alertas nem snapshot. Nome e CID estruturado
também compõem a projeção administrativa mínima; diagnóstico, alertas brutos e
`patientSnapshot` permanecem exclusivos do evento privado.

## Operação atômica obrigatória

As Rules aceitam um Desfecho somente quando o mesmo commit:

1. cria um `patient_outcome` válido em `historico_eventos`;
2. cria a projeção `patient_outcome_admin` correspondente;
3. cria a lápide `patient_closed` correspondente;
4. exclui o paciente ativo do mesmo setor.

Evento, projeção, lápide ou exclusão isolados são negados. A correspondência
inclui `patientId`, `sectorUnit`, `outcomeId`, `outcomeType` e o UID autenticado
em `actorUid`/`closedByUid`. O `patientSnapshot` privado precisa ser idêntico ao
paciente autoritativo lido no commit. Evento, projeção e lápide não podem ser
atualizados nem excluídos depois do commit.

Uma nova criação de paciente consulta as lápides dos setores conhecidos. Se o
identificador já foi encerrado em qualquer um deles, a criação é negada. As
migrações válidas entre setores continuam sendo operações atômicas próprias e
não podem ser combinadas com um Desfecho. Cada migração entre setores também
precisa criar exatamente um fato `patient_sector_transition_admin` compatível
com a origem e o destino do paciente no mesmo commit. O fato isolado, a
migração sem fato e a alteração posterior do fato são negados.

Novos pacientes recebem tracking setorial v1 com origem `initial_entry` e
timestamp do servidor. Updates comuns podem preservar, mas não alterar, os
campos técnicos do episódio. A primeira migração de um ativo legado pode
iniciar `baseline_observation`; nenhuma outra operação pode promover um
paciente legado ou fabricar o tempo anterior.

## Perfis e permissões

| Operação | Clínico anônimo autenticado | Admin/coordenador ativo, não-anônimo |
|---|---:|---:|
| Ler e atualizar pacientes ativos | Sim | Sim |
| Criar paciente sem lápide prévia | Sim | Sim |
| Excluir paciente isoladamente | Não | Não |
| Criar Desfecho atômico | Sim | Sim |
| Consultar uma lápide conhecida por `get` | Sim | Sim |
| Listar lápides | Não | Sim |
| Ler/listar `historico_eventos` | Não | Sim |
| Ler/listar `admin_outcomes` | Não | Sim |
| Ler/listar `admin_sector_transitions` | Não | Sim |
| Alterar ou excluir histórico/lápide | Não | Não |
| Criar/alterar `admin_users` pelo cliente | Não | Não |
| Criar e ler confirmação de transição | Sim | Sim |
| Alterar/excluir confirmação de transição | Não | Não |

Um leitor administrativo precisa:

- ter autenticação Firebase não-anônima;
- possuir `admin_users/<uid>`;
- ter `active: true`;
- ter `role: "admin"` ou `role: "coordinator"`.

O próprio usuário pode ler apenas o seu documento `admin_users/<uid>`.
Provisionamento, desativação e mudança de papel exigem o Firebase Console ou
outra ferramenta privilegiada.

## Acesso da Área Administrativa

`area_administrativa.html` autentica por e-mail e senha e valida
`admin_users/<uid>` antes de consultar pacientes ou histórico. Não existe
código compartilhado de acesso, autorização em `sessionStorage` ou login
anônimo administrativo.

O painel inicializa o Firebase com o nome `connect-hub-admin` e persistência
`SESSION`. Essa separação impede que login ou logout administrativo substitua a
sessão anônima usada pelo HUB clínico na mesma origem. A interface também:

- limpa os dados administrativos ao sair ou perder autorização;
- não consulta pacientes quando o perfil está inativo ou possui outro papel;
- bloqueia relatório e exportação histórica quando a leitura falha ou excede
  o limite seguro;
- fixa Chart.js e XLSX em versões específicas com SRI;
- escapa conteúdo persistido antes de inseri-lo no HTML privilegiado.

O atalho da tela clínica leva ao login administrativo real e não contém mais
um código compartilhado para revelar o histórico. As confirmações de transição
de cuidados permanecem criáveis e legíveis por clientes autenticados, mas são
imutáveis: update e delete são negados.

Durante a publicação Rules-first, abas antigas ainda podem criar o contrato
legado de confirmação. Essa compatibilidade é fechada por lista exata de
campos, tipos e timestamp do servidor; não permite campos arbitrários. Ela deve
ser removida em uma release futura depois de expirar o cache da versão antiga.

O painel administrativo permanece somente leitura no cliente. A aba
`Desfechos` consulta `admin_outcomes`, uma projeção materializada sem
`patientSnapshot`, diagnóstico, alertas ou estado clínico, e
`admin_sector_transitions`, contendo apenas os fatos administrativos mínimos
necessários para reconstruir intervalos setoriais.
O histórico geral exclui `patient_outcome` na consulta do servidor. Período,
ordenação, auditoria e permanência usam o timestamp de servidor convertido
para `America/Sao_Paulo`; dados locais do navegador não participam das
métricas.

## Pré-requisitos de publicação

Execute estas etapas com uma conta autorizada no projeto Firebase. Não copie
credenciais para o repositório, PR, terminal compartilhado ou documentação.

1. Resolva o acesso clínico anônimo no site público: implemente autenticação
   clínica nominal ou comprove uma barreira institucional que impeça acesso
   externo. Sem isso, não prossiga com a publicação.
2. Em Firebase Authentication, habilite o provedor **Email/Password**.
3. Crie a conta institucional que terá acesso ao painel.
4. Copie o UID gerado pelo Authentication.
5. Pelo Firebase Console ou ambiente administrativo privilegiado, crie:

   ```text
   admin_users/<uid>
   ```

   com um dos contratos:

   ```json
   { "active": true, "role": "admin" }
   ```

   ```json
   { "active": true, "role": "coordinator" }
   ```

6. Registre qual release de Rules está publicada atualmente para permitir
   rollback operacional.
7. Na raiz do repositório, valide a versão candidata:

   ```bash
   npm ci
   npm run test:rules
   ```

   O Emulator desta branch exige Java 21 ou superior.

8. Bloqueie o uso clínico durante uma janela controlada. O cliente anterior
   cria projeções antigas, negadas pelas Rules finais, enquanto as Rules
   anteriores rejeitam o evento v2, a projeção v3 e os fatos setoriais do novo
   cliente.
9. Publique as Rules, apontando explicitamente para o projeto:

   ```bash
   npx firebase deploy --only firestore:rules \
     --project passagem-de-plantao-1746c
   ```

10. Confirme no Firebase Console que a nova release está ativa e publique
    imediatamente os HTMLs do mesmo candidato.
11. Execute o smoke test abaixo antes de reabrir o uso.

Não existe ordem de publicação compatível com uso simultâneo: o cliente antigo
e as Rules finais discordam sobre os esquemas aceitos, e o cliente novo e as
Rules anteriores discordam sobre evento v2, projeção v3 e fatos setoriais. A
janela deve impedir novas criações, migrações e Desfechos até Rules e HTML
coincidirem. Em rollback, reverta os dois artefatos antes de reabrir o uso.

## Smoke test após o deploy

Use somente registros fictícios em ambiente controlado:

- [ ] conta `admin` ativa entra e carrega o painel;
- [ ] conta `coordinator` ativa entra e carrega o painel;
- [ ] conta ausente, inativa ou com outro papel recebe acesso negado antes de
      consultar pacientes;
- [ ] cliente clínico anônimo não consegue ler nem listar
      `historico_eventos`;
- [ ] cliente clínico consegue consultar por `get` a lápide conhecida;
- [ ] Alta médica cria histórico + projeção mínima + lápide e retira o ativo em um
      único commit;
- [ ] o evento criado usa esquema 2, a projeção usa esquema 3 e o booleano
      Paliativo é igual ao paciente autoritativo;
- [ ] Alta médica, Óbito ou Transferência externa sem CID são negados;
- [ ] update/delete de histórico ou lápide é negado;
- [ ] exclusão avulsa de paciente é negada;
- [ ] recriação do mesmo `patientId` após Desfecho é negada, inclusive em
      outro setor;
- [ ] migração válida e atualizações em lote continuam funcionando;
- [ ] migração entre setores sem fato, fato sem migração e fato divergente são
      negados; a migração válida cria ambos atomicamente;
- [ ] remanejamento interno não cria fato nem altera o início do setor;
- [ ] confirmação de transição pode ser criada e lida, mas não alterada nem
      apagada;
- [ ] logout administrativo não encerra a sessão clínica da aplicação.

Se qualquer item falhar, não publique os HTMLs. Reative a release anterior de
Rules pelo mecanismo de releases do Firebase e investigue em uma branch
separada; não amplie permissões de forma genérica para contornar o erro.

## Testes automatizados

O comando oficial é:

```bash
npm run test:rules
```

Ele inicia o Firestore Emulator e executa os cenários descobertos em
`tests/firestore/firestore.rules.test.mjs`. A cobertura inclui:

- operação de Desfecho com quatro mutações e negação de combinações parciais;
- vínculo de `actorUid` e `closedByUid` ao usuário autenticado;
- obrigatoriedade de médico e CID nos três Desfechos;
- imutabilidade de histórico, projeção administrativa e lápides;
- bloqueio de ressurreição no mesmo setor e entre setores;
- separação entre leitura clínica e administrativa;
- perfis administrativo, coordenador, inativo e anônimo;
- preservação de pacientes ativos, migração e atualização em lote;
- negação de delete avulso;
- compatibilidade imutável dos eventos legados reconhecidos;
- reserva do identificador determinístico de Desfecho;
- imutabilidade das confirmações de transição de cuidados.
- compatibilidade estrita da confirmação legada durante a janela Rules-first.
- leitura administrativa de projeções v1/v2 históricas, negação de novas
  projeções antigas e consistência do booleano Paliativo na v3;
- tracking v1 na criação, preservação em updates comuns, bootstrap legado
  restrito à migração e envelope zero no Desfecho sem rastreamento;
- fato setorial obrigatório e atômico na migração, cadeia consistente,
  imutabilidade, versão exata e separação da leitura clínica/administrativa;
- snapshot clínico integral vinculado ao paciente autoritativo e rejeição de
  alteração isolada em campo não administrativo.

## Limitação residual

Os clientes clínicos continuam autenticados anonimamente para preservar a
compatibilidade da V1. Como a aplicação está em GitHub Pages público, qualquer
visitante capaz de iniciar uma sessão anônima recebe as permissões clínicas
atuais de leitura, gravação e Desfecho. O UID identifica somente a sessão
Firebase, não o profissional. Por isso, essa condição é um bloqueador de nova
publicação em produção, salvo se houver uma barreira institucional externa
comprovada.

Autoria clínica nominal, menor privilégio por setor e validação campo a campo
exigem uma etapa posterior com autenticação clínica real, matriz de papéis e
migração controlada dos clientes existentes.
