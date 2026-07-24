# Desfecho do paciente — V1

Atualizado em: 24/07/2026

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

Permanência no mesmo dia equivale a um dia. DIH ausente, inválida ou futura
produz `null`, sem inferência.

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
| `schemaVersion`, `sourceVersion` | Versão do esquema e release de origem |
| `type` | `patient_outcome_admin` |
| `outcomeId`, `outcomeType`, `outcomeLabel` | Identificação e tipo do Desfecho |
| `createdAt` | Timestamp autoritativo do servidor |
| `patientId`, `patientName` | Identificação administrativa |
| `sectorUnit`, `sectorName`, `unit`, `bed` | Local do encerramento |
| `specialty`, `admissionDate` | Especialidade e DIH |
| `lengthOfStayDays`, `lengthOfStayMethod` | Valor persistido de compatibilidade |
| `responsibleDoctor`, `primaryIcdCode`, `actorUid` | Responsável, CID e sessão |

A projeção não aceita `patientSnapshot`, diagnóstico, alertas, gravidade,
status, `createdAtLocal` ou `dateLocal`.

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

A aba `Desfechos` consome somente projeções `patient_outcome_admin` de
`schemaVersion: 1` e tipos homologados. O período inicial corresponde aos
últimos 30 dias. Os filtros disponíveis são:

- data inicial e final;
- setor;
- especialidade;
- tipo de Desfecho.

A visão apresenta:

- total, Tratados, Óbitos e Transferidos;
- proporção de Óbitos entre os Desfechos filtrados;
- permanência média e mediana inclusivas, sempre com cobertura;
- consolidação por setor e por especialidade;
- CIDs principais mais frequentes nos Óbitos filtrados;
- tabela de auditoria com data/hora, `outcomeId`, paciente, Desfecho, setor,
  especialidade, DIH, permanência, médico responsável e CID quando aplicável.

A proporção de Óbitos não representa mortalidade institucional: o denominador
contém somente os Desfechos registrados nesta ferramenta. Permanência sem valor
válido fica fora da média e mediana e continua explícita na cobertura.
O filtro por período, a ordenação e a auditoria usam exclusivamente
`createdAt`, gravado pelo servidor e convertido para a data civil de
`America/Sao_Paulo`. Registros sem timestamp válido não entram nas métricas.
A permanência é recalculada de `admissionDate` até essa data civil, sem confiar
no relógio do navegador nem no `lengthOfStayDays` persistido.

O painel diferencia os estados carregando, pronto, sem dados, sem resultado
para o filtro, acesso negado, erro e histórico truncado. Se a leitura falhar ou
ultrapassar o limite seguro de 5.000 eventos, indicadores e exportações
históricas são bloqueados em vez de apresentar números parciais.

O cliente consulta diretamente a coleção materializada `admin_outcomes`.
Eventos privados `patient_outcome`, incluindo `patientSnapshot`, são excluídos
da consulta histórica no servidor e não trafegam para a aba Desfechos.

## Gate de publicação

As Rules estão versionadas em `firestore.rules` e possuem 21 testes no
Firestore Emulator. Isso não significa que já estejam publicadas no projeto
Firebase. Antes de integrar ou publicar a aplicação:

1. resolver o acesso clínico anônimo no site público com autenticação nominal
   ou barreira institucional comprovada;
2. habilitar o provedor Email/Password no Firebase Authentication;
3. criar a conta institucional no Authentication;
4. criar `admin_users/<uid>` com `active: true` e papel `admin` ou
   `coordinator`, por ferramenta administrativa privilegiada;
5. publicar `firestore.rules`;
6. validar login autorizado, acesso negado, Desfecho e tentativa de
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
