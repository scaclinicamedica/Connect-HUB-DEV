# Segurança do Firestore, acesso nominal e gestão de usuários — V1

Atualizado em: 25/07/2026

## Estado

`firestore.rules`, `firebase.json`, o login clínico nominal e o acesso
administrativo estão versionados nesta branch. Nada desta entrega foi
publicado no projeto Firebase nem no site em produção.

O merge permanece bloqueado até que o primeiro Gestor seja provisionado, os
métodos Email/Password e Email Link e a entrega de e-mail sejam verificados, e
uma janela controlada permita ativar as Rules estritas e os HTMLs em sequência.
Este documento não contém e não deve receber senhas, tokens, URLs de ação,
chaves privadas, o e-mail real do Gestor ou dados reais de pacientes.

## Identidade clínica nominal

O HUB (`index.html`) e a Passagem (`passagem.html`) usam o app Firebase padrão
e aceitam somente:

1. Firebase Authentication com provedor `password`;
2. sessão não anônima;
3. e-mail verificado no token;
4. documento próprio `clinical_users/<uid>` ativo e com e-mail idêntico ao
   token.

O perfil bootstrap legado, criado apenas por uma ferramenta privilegiada,
permanece compatível:

   ```json
   {
     "schemaVersion": 1,
     "active": true,
     "role": "clinician",
     "displayName": "Dra. Nome Autorizado",
     "email": "conta@example.org"
   }
   ```

Os médicos convidados recebem um perfil gerenciado v2:

```json
{
  "schemaVersion": 2,
  "active": true,
  "role": "clinician",
  "displayName": "Dra. Nome Autorizado",
  "email": "conta@example.org",
  "createdAt": "<server timestamp>",
  "createdByUid": "<uid do Gestor>",
  "updatedAt": "<server timestamp>",
  "updatedByUid": "<uid do médico>",
  "revision": 1,
  "inviteId": "invite_<32 hex>",
  "lastAccessEventId": "access_<32 hex>"
}
```

Campos extras, nome vazio, versão desconhecida, perfil inativo ou outro papel
são negados. O clínico pode obter somente o próprio perfil. O Gestor pode
listar e alterar apenas nome ou estado ativo dos perfis v2, sempre com revisão
e auditoria atômicas. Perfis v1 são imutáveis no navegador.

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
`connect-hub-admin`, também com Email/Password, e-mail verificado e
persistência `SESSION`. O usuário precisa de:

```text
admin_users/<uid>
```

com o contrato exato:

```json
{
  "schemaVersion": 1,
  "active": true,
  "role": "admin",
  "displayName": "Nome do Gestor",
  "email": "gestor@example.org"
}
```

`role` também pode ser `coordinator`. O Gestor (`admin`) acessa a aba Usuários;
o Coordenador permanece somente leitura no painel e não consulta
`clinical_users`, `clinical_invites` nem `access_audit`. Provisionamento,
desativação e mudança de papel administrativo exigem Firebase Console, Admin
SDK ou outra ferramenta privilegiada. Login e logout administrativo não
substituem a sessão clínica, e o inverso também é verdadeiro.

Se a mesma pessoa precisar dos dois conjuntos de permissões, provisione
`clinical_users/<uid>` e `admin_users/<uid>` para o mesmo UID.

## Matriz de permissões

| Operação | Médico | Gestor | Coordenador | Sem perfil |
|---|---:|---:|---:|---:|
| Ler pacientes ativos | Sim | Sim | Sim | Não |
| Criar/alterar pacientes | Sim | Não | Não | Não |
| Excluir paciente isoladamente | Não | Não | Não | Não |
| Ler/gravar metadados do plantão | Sim | Não | Não | Não |
| Criar/ler confirmação | Sim | Não | Não | Não |
| Criar Desfecho atômico | Sim | Não | Não | Não |
| Ler histórico e projeção administrativa | Não | Sim | Sim | Não |
| Listar perfis, convites e auditoria de acesso | Não | Sim | Não | Não |
| Criar/revogar convite e enviar/reenviar Email Link | Não | Sim | Não | Não |
| Renomear/ativar/desativar perfil v2 | Não | Sim | Não | Não |
| Alterar perfil v1 ou `admin_users` | Não | Não | Não | Não |
| Excluir convite, perfil ou auditoria | Não | Não | Não | Não |

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

O painel valida credencial Password verificada, claims do token e
`admin_users/<uid>` antes de consultar qualquer paciente ou histórico. Ele:

- mantém os painéis clínico-administrativos somente leitura;
- libera a aba Usuários somente para o Gestor;
- gera IDs de convite e auditoria com 128 bits aleatórios;
- aceita qualquer domínio de e-mail sintaticamente válido; não existe
  allowlist institucional nesta etapa;
- cria, revoga e altera acesso somente em mutações atômicas auditadas;
- envia e reenvia o Firebase Email Link diretamente para a caixa postal
  cadastrada, sem revelar a URL de ação;
- nunca solicita, armazena ou exibe senhas;
- limpa memória, gráficos, tabelas e relatórios ao sair ou perder acesso;
- bloqueia relatório/exportação se o histórico falhar ou ultrapassar 5.000
  registros;
- escapa conteúdo persistido antes de renderizá-lo;
- fixa Chart.js e XLSX com versão e SRI;
- consulta somente `admin_outcomes` na aba Desfechos;
- usa `createdAt` do servidor convertido para `America/Sao_Paulo`.

O evento privado e seu `patientSnapshot` não trafegam para a aba Desfechos.

## Convite e ativação no plano gratuito

A gestão inicial permanece no Firebase Spark e não exige Cloud Functions:

1. o Gestor informa nome e e-mail exato;
2. o navegador cria `clinical_invites/<inviteId>` e
   `access_audit/<eventId>` no mesmo batch;
3. a Área Administrativa chama `sendSignInLinkToEmail` para o e-mail exato,
   com retorno para `cadastro.html#invite=invite_<32hex>`;
4. a URL de ação nunca é exibida pela interface; o Firebase entrega o Email
   Link diretamente à caixa postal definida pelo Gestor;
5. `cadastro.html` só prossegue se `isSignInWithEmailLink` reconhecer a URL
   recebida e o fragmento corresponder exatamente a
   `#invite=invite_<32hex>`. Sem qualquer uma dessas condições, a tela falha
   fechada;
6. o médico redigita o mesmo e-mail. Ele nunca é colocado na URL nem em
   `localStorage`, evitando injeção de sessão;
7. `signInWithEmailLink` confirma a posse da caixa postal antes de qualquer
   etapa de senha;
8. o cadastro exige `additionalUserInfo.isNewUser === true`. Se o Firebase
   indicar uma conta preexistente, a tela executa `signOut`, orienta procurar
   o Gestor e não oferece claim, login ou redefinição de senha;
9. somente a conta comprovadamente nova define a própria senha;
10. a tela encerra a sessão Email Link, entra novamente por Password, força
   token novo e confere UID/e-mail;
11. nenhuma leitura Firestore ocorre antes dessa reautenticação Password;
12. o médico reivindica o convite em uma transação que atualiza o
   convite, cria `clinical_users/<uid>` v2 e cria a auditoria;
13. convite expirado, revogado, de outro e-mail ou já usado por outro UID é
   negado.

O `oobCode`, os demais parâmetros da ação e o fragmento são removidos do
endereço imediatamente após a captura inicial, antes de qualquer espera
assíncrona. A sequência segue as recomendações
oficiais de [autenticação por Email Link no
Firebase](https://firebase.google.com/docs/auth/web/email-link-auth).

Uma conta Firebase preexistente nunca pode reivindicar convite por
`cadastro.html`. Essa restrição evita que um token antigo do mesmo UID herde
um novo perfil clínico. A recuperação de falha parcial fica disponível
somente na mesma navegação em que `isNewUser === true` foi comprovado. Depois
de recarregar a página, o Gestor deve revisar e remover a conta órfã no
Firebase Console, revogar o convite anterior e emitir um novo.

O convite vale 72 horas. A Área Administrativa não disponibiliza a URL de
ação. As Rules não garantem unicidade global de convites pendentes por e-mail;
se houver duplicata, somente a primeira reivindicação que conseguir criar o
perfil daquele UID vence. O Gestor deve revogar convites redundantes.

No plano Spark, a cota atual é de **5 e-mails de Email Link por dia**. O
Gestor é o único papel que inicia o envio ou reenvio pela aplicação, e cada
operação consome a cota. Como os acessos seguintes usam senha, a V1 pode
permanecer gratuita dentro desse limite diário. Acima disso será necessário
habilitar faturamento ou migrar a ativação para um backend. Consulte os
[limites oficiais do Firebase
Authentication](https://firebase.google.com/docs/auth/limits).

Desativar o perfil clínico interrompe o acesso em tempo real, mas não exclui a
conta do Firebase Authentication. Redefinição de senha usa resposta genérica.
Exclusão rotineira de contas ativadas permanece fora da V1 para preservar
auditoria. A remoção manual de uma conta órfã, sem perfil e resultante de
falha parcial no cadastro, é a exceção operacional descrita acima e ocorre
somente no Firebase Console.

## Provisionamento

Execute com uma conta autorizada no projeto Firebase. Não copie credenciais
para repositório, PR, terminal compartilhado ou documentação.

1. Habilite **Email/Password** e **Email Link (passwordless sign-in)** no
   Firebase Authentication.
2. Confirme `scaclinicamedica.github.io` como domínio autorizado para servir
   `cadastro.html` e valide o envio e o reenvio de Email Link pela Área
   Administrativa, além da redefinição de senha.
3. Ative proteção contra enumeração de e-mail e uma política de senha
   compatível com os requisitos exibidos no cadastro.
4. Antes do corte, revise Authentication e desative contas Password verificadas
   que não correspondam ao primeiro Gestor ou a um perfil aprovado.
5. Crie manualmente somente a primeira conta do Gestor, confirme seu e-mail e
   anote o UID sem registrar o e-mail real ou a senha em nenhum artefato do
   repositório.
6. Para o mesmo UID, crie um `clinical_users/<uid>` v1 exato e um
   `admin_users/<uid>` v1 exato com papel `admin`.
7. Se houver Coordenador, crie apenas o perfil administrativo necessário e
   use `role: "coordinator"`.
8. Depois da publicação, crie os médicos exclusivamente pela aba Usuários,
   que envia o Email Link diretamente à caixa postal cadastrada.
9. Verifique que nenhum e-mail real do Gestor, senha, URL de ação ou `oobCode`
   foi incluído em HTML, fixture, documentação, issue ou PR.
10. Registre a release atual das Rules e o commit publicado para rollback.

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

1. Confirme o primeiro Gestor e uma caixa postal de teste com dados
   fictícios/controlados.
2. Oriente usuários a concluir gravações e fechar abas antigas.
3. Publique as Rules estritas:

   ```bash
   npx firebase deploy --only firestore:rules \
     --project passagem-de-plantao-1746c
   ```

4. Confirme no Firebase Console que a release correta está ativa.
5. Publique imediatamente `index.html`, `passagem.html`, `cadastro.html` e
   `area_administrativa.html`.
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
- [ ] e-mail não verificado e provedor diferente de Password não leem
  Firestore;
- [ ] clínico nominal ativo entra no HUB e na Passagem;
- [ ] sessão anônima, conta sem perfil e perfil inativo são negados;
- [ ] desativar o perfil aberto encerra a sessão e limpa a tela;
- [ ] logout clínico limpa cards, formulário, metadados e listeners;
- [ ] logout clínico não encerra a sessão administrativa;
- [ ] admin e coordinator ativos carregam o painel;
- [ ] somente Gestor vê a aba Usuários;
- [ ] Coordenador não consulta perfis clínicos, convites nem auditoria;
- [ ] Gestor cria o convite e a Área Administrativa envia o Email Link
  diretamente à caixa postal cadastrada, sem exibir a URL de ação;
- [ ] reenvio é iniciado somente pelo Gestor e consome novamente a cota Spark;
- [ ] `cadastro.html` falha fechado sem um Firebase Email Link válido e o
  fragmento canônico `#invite=invite_<32hex>`;
- [ ] o médico redigita o mesmo e-mail antes de `signInWithEmailLink`, e os
  parâmetros de ação são removidos do endereço antes de qualquer espera
  assíncrona;
- [ ] `additionalUserInfo.isNewUser !== true` encerra a sessão, orienta
  procurar o Gestor e não oferece claim, login ou redefinição de senha;
- [ ] somente conta comprovadamente nova define senha depois de
  `signInWithEmailLink`;
- [ ] falha parcial só pode ser retomada na mesma navegação após
  `isNewUser === true`; depois de recarregar, o Gestor revisa/remove a conta
  órfã no Firebase Console, revoga o convite anterior e emite outro;
- [ ] nenhuma leitura ocorre antes de `signInWithEmailLink`, senha e
  reautenticação Password;
- [ ] após reautenticação, o claim cria perfil v2, marca convite como usado e
  grava auditoria no mesmo commit;
- [ ] convite expirado, revogado, de outro e-mail ou reutilizado é negado;
- [ ] desativar perfil encerra a sessão clínica aberta;
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

O arquivo `tests/firestore/firestore.rules.test.mjs` contém 46 cenários:

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
- schema administrativo exato e e-mail verificado;
- separação entre Gestor e Coordenador nas coleções de gestão;
- criação, revogação e claim de convite com auditoria atômica;
- concorrência de claim, expiração, e-mail divergente e IDs inválidos;
- alteração controlada de perfis v2 e imutabilidade de perfis v1;
- imutabilidade de convites e auditoria.

## Limitações residuais

- Todos os clínicos ativos acessam todos os setores.
- As Rules não impõem unicidade global de convite pendente por e-mail.
- A interface V1 desativa perfis e não exclui contas do Authentication; conta
  órfã de falha parcial é revisada e removida manualmente no Firebase Console.
- Mesmo com o envio exposto somente ao Gestor na interface, os endpoints
  públicos do Authentication ainda podem receber tentativas que consumam
  quota. Email Link impede que isso conceda acesso clínico sem posse da caixa
  postal; enumeração, quotas e monitoramento continuam gates operacionais.
- O plano Spark envia no máximo cinco Email Links por dia. O primeiro envio e
  cada reenvio consomem essa mesma capacidade diária da V1 gratuita.
- Email Link e senha pertencem ao provedor Firebase `password`; as Rules não
  distinguem as duas etapas. O cadastro força a sequência no cliente, exige
  `additionalUserInfo.isNewUser === true` e bloqueia contas preexistentes; o
  corte exige inventário prévio das contas verificadas. Criação estritamente
  administrativa no Authentication e revogação global imediata exigem backend
  privilegiado em uma etapa futura.
- Pacientes ativos ainda não possuem validação campo a campo nas Rules.
- `patientSnapshot` não é comparado integralmente ao paciente anterior.
- `validOutcome` e eventos históricos antigos ainda aceitam alguns campos
  adicionais; um clínico autorizado pode usar cliente modificado.
- Autoria nominal identifica quem gravou o evento, mas não transforma a V1 em
  prontuário nem comprova clinicamente cada valor informado.

Esses itens não reabrem acesso público anônimo, mas devem orientar a próxima
etapa de menor privilégio e integridade.
