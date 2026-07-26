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
| `treated` | Alta médica |
| `death` | Óbito |
| `transferred` | Transferência externa |

Não existem outras opções nesta versão.

O CID principal é obrigatório nos três tipos de Desfecho. O médico responsável
pelo desfecho também é obrigatório em todos os casos e deve ser confirmado
explicitamente pelo usuário. Um nome previamente registrado no campo de
check-out pode ser usado apenas como sugestão editável.

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
- O formulário do drawer precisa ser confirmado antes da abertura; no commit,
  o snapshot é reconstruído exclusivamente do paciente autoritativo lido dentro
  da transação.

## Persistência Firebase

O Desfecho separa o marcador operacional mínimo do histórico clínico privado:

```text
connect_hub_v55/<sectorUnit>/closed_patients/<patientId>
historico_eventos/<outcomeId>
admin_outcomes/<outcomeId>
admin_sector_transitions/<factId>
connect_hub_v55/<sectorUnit>/pacientes/<patientId>
```

O primeiro documento é uma lápide mínima com `type: "patient_closed"`. Ele não
contém nome, diagnóstico, CID, alertas nem `patientSnapshot` e pode ser lido por
um cliente clínico autenticado somente por `get`, para impedir uma gravação
tardia. O segundo documento é o evento privado `patient_outcome`, com o
snapshot clínico integral. O terceiro é a projeção administrativa mínima
`patient_outcome_admin`, sem snapshot ou estado clínico. A quarta coleção
registra fatos administrativos imutáveis de mudança entre setores; ela não é
criada por remanejamento de leito dentro do mesmo setor.

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
| `schemaVersion` | `2` para novos eventos; `1` permanece histórico |
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
| `primaryIcdCode` | CID principal obrigatório em qualquer Desfecho |
| `sectorTrackingVersion` | `1` para episódio rastreado; `0` para ativo legado sem rastreamento |
| `episodeId` | Identificador técnico do episódio rastreado ou vazio no legado |
| `sectorTrackingOrigin` | `initial_entry`, `baseline_observation` ou vazio no legado |
| `lastSectorTransitionFactId` | Último fato encadeado ou vazio |
| `sectorEnteredAt` | Timestamp de entrada no setor atual ou `null` no legado |
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
| `schemaVersion`, `sourceVersion` | Esquema `3` e release de origem |
| `type` | `patient_outcome_admin` |
| `outcomeId`, `outcomeType`, `outcomeLabel` | Identificação e tipo do Desfecho |
| `createdAt` | Timestamp autoritativo do servidor |
| `patientId`, `patientName` | Identificação administrativa |
| `sectorUnit`, `sectorName`, `unit`, `bed` | Local do encerramento |
| `specialty`, `admissionDate` | Especialidade e DIH |
| `lengthOfStayDays`, `lengthOfStayMethod` | Valor persistido de compatibilidade |
| `responsibleDoctor`, `primaryIcdCode`, `actorUid` | Responsável, CID e sessão |
| `palliativeAlertPresentAtOutcome` | Booleano derivado da presença exata do alerta estruturado `Paliativo` |
| `sectorTrackingVersion`, `episodeId` | Versão e episódio do rastreamento setorial |
| `sectorTrackingOrigin` | Origem completa, parcial ou vazia no legado |
| `lastSectorTransitionFactId`, `sectorEnteredAt` | Fechamento da cadeia setorial |

A projeção versão 3 não transporta a lista de alertas nem dados da avaliação
paliativa. Ela registra somente o booleano mínimo derivado do mesmo paciente
autoritativo usado no evento privado. As Rules exigem simultaneamente que o
valor seja igual à presença de `Paliativo` no evento privado e que essa
presença corresponda ao paciente ativo lido antes da exclusão. Uma alteração
local ainda não persistida não é promovida silenciosamente ao histórico.

## Rastreamento de permanência por setor

Pacientes novos recebem no mesmo commit de criação:

- `sectorTrackingVersion: 1`;
- `episodeId` determinístico;
- `sectorTrackingOrigin: "initial_entry"`;
- `sectorEnteredAt` com timestamp do servidor;
- `lastSectorTransitionFactId: ""`.

Uma migração entre setores cria, na mesma transação que retira a origem e cria
o destino, um fato `patient_sector_transition_admin` em
`admin_sector_transitions/<factId>`. O fato registra origem, destino, instante
do servidor, episódio, predecessor e classificação
`sector_transfer` ou `counterflow_transfer`. A origem e o destino usam o
identificador canônico já persistido pelo setor. Remanejamento de unidade ou
leito dentro do mesmo setor preserva `sectorEnteredAt` e não cria transição.

Se um paciente ativo anterior a esta versão migrar, o destino inicia
`baseline_observation`: o tempo anterior à primeira migração permanece
desconhecido e a cobertura do episódio é parcial. Se o mesmo paciente chegar
ao Desfecho sem nenhuma transição rastreada, o evento e a projeção usam o
envelope legado `0`, strings vazias e `sectorEnteredAt: null`; o painel marca a
cobertura setorial como indisponível. Nenhum timestamp retroativo é fabricado.

O painel fecha intervalos no modelo `[entrada, saída)` usando timestamps do
servidor, calcula horas decorridas e soma retornos ao mesmo setor dentro do
episódio. Uma cadeia quebrada, contraditória, truncada ou com duração negativa
é indisponível. Um intervalo válido com entrada e saída no mesmo instante é
preservado como `0 h`, não confundido com ausência de dados. O tempo hospitalar
inclusivo derivado da DIH continua sendo uma métrica separada e nunca recebe o
rótulo de permanência setorial.

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

A aba `Desfechos` consome projeções `patient_outcome_admin` dos esquemas 1, 2 e
3 e tipos homologados, além de fatos `patient_sector_transition_admin` de
esquema 1 exclusivamente para permanência setorial. As versões 1 e 2 da
projeção continuam legíveis como dado histórico, mas novas projeções precisam
usar o esquema 3. Nos documentos legados, o registro do alerta Paliativo é
apresentado como indisponível;
ausência histórica do novo campo nunca é interpretada como ausência de cuidado
paliativo. O período inicial corresponde aos últimos 30 dias. Os filtros
disponíveis são:

- data inicial e final;
- setor;
- especialidade;
- tipo de Desfecho;
- CID principal;
- alerta Paliativo: registrado, sem registro ou registro indisponível.

A visão apresenta:

- total, Altas médicas, Transferências externas e Óbitos gerais registrados;
- Óbitos com alerta Paliativo registrado, Óbitos sem esse alerta e cobertura
  do registro;
- proporção de Óbitos entre os Desfechos filtrados;
- permanência média e mediana inclusivas, sempre com cobertura;
- distribuição da permanência em faixas e permanência segmentada por tipo de
  Desfecho;
- permanência observada por setor em horas, com média, mediana, total,
  episódios e cobertura completa/parcial/indisponível;
- consolidação por setor e por especialidade, incluindo Óbitos gerais, com
  alerta Paliativo e cobertura local do registro;
- perfil nosológico de todos os Desfechos por CID, discriminando Alta médica,
  Óbito e Transferência externa;
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
classificar o paciente como não paliativo. O perfil nosológico inclui os três
tipos de Desfecho e usa somente novos CIDs no formato estruturado
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

O cliente consulta diretamente as coleções materializadas `admin_outcomes` e
`admin_sector_transitions`.
Eventos privados `patient_outcome`, incluindo `patientSnapshot`, são excluídos
da consulta histórica no servidor e não trafegam para a aba Desfechos.
Falha ou truncamento da coleção de transições bloqueia somente as métricas
setoriais; os demais indicadores continuam disponíveis quando a coleção de
Desfechos está íntegra.

## Gate de publicação

As Rules estão versionadas em `firestore.rules` e passaram em 33/33 cenários no
Firestore Emulator. Isso não significa que já estejam publicadas no projeto
Firebase. Antes de integrar ou publicar a aplicação:

1. bloquear o uso clínico durante uma janela controlada: o cliente antigo cria
   esquemas antigos, que as Rules finais negam, e as Rules antigas rejeitam os
   esquemas 2/3 e os fatos setoriais; portanto não existe uma ordem de
   publicação compatível sem essa janela;
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
