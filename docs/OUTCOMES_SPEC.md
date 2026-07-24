# Desfecho do paciente — V1

Atualizado em: 24/07/2026

## Objetivo

Encerrar a participação de um paciente no HUB sem apagar definitivamente os
dados clínicos registrados. O Desfecho substitui a antiga ação `Excluir` nos
cards e no drawer de edição.

Esta primeira entrega cria a fonte histórica que será consumida pela próxima
etapa da Área Administrativa. Ela não altera o dashboard administrativo.

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

O registro é salvo em:

```text
historico_eventos/<outcomeId>
```

com `type: "patient_outcome"`.

O registro histórico e a retirada de
`connect_hub_v55/<sectorUnit>/pacientes/<patientId>` fazem parte da mesma
transação atômica. A transação lê primeiro o registro histórico determinístico
e o paciente ativo:

- sem histórico e com paciente ativo, cria o evento e retira o ativo;
- com histórico já confirmado e paciente já ausente, retorna o primeiro evento
  sem reescrevê-lo;
- qualquer combinação conflitante falha de forma fechada.

O identificador estável torna o retry idempotente. A interface mantém um
snapshot visual durante o eco local otimista e só libera a retirada depois que
`runTransaction()` confirma a operação.

Os campos administrativos de primeiro nível e `patientSnapshot` são derivados
do mesmo paciente autoritativo lido dentro da transação. Se outro cliente
atualizar o paciente antes do commit, a repetição transacional recalcula ambos
a partir do mesmo estado e evita métricas divergentes do snapshot histórico.

Todas as mutações de pacientes desta versão — salvamento automático ou manual,
divisão, reordenação, remanejamento e migração — leem esse mesmo guard antes de
escrever. Uma transação concorrente é repetida pelo Firestore e falha se o
Desfecho tiver sido confirmado primeiro.

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
| `primaryIcdCode` | CID no Óbito; vazio nos demais |
| `status`, `severity`, `alerts` | Estado imediatamente anterior |
| `patientSnapshot` | Cópia integral e imutável do paciente |

Permanência no mesmo dia equivale a um dia. DIH ausente, inválida ou futura
produz `null`, sem inferência.

## Modo local

Quando o Firebase não está configurado, os registros usam:

```text
sbar_breve_santa_casa_desfechos_v1_<sectorUnit>
```

A Área Administrativa atual não consolida `localStorage`. Esse dado só poderá
aparecer no painel após sincronização ou suporte explícito na segunda entrega.
Se o histórico local existente não puder ser interpretado como uma lista, o
fluxo falha sem sobrescrever o conteúdo e sem retirar o paciente.

## Compatibilidade

- Eventos legados `patient_deleted` não são convertidos em Desfecho.
- O Desfecho preserva campos clínicos desconhecidos dentro de
  `patientSnapshot`.
- Os códigos persistidos não devem ser traduzidos nem renomeados.
- A futura Área Administrativa deve derivar contagens e taxas, sem gravá-las
  novamente em cada evento.
- A transação protege os clientes desta versão. A imutabilidade contra clientes
  antigos, código externo ou escrita maliciosa depende de Rules publicadas no
  Firebase que permitam criar `patient_outcome`, mas neguem update e delete.
  Essas Rules não estão versionadas neste repositório e devem ser validadas
  antes da publicação em produção.
