# Segurança do Firestore e acesso nominal — V1

Atualizado em: 25/07/2026

## Estado

`firestore.rules`, `firebase.json`, o login clínico nominal e o acesso
administrativo estão versionados nesta branch. Nada desta entrega foi
publicado no projeto Firebase nem no site em produção.

O merge permanece bloqueado até que contas e perfis institucionais sejam
provisionados e uma janela controlada permita ativar as Rules estritas e os
dois HTMLs clínicos em sequência. Este documento não contém e não deve receber
senhas, tokens, chaves privadas ou dados reais de pacientes.

## Identidade clínica nominal

O HUB (`index.html`) e a Passagem (`passagem.html`) usam o app Firebase padrão
e aceitam somente:

1. Firebase Authentication com provedor `password`;
2. sessão não anônima;
3. documento próprio `clinical_users/<uid>` exatamente neste formato:

   ```json
   {
     "schemaVersion": 1,
     "active": true,
     "role": "clinician",
     "displayName": "Dra. Nome Institucional",
     "email": "conta@instituicao.br"
   }
   ```

O e-mail do documento deve coincidir exatamente com o e-mail do token. Campos
extras, nome vazio, versão diferente, perfil inativo ou outro papel são
negados. O cliente pode apenas obter o próprio perfil; não pode listar,
criar, alterar nem excluir perfis.

O perfil é lido do servidor antes de qualquer consulta clínica e permanece
observado em tempo real. Desativação ou perda de permissão encerra a sessão,
remove listeners e limpa pacientes, metadados, formulários, impressão e
identidade da memória e do DOM. A persistência obrigatória é `SESSION`; não há
fallback clínico por `localStorage` quando Firebase ou autenticação falham.
Sessões anônimas antigas são rejeitadas e encerradas.

`displayName` identifica a conta autenticada. Ele não substitui o médico
responsável explicitamente confirmado em um Desfecho.

## Identidade administrativa

`area_administrativa.html` usa o app Firebase separado
`connect-hub-admin`, também com Email/Password e persistência `SESSION`. O
usuário precisa de:

```text
admin_users/<uid>
```

com um destes contratos:

```json
{ "active": true, "role": "admin" }
```

```json
{ "active": true, "role": "coordinator" }
```

O cliente pode obter apenas o próprio perfil administrativo. Provisionamento,
desativação e mudança de papel exigem Firebase Console, Admin SDK ou outra
ferramenta privilegiada. Login e logout administrativo não substituem a
sessão clínica, e o inverso também é verdadeiro.

Se a mesma pessoa precisar dos dois conjuntos de permissões, provisione
`clinical_users/<uid>` e `admin_users/<uid>` para o mesmo UID.

## Matriz de permissões

| Operação | Clínico nominal ativo | Admin/coordenador ativo | Anônimo/sem perfil |
|---|---:|---:|---:|
| Ler pacientes ativos | Sim | Sim | Não |
| Criar/alterar pacientes | Sim | Não | Não |
| Excluir paciente isoladamente | Não | Não | Não |
| Ler/gravar metadados do plantão | Sim | Não | Não |
| Criar/ler confirmação | Sim | Não | Não |
| Alterar/excluir confirmação | Não | Não | Não |
| Criar Desfecho atômico | Sim | Não | Não |
| Obter lápide conhecida | Sim | Sim | Não |
| Listar lápides | Não | Sim | Não |
| Ler `historico_eventos` | Não | Sim | Não |
| Ler `admin_outcomes` | Não | Sim | Não |
| Alterar histórico/projeção/lápide | Não | Não | Não |

Todos os clínicos autorizados ainda acessam todos os setores conhecidos. A
segregação por setor pertence a uma etapa futura porque HUB, migrações e
indicadores dependem hoje dessa visão global.

## Desfecho atômico

O encerramento envolve quatro documentos:

| Documento | Finalidade | Conteúdo sensível |
|---|---|---|
| `connect_hub_v55/<setor>/pacientes/<patientId>` | Paciente ativo, removido no Desfecho | Sim |
| `connect_hub_v55/<setor>/closed_patients/<patientId>` | Lápide mínima contra ressurreição | Não deve conter dados clínicos ou nominais |
| `historico_eventos/<outcomeId>` | Histórico privado e imutável | Sim, inclusive `patientSnapshot` |
| `admin_outcomes/<outcomeId>` | Projeção administrativa mínima e imutável | Apenas campos administrativos explícitos |

As Rules aceitam o Desfecho somente quando o mesmo commit:

1. cria o evento privado válido;
2. cria a projeção administrativa correspondente;
3. cria a lápide correspondente;
4. exclui o paciente ativo do mesmo setor.

As quatro partes precisam concordar em identificadores, tipo e UID nominal.
Evento, projeção e lápide são imutáveis. Criação de paciente verifica lápides
nos sete setores conhecidos para impedir ressurreição após encerramento.

Confirmações e eventos comuns de criação, edição, migração, remanejamento e
contra-fluxo também vinculam `actorUid` ao UID nominal. O profissional
autenticado continua podendo alterar campos clínicos livres de um paciente;
autenticação nominal não equivale a validação campo a campo do conteúdo.

## Área Administrativa

O painel valida `admin_users/<uid>` antes de consultar qualquer paciente ou
histórico. Ele:

- permanece somente leitura;
- limpa memória, gráficos, tabelas e relatórios ao sair ou perder acesso;
- bloqueia relatório/exportação se o histórico falhar ou ultrapassar 5.000
  registros;
- escapa conteúdo persistido antes de renderizá-lo;
- fixa Chart.js e XLSX com versão e SRI;
- consulta somente `admin_outcomes` na aba Desfechos;
- usa `createdAt` do servidor convertido para `America/Sao_Paulo`.

O evento privado e seu `patientSnapshot` não trafegam para a aba Desfechos.

## Provisionamento

Execute com uma conta autorizada no projeto Firebase. Não copie credenciais
para repositório, PR, terminal compartilhado ou documentação.

1. Habilite **Email/Password** no Firebase Authentication.
2. Crie uma conta individual para cada profissional clínico.
3. Crie o `clinical_users/<uid>` exato para cada conta.
4. Crie contas administrativas necessárias e os respectivos
   `admin_users/<uid>`.
5. Se um usuário acumular funções, use o mesmo UID nos dois documentos.
6. Verifique que nenhuma senha foi incluída em HTML, fixture ou documentação.
7. Registre a release atual das Rules e o commit publicado para rollback.

Mudança de e-mail no Authentication exige atualizar o e-mail correspondente
em `clinical_users/<uid>`; até essa sincronização, o acesso clínico será
negado.

## Validação antes da janela

Na raiz:

```bash
npm ci
npm run test:rules
npm test
npm run test:print
npm run test:stability
npm run verify:integrity
```

O Emulator desta branch exige Java 21 ou superior. Os testes usam somente o
projeto de demonstração `demo-connect-hub-rules`.

## Publicação controlada

As Rules estritas e os HTMLs nominais não são retrocompatíveis com abas
anônimas antigas. Use uma janela curta e comunicada:

1. Confirme contas e perfis com dados fictícios/controlados.
2. Oriente usuários a concluir gravações e fechar abas antigas.
3. Publique as Rules estritas:

   ```bash
   npx firebase deploy --only firestore:rules \
     --project passagem-de-plantao-1746c
   ```

4. Confirme no Firebase Console que a release correta está ativa.
5. Publique imediatamente `index.html` e `passagem.html` nominais.
6. Execute o smoke test abaixo.
7. Desabilite o provedor Anonymous no Authentication. Tokens anônimos já
   emitidos continuam sendo negados pelas Rules.
8. Registre horário, commit, release das Rules e resultado do smoke test.

Rules-first causa uma indisponibilidade clínica curta, porém segura: abas
antigas falham fechadas até o novo HTML entrar. Não publique o HTML nominal
mantendo permissões anônimas por um intervalo aberto.

## Smoke test após publicação

Use somente registros fictícios em ambiente controlado:

- [ ] tela deslogada não consulta pacientes, metadados ou confirmações;
- [ ] clínico nominal ativo entra no HUB e na Passagem;
- [ ] sessão anônima, conta sem perfil e perfil inativo são negados;
- [ ] desativar o perfil aberto encerra a sessão e limpa a tela;
- [ ] logout clínico limpa cards, formulário, metadados e listeners;
- [ ] logout clínico não encerra a sessão administrativa;
- [ ] admin e coordinator ativos carregam o painel;
- [ ] admin sem perfil clínico não realiza escrita clínica;
- [ ] Tratado cria as quatro partes e retira o ativo;
- [ ] Óbito sem CID é negado;
- [ ] update/delete de histórico, projeção ou lápide é negado;
- [ ] exclusão avulsa e recriação após Desfecho são negadas;
- [ ] migração válida e lote de pacientes continuam funcionando;
- [ ] confirmação pode ser criada e lida, mas não alterada;
- [ ] falha de permissão encerra a sessão sem carregar cache local.

Se qualquer item falhar, interrompa a publicação. Mantenha as Rules estritas
para não reabrir acesso anônimo, retire os HTMLs candidatos se necessário e
investigue em branch separada. Só restaure Rules permissivas mediante decisão
explícita de segurança e rollback integral.

## Testes automatizados

```bash
npm run test:rules
```

O arquivo `tests/firestore/firestore.rules.test.mjs` contém 27 cenários:

- perfil clínico próprio, exato e imutável;
- negação de não autenticado, anônimo, provedor diferente, perfil ausente,
  inativo, divergente ou malformado;
- separação e acúmulo explícito dos perfis clínico e administrativo;
- revogação do perfil na operação seguinte;
- Desfecho atômico e negação de combinações parciais;
- vínculo de `actorUid`/`closedByUid`;
- imutabilidade e bloqueio de ressurreição;
- pacientes ativos, migração e lote;
- eventos comuns nominais e confirmações imutáveis;
- preservação de leitura administrativa sem escrita clínica.

## Limitações residuais

- Todos os clínicos ativos acessam todos os setores.
- Pacientes ativos ainda não possuem validação campo a campo nas Rules.
- `patientSnapshot` não é comparado integralmente ao paciente anterior.
- `validOutcome` e eventos históricos antigos ainda aceitam alguns campos
  adicionais; um clínico autorizado pode usar cliente modificado.
- Autoria nominal identifica quem gravou o evento, mas não transforma a V1 em
  prontuário nem comprova clinicamente cada valor informado.

Esses itens não reabrem acesso público anônimo, mas devem orientar a próxima
etapa de menor privilégio e integridade.
