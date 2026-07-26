# Desfecho do paciente — V1

Atualizado em: 25/07/2026

## Objetivo

Encerrar a participação de um paciente no HUB sem apagar definitivamente os
dados clínicos registrados. O Desfecho substitui a antiga ação `Excluir` nos
cards e no drawer de edição.

Esta entrega cria a fonte histórica e a visão correspondente na Área
Administrativa. O painel só apresenta os indicadores de Desfechos depois de
autenticação e autorização reais.

## Opções homologadas

| Código persistido | Rótulo |
|---|---|
| `treated` | Tratado |
| `death` | Óbito |
| `transferred` | Transferido |

Não existem outras opções nesta versão.

O CID principal é obrigatório somente para `death`. O médico responsável pelo
desfecho é obrigatório em todos os casos e deve ser confirmado explicitamente
pelo usuário. Um nome previamente registrado no campo de check-out pode ser
usado apenas como sugestão editável.

## Comportamento

- Abrir, navegar ou cancelar o modal não cria um Desfecho.
- A confirmação apresenta `Encerrando atendimento...` e bloqueia repetição.
- O paciente continua visível enquanto a persistência não foi confirmada.
- Se a operação falhar, o paciente permanece no HUB e o modal permite tentar
  novamente.
- O autosave pendente é coordenado antes do encerramento para impedir que uma
  escrita tardia recrie o paciente.
- Uma alteração pendente do alerta estruturado `Paliativo` é confirmada antes
  da abertura do modal; se a gravação não puder ser comprovada, o Desfecho não
  é liberado.
- O snapshot incorpora o formulário atual quando o Desfecho é iniciado pelo
  drawer.

## Persistência Firebase

O Desfecho separa o marcador operacional mínimo do histórico clínico privado:

```text
connect_hub_v55/<sectorUnit>/closed_patients/<patientId>
historico_eventos/<outcomeId>
admin_outcomes/<outcomeId>
connect_hub_v55/<sectorUnit>/pacientes/<patientId>
```

O primeiro documento é uma lápide mínima com `type: "patient_closed"`. Ele não
contém nome, diagnóstico, CID, alertas nem `patientSnapshot` e pode ser lido por
um cliente clínico autenticado somente por `get`, para impedir uma gravação
tardia. O segundo documento é o evento privado `patient_outcome`, com o
snapshot clínico integral. O terceiro é a projeção administrativa mínima
`patient_outcome_admin`, sem snapshot ou estado clínico.

A confirmação executa quatro mutações na mesma transação atômica:

1. cria o evento privado em `historico_eventos`;
2. cria a projeção mínima em `admin_outcomes`;
3. cria a lápide mínima em `closed_patients`;
4. exclui o paciente da coleção ativa.

As Firestore Rules negam qualquer parte isolada ou combinação incompleta. A
transação lê primeiro a lápide determinística e o paciente ativo:

- sem lápide e com paciente ativo, cria o evento e a lápide e retira o ativo;
- com lápide compatível já confirmada e paciente já ausente, trata a repetição
  como idempotente, sem ler nem reescrever o histórico privado;
- qualquer combinação conflitante falha de forma fechada.

O identificador estável torna o retry idempotente. A interface mantém um
snapshot visual durante o eco local otimista e só libera a retirada depois que
`runTransaction()` confirma a operação.

O evento privado, a projeção administrativa e `patientSnapshot` são derivados
do mesmo paciente autoritativo lido dentro da transação. Se outro cliente
atualizar o paciente antes do commit, a repetição transacional recalcula os
documentos a partir do mesmo estado e evita divergência entre auditoria e
snapshot histórico.

Todas as mutações de pacientes desta versão — salvamento automático ou manual,
divisão, reordenação, remanejamento e migração — consultam a lápide mínima
antes de escrever. Uma transação concorrente é repetida pelo Firestore e falha
se o Desfecho tiver sido confirmado primeiro. As Rules também negam a criação
de um paciente com o mesmo identificador quando existe uma lápide em qualquer
setor conhecido.

Campos do contrato:

| Campo | Conteúdo |
|---|---|
| `schemaVersion` | `1` |
| `sourceVersion` | Release de origem |
| `outcomeId` | Identificador estável do episódio |
| `type` | `patient_outcome` |
| `outcomeType`, `outcomeLabel` | Código estável e rótulo |
| `createdAt` | Timestamp do servidor |
| `createdAtLocal`, `dateLocal` | Data/hora ISO e data local |
| `patientId`, `patientName` | Identificação do registro |
| `sectorUnit`, `sectorName` | Setor no encerramento |
| `unit`, `bed` | Unidade e leito no encerramento |
| `specialty` | Especialidade registrada |
| `admissionDate` | Data de internação usada como DIH |
| `lengthOfStayDays` | Permanência inclusiva em dias ou `null` |
| `lengthOfStayMethod` | `inclusive_calendar_days` |
| `responsibleDoctor`, `actor` | Médico confirmado |
| `actorUid` | UID Firebase que confirmou a operação |
| `primaryIcdCode` | CID no Óbito; vazio nos demais |
| `status`, `severity`, `alerts` | Estado imediatamente anterior |
| `patientSnapshot` | Cópia integral e imutável do paciente |

Permanência no mesmo dia equivale a um dia. DIH ausente, fora do formato exato
`YYYY-MM-DD`, impossível no calendário ou futura produz `null`, sem truncar
sufixos nem fazer inferência.

Contrato da lápide mínima:

| Campo | Conteúdo |
|---|---|
| `schemaVersion` | `1` |
| `type` | `patient_closed` |
| `patientId`, `sectorUnit` | Identificadores do registro encerrado |
| `outcomeId`, `outcomeType` | Referência e tipo do Desfecho |
| `closedAt` | Timestamp do servidor |
| `closedByUid` | UID Firebase que confirmou a operação |

Nenhum dado clínico ou identificador nominal pode ser acrescentado à lápide.

Contrato da projeção administrativa:

| Campo | Conteúdo |
|---|---|
| `schemaVersion`, `sourceVersion` | Esquema `2` e release de origem |
| `type` | `patient_outcome_admin` |
| `outcomeId`, `outcomeType`, `outcomeLabel` | Identificação e tipo do Desfecho |
| `createdAt` | Timestamp autoritativo do servidor |
| `patientId`, `patientName` | Identificação administrativa |
| `sectorUnit`, `sectorName`, `unit`, `bed` | Local do encerramento |
| `specialty`, `admissionDate` | Especialidade e DIH |
| `lengthOfStayDays`, `lengthOfStayMethod` | Valor persistido de compatibilidade |
| `responsibleDoctor`, `primaryIcdCode`, `actorUid` | Responsável, CID e sessão |
| `palliativeAlertPresentAtOutcome` | Booleano derivado da presença exata do alerta estruturado `Paliativo` |

A projeção versão 2 não transporta a lista de alertas nem dados da avaliação
paliativa. Ela registra somente o booleano mínimo derivado do mesmo paciente
autoritativo usado no evento privado. As Rules exigem simultaneamente que o
valor seja igual à presença de `Paliativo` no evento privado e que essa
presença corresponda ao paciente ativo lido antes da exclusão. Uma alteração
local ainda não persistida não é promovida silenciosamente ao histórico.

Essa verificação protege a consistência da transação de Desfecho; enquanto o
acesso clínico continuar anônimo, ela não impede que um cliente autorizado
altere previamente o paciente ativo. Por isso o login nominal continua sendo
gate de produção.

A projeção não aceita `patientSnapshot`, diagnóstico, alertas brutos,
gravidade, status, `createdAtLocal` ou `dateLocal`.

## Modo local

Quando o Firebase não está configurado, os registros usam:

```text
sbar_breve_santa_casa_desfechos_v1_<sectorUnit>
```

A Área Administrativa não consolida `localStorage`. Esses registros só poderão
aparecer no painel após uma etapa futura de sincronização explícita.
Se o histórico local existente não puder ser interpretado como uma lista, o
fluxo falha sem sobrescrever o conteúdo e sem retirar o paciente.

## Compatibilidade

- Eventos legados `patient_deleted` não são convertidos em Desfecho.
- O Desfecho preserva campos clínicos desconhecidos dentro de
  `patientSnapshot`.
- Os códigos persistidos não devem ser traduzidos nem renomeados.
- A Área Administrativa deriva contagens e taxas sem gravá-las novamente em
  cada evento.
- As Rules preservam criação de eventos legados reconhecidos e migrações
  atômicas válidas, sem liberar leitura clínica do histórico nem alteração de
  eventos já criados.

## Acesso administrativo

`area_administrativa.html` não usa mais código compartilhado em JavaScript nem
`sessionStorage` como autorização. O acesso exige:

1. autenticação Firebase por e-mail e senha;
2. documento `admin_users/<uid>` com `active: true`;
3. `role` igual a `admin` ou `coordinator`.

A Área Administrativa usa uma instância Firebase nomeada
`connect-hub-admin`, com persistência de sessão, para não substituir nem
encerrar a sessão anônima da aplicação clínica. O painel consulta os dados
somente depois de validar o próprio perfil. Logout, acesso negado ou falha de
autorização limpam os dados administrativos da memória e da interface.

As Rules permitem leitura do histórico integral somente para usuário
não-anônimo, ativo e com um dos dois papéis administrativos. O cliente clínico
anônimo pode consultar uma lápide individual, mas não listar lápides nem ler
`historico_eventos`.

## Área Administrativa — Desfechos

A aba `Desfechos` consome somente projeções `patient_outcome_admin` dos
esquemas 1 e 2 e tipos homologados. A versão 1 continua legível como dado
histórico, mas novas projeções precisam usar o esquema 2. Nos documentos
legados, o registro do alerta Paliativo é apresentado como indisponível;
ausência histórica do novo campo nunca é interpretada como ausência de cuidado
paliativo. O
período inicial corresponde aos últimos 30 dias. Os filtros disponíveis são:

- data inicial e final;
- setor;
- especialidade;
- tipo de Desfecho;
- alerta Paliativo: registrado, sem registro ou registro indisponível.

A visão apresenta:

- total, Tratados, Transferidos e Óbitos gerais registrados;
- Óbitos com alerta Paliativo registrado, Óbitos sem esse alerta e cobertura
  do registro;
- proporção de Óbitos entre os Desfechos filtrados;
- permanência média e mediana inclusivas, sempre com cobertura;
- distribuição da permanência em faixas e permanência segmentada por tipo de
  Desfecho;
- consolidação por setor e por especialidade, incluindo Óbitos gerais, com
  alerta Paliativo e cobertura local do registro;
- recorte nosológico dos Óbitos pelos CIDs principais em formato esperado;
- tabela de auditoria com data/hora, `outcomeId`, paciente, Desfecho, setor,
  especialidade, DIH, permanência, registro paliativo, médico responsável e
  CID quando aplicável, paginada em lotes de 50 registros.

Os gráficos são complementares. Cada visualização mantém uma tabela exata como
fonte de leitura e auditoria; se Chart.js estiver ausente ou falhar, o painel
preserva números e tabelas e apresenta uma mensagem de indisponibilidade. Ao
abrir Desfechos, os KPIs do censo atual são ocultados para não misturar
pacientes ativos com o histórico filtrado.

A proporção de Óbitos não representa mortalidade institucional: o denominador
contém somente os Desfechos registrados nesta ferramenta. Permanência sem valor
válido fica fora da média e mediana e continua explícita na cobertura.
Da mesma forma, `palliativeAlertPresentAtOutcome: false` significa somente que
o alerta estruturado não estava registrado no encerramento; não equivale a
classificar o paciente como não paliativo. O recorte nosológico desta versão é
restrito aos Óbitos, pois o CID continua homologado e obrigatório somente nesse
tipo de Desfecho. Novos CIDs devem respeitar o formato estruturado
`A00`–`Z99` com subcategoria alfanumérica opcional; projeções históricas com
valor inválido não entram no agrupamento nem na cobertura.
Essa verificação confirma apenas o formato do campo, não a existência do código
em uma terminologia oficial nem sua descrição clínica.
O filtro por período, a ordenação e a auditoria usam exclusivamente
`createdAt`, gravado pelo servidor e convertido para a data civil de
`America/Sao_Paulo`. Registros sem timestamp válido não entram nas métricas.
A permanência é recalculada de `admissionDate` até essa data civil, sem confiar
no relógio do navegador nem no `lengthOfStayDays` persistido. A auditoria
também exibe `—` para DIH malformada ou impossível; novas gravações com valor
fora de `''` ou do formato estruturado são negadas pelas Rules.

O painel diferencia os estados carregando, pronto, sem dados, sem resultado
para o filtro, acesso negado, erro e histórico truncado. Se a leitura falhar ou
ultrapassar o limite seguro de 5.000 eventos, indicadores e exportações
históricas são bloqueados em vez de apresentar números parciais.

O cliente consulta diretamente a coleção materializada `admin_outcomes`.
Eventos privados `patient_outcome`, incluindo `patientSnapshot`, são excluídos
da consulta histórica no servidor e não trafegam para a aba Desfechos.

## Gate de publicação

As Rules estão versionadas em `firestore.rules` e possuem 22 testes no
Firestore Emulator. Isso não significa que já estejam publicadas no projeto
Firebase. Antes de integrar ou publicar a aplicação:

1. bloquear o uso clínico durante uma janela controlada: o cliente antigo cria
   esquema 1, que as Rules finais negam, e as Rules antigas rejeitam o esquema
   2; portanto não existe uma ordem de publicação compatível sem essa janela;
2. publicar as novas Rules e o novo HTML como uma única troca coordenada;
3. resolver o acesso clínico anônimo no site público com autenticação nominal
   ou barreira institucional comprovada;
4. habilitar o provedor Email/Password no Firebase Authentication;
5. criar a conta institucional no Authentication;
6. criar `admin_users/<uid>` com `active: true` e papel `admin` ou
   `coordinator`, por ferramenta administrativa privilegiada;
7. validar login autorizado, acesso negado, Desfecho e tentativa de
   ressurreição em ambiente controlado.

Nunca registrar senha, token ou outra credencial no repositório. O procedimento
completo está em `docs/FIRESTORE_SECURITY.md`.

## Limitação residual de identidade

A aplicação clínica continua usando Firebase Auth anônimo. `actorUid` e
`closedByUid` vinculam o Desfecho à sessão Firebase que fez o commit, mas não
identificam individualmente o profissional. Além disso, as Rules atuais
preservam a compatibilidade da V1 permitindo que clientes anônimos autenticados
editem campos do paciente ativo. Portanto, a autenticidade de cada campo do
snapshot não é individualmente atribuível; elevar essa garantia exige
autenticação clínica nominal e uma política de autorização própria.
