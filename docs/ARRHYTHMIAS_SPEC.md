# Especificação funcional — Assistente de Arritmias

Versão de referência: `FOUNDATION-1.0-RC1.2.10-RESPONSIVE-BOUNDARY-FIX`

## Objetivo e limite

O assistente organiza a avaliação de arritmias em decisões progressivas e
transforma os dados registrados em resumo útil para passagem de caso.

Ele organiza informações fornecidas pelo usuário. Não substitui avaliação
médica, evolução, prescrição, prontuário institucional ou julgamento clínico.

## Princípios obrigatórios

- Apresentar uma decisão clínica por vez.
- Salvar automaticamente respostas registradas.
- Autorizar a persistência de um fluxo incompleto somente quando o Auto Save
  partir de uma decisão real do usuário.
- Manter o salvamento manual bloqueado enquanto houver etapa obrigatória
  incompleta.
- Avançar automaticamente quando a decisão permitir.
- Permitir revisão deliberada de respostas anteriores.
- Invalidar etapas dependentes quando uma resposta muda o caminho clínico.
- Nunca alterar dados durante a visualização.
- Concluir o perfil de FA/Flutter apenas por `Finalizar perfil`.
- Nunca inferir informação não registrada no resumo.

## Dados persistidos

O módulo utiliza `arrhythmiasCleanData`, que reúne, entre outros:

- versão e estado de finalização;
- diagnóstico e rótulo;
- critérios de instabilidade;
- conclusão da avaliação hemodinâmica;
- relação entre instabilidade e arritmia;
- conclusão da etapa de prioridade;
- resposta à conduta inicial;
- caminho clínico e estado hemodinâmico;
- perfil clínico estruturado.

Mudanças nesse contrato exigem versionamento, compatibilidade ou migração
documentada.

## Fluxo clínico

### 1. Diagnóstico

Opções registradas no fluxo:

- fibrilação atrial;
- flutter atrial;
- taquicardia supraventricular;
- taquicardia ventricular;
- bradiarritmia;
- extrassístoles;
- outra arritmia.

`Outra arritmia` exige descrição. Alterar o diagnóstico reinicia as decisões
dependentes.

### 2. Estabilidade hemodinâmica

Critérios registrados:

- hipotensão com repercussão clínica;
- sinais de choque;
- dor torácica isquêmica;
- insuficiência cardíaca aguda ou edema agudo de pulmão;
- alteração aguda do nível de consciência;
- nenhum dos critérios acima.

`Nenhum dos critérios acima` é mutuamente exclusivo dos critérios de
instabilidade. A etapa exige pelo menos uma resposta válida.

### 3. Relação com a arritmia

Quando existe instabilidade, o fluxo registra se ela é:

- provavelmente relacionada à arritmia;
- predominantemente explicada por outra causa;
- de nexo ainda indeterminado.

### 4. Prioridade assistencial imediata

Quando o paciente está instável e a instabilidade é provavelmente relacionada
à arritmia, o usuário registra se o paciente:

- estabilizou após a conduta inicial; ou
- permanece instável.

Essa etapa registra a resposta observada; não prescreve uma conduta específica.

### 5. Perfil clínico de FA/Flutter

Aplicável somente a fibrilação atrial ou flutter atrial. Contém cinco decisões:

1. padrão do episódio;
2. janela estimada de início;
3. ECG e pré-excitação;
4. anticoagulação prévia;
5. fatores precipitantes.

#### Padrão do episódio

- primeiro episódio conhecido;
- recorrente/paroxístico;
- persistente ou permanente;
- história não definida.

#### Janela estimada de início

- menos de 24 horas;
- entre 24 e 48 horas;
- mais de 48 horas;
- desconhecida.

#### ECG e pré-excitação

Pergunta obrigatória:

> O ECG apresenta sinais de pré-excitação?

Orientação:

> Selecione conforme o ECG disponível neste momento.

Respostas:

- Não — sem evidência de pré-excitação;
- Sim — pré-excitação suspeita;
- ECG ainda não avaliado.

O rótulo isolado `ECG` não deve substituir a pergunta clínica explícita.

#### Anticoagulação prévia

- terapêutica regular;
- não utiliza;
- uso irregular ou incerto.

#### Fatores precipitantes

Seleção múltipla com opções registradas no fluxo, incluindo infecção/sepse,
distúrbio eletrolítico, tireotoxicose/hipertireoidismo, álcool ou
estimulantes, pós-operatório, hipóxia/insuficiência respiratória,
descompensação de insuficiência cardíaca, nenhum identificado e outro.

`Nenhum identificado` é mutuamente exclusivo. `Outro` exige descrição. Ao
menos uma resposta é obrigatória.

### Finalizar perfil

A ação:

- valida os precipitantes;
- exige descrição quando `Outro` estiver marcado;
- define o perfil como concluído;
- encerra a edição;
- atualiza o resumo;
- solicita persistência imediata.

Preencher o último campo não substitui essa ação.

## Conclusão do módulo

O módulo é concluído quando:

1. o diagnóstico está completo;
2. a estabilidade está completa;
3. o ramo adaptativo de instabilidade está completo; e
4. o perfil está completo, quando aplicável.

O ramo adaptativo está completo quando o paciente é estável ou quando as
decisões aplicáveis de relação causal e resposta à conduta foram registradas.

## Precedência dos estados no card

1. `Prioridade clínica` para instabilidade atual ou persistente.
2. `Concluído` quando todas as etapas aplicáveis terminaram.
3. `Conduta registrada` quando houve estabilização, mas faltam etapas.
4. `Em andamento` nos demais fluxos incompletos.

Quando o paciente estabilizou após conduta e completou o fluxo:

- selo: `Concluído`;
- corpo: `Estabilizou após conduta imediata`;
- cor: pode permanecer âmbar como histórico de risco.

## Resumo assistencial

O resumo só aparece quando Arritmias está selecionado. Pode conter:

- diagnóstico;
- estado hemodinâmico;
- resposta à conduta e critérios de instabilidade;
- padrão e início estimado do episódio;
- pré-excitação suspeita ou ainda não avaliada;
- anticoagulação prévia;
- precipitantes;
- próxima etapa pendente.

O clique no resumo deve abrir o paciente, expandir o Assistente Clínico,
posicionar Arritmias e:

- abrir concluído em visualização;
- abrir incompleto em continuidade/edição;
- nunca modificar dados silenciosamente.

## Auto Save e Auto Advance

O Auto Save deve ser solicitado após decisões, campos textuais e finalização.
Campos textuais podem usar pequeno atraso antes da persistência.

Na RC1.2.9, cada decisão válida deve atualizar primeiro o estado em memória e
depois solicitar o Auto Save. A autorização para persistir Arritmias ainda
incompleta é explícita e restrita a eventos reais do usuário. Ela não dispensa
a validação dos campos básicos nem dos outros módulos selecionados e não se
aplica ao salvamento manual.

Ao reabrir uma avaliação incompleta, as decisões intermediárias persistidas
devem ser restauradas e o fluxo deve mostrar a primeira microetapa ainda não
respondida. Essa restauração não conclui implicitamente o perfil: `finalized`
e `clinicalProfile.completed` permanecem `false`, com estado `Em andamento`,
até a ação `Finalizar perfil`.

O Auto Advance deve ser preservado na sequência do perfil:

1. padrão;
2. início;
3. pré-excitação;
4. anticoagulação;
5. precipitantes.

## Edição e visualização

- O lápis é o acesso deliberado à edição.
- Alterar decisões anteriores invalida apenas estados dependentes.
- O estado `Em edição` deve permanecer visível sem texto duplicado.
- Visualização é estritamente somente leitura.
- `Recolher` retorna ao formato compacto.
- Visualização, recolhimento e hidratação devem produzir zero mutação do objeto
  do paciente e zero escrita, inclusive depois de temporizadores tardios.

## Responsividade e regressão mínima

Validar em 390, 494, 768, 1180 e 1440 px:

- ausência de overflow horizontal;
- abrir e recolher estáveis;
- seleção direta abrindo o módulo;
- módulo visível dentro do drawer;
- controles por ícone com rótulos acessíveis;
- resumo vertical e horizontal legível;
- visualização sem mutação dos dados;
- semântica correta dos quatro estados;
- pergunta explícita de pré-excitação;
- busca, cópia, snapshot e impressão preservados.

Na RC1.2.10, o modo horizontal permanece compacto até 791 px e passa ao grid
a partir de 792 px. Os overflows de 761 e 768 px foram corrigidos sem alterar
JavaScript, handlers, temporizadores, `z-index`, `pointer-events` ou regras
clínicas. A abertura do Clinical Copilot em 390 px passou com `locator.click`
e `locator.tap` reais.

O risco histórico intermitente de hit-testing em 390 px permanece como
observação monitorada, sem falha esperada ativa. A correção funcional RC1.2.9,
sua semântica clínica e a persistência intermediária permanecem inalteradas.
