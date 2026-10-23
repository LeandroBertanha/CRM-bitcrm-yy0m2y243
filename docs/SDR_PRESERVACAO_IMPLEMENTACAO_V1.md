# bitCRM - Relatorio previo de implementacao do SDR Inteligente

Versao do relatorio: 1.2
Versao-base do bitCRM: 0.0.96
Commit-base: 9e8ab89
Versao da implementacao local: 0.0.105
Status: fundacao publicada; ativacao operacional e persistencia auditada preparadas para producao

## 1. Objetivo

Adicionar ao bitCRM um modulo SDR Inteligente integrado ao WhatsApp, preservando integralmente os dados, as regras e os fluxos atualmente existentes.

O modulo sera uma extensao aditiva. Por padrao, tera acesso somente de leitura a oportunidades, pipeline e historico existentes. Qualquer criacao ou alteracao no CRM dependera de regra administrativa explicita e, nos casos ambiguos, de confirmacao humana.

## 2. Diagnostico do projeto atual

- Frontend React/Vite com rotas protegidas por autenticacao e perfil administrativo.
- Backend PocketBase hospedado na infraestrutura do Skip.
- Colecoes existentes relevantes: `users`, `opportunities`, `opportunity_notes`, `approach_sessions`, `whatsapp_settings`, `products` e colecoes de playbook/comissionamento.
- Integracao WhatsApp Cloud API ja possui estrutura inicial no hook `pocketbase/hooks/whatsapp_cloud_api.js`.
- O repositorio nao contem comprovacao de ambiente separado de homologacao.
- O repositorio nao contem procedimento documentado de backup e restauracao do PocketBase.
- O historico de migracoes possui scripts antigos com exclusao ou truncamento de dados. Eles nao serao usados como modelo para o SDR.

Conclusao: nenhuma migracao do SDR deve ser executada em producao antes da comprovacao de backup restauravel e da definicao do ambiente de homologacao.

## 3. Componentes a adicionar

### Frontend

- Rota administrativa `/sdr` protegida por `AdminRoute`.
- Item de menu `SDR Inteligente`, inicialmente visivel apenas para administradores.
- Central SDR com status da feature flag, campanhas, fila, tarefas, mensagens, scores e auditoria.
- Tela de configuracoes do SDR com ativacao global e regras de integracao.
- Fluxo de revisao humana para criacao de oportunidades ou associacao a oportunidade existente.
- Indicadores sem alterar dashboards atuais na primeira fase.

### Servicos frontend

- `src/services/sdrSettingsService.ts`
- `src/services/sdrCampaignService.ts`
- `src/services/sdrMessageService.ts`
- `src/services/sdrOpportunityGuard.ts`
- `src/services/sdrAuditService.ts`

### Backend

- Hook/endpoint proprio para campanhas e disparos SDR.
- Validacao obrigatoria de feature flag no servidor.
- Validacao de escopo e permissao no servidor.
- Protecao contra duplicidade antes de sugerir ou criar oportunidade.
- Logs de auditoria imutaveis para cada operacao relevante.
- Processamento de WhatsApp com credenciais armazenadas somente em secrets.

## 4. Novas colecoes propostas

Todas as colecoes abaixo sao novas e usam relacoes para os identificadores existentes. Nenhuma colecao atual precisa ser recriada.

| Colecao                 | Finalidade                                | Relacoes principais                          |
| ----------------------- | ----------------------------------------- | -------------------------------------------- |
| `sdr_settings`          | Feature flag e regras globais             | usuario administrador responsavel            |
| `sdr_campaigns`         | Campanhas SDR                             | criador, responsavel comercial               |
| `sdr_campaign_contacts` | Participantes e estado na campanha        | campanha, oportunidade opcional, responsavel |
| `sdr_messages`          | Mensagens preparadas, enviadas e retornos | campanha, contato, oportunidade opcional     |
| `sdr_scores`            | Scores calculados pelo SDR                | contato, campanha, oportunidade opcional     |
| `sdr_tasks`             | Tarefas internas do SDR                   | campanha, contato, responsavel               |
| `sdr_audit_logs`        | Auditoria completa das operacoes          | usuario, campanha, registro afetado          |

Campos de controle obrigatorios em todas as colecoes aplicaveis:

- `created`, `updated`;
- `created_by` ou `actor_user`;
- `company` ou identificador de tenant quando o backend confirmar essa estrutura;
- referencias ao registro original, sem copia destrutiva;
- estado e motivo da operacao;
- identificador de correlacao para rastrear campanhas e envios.

## 5. Tabelas existentes que precisarao de alteracao

Na primeira fase: nenhuma.

O SDR consultara `users`, `opportunities`, `opportunity_notes`, `products` e `whatsapp_settings` de forma controlada. As referencias ficarao nas novas colecoes SDR.

Se uma alteracao futura em colecao existente se tornar indispensavel, ela exigira novo relatorio, aprovacao explicita, backup validado e plano de reversao especifico.

## 6. Regras de preservacao implementaveis

- Feature flag global `enabled = false` por padrao.
- `allow_existing_opportunity_update = false` por padrao.
- `allow_opportunity_creation = false` por padrao.
- Nenhuma associacao retroativa de campanhas.
- Nenhuma alteracao automatica de etapa, vendedor, valor, prazo, probabilidade, observacao ou historico.
- Criacao de oportunidade somente por confirmacao humana ou regra administrativa explicitamente habilitada.
- Antes de criar, busca de oportunidade aberta por telefone, e-mail e empresa.
- Em ambiguidade, apenas sugerir associacao e exigir decisao humana.
- Desativar o SDR nao altera nem interrompe o CRM atual.

## 7. Riscos identificados

| Risco                                     | Impacto                          | Mitigacao                                                      |
| ----------------------------------------- | -------------------------------- | -------------------------------------------------------------- |
| Executar migracao diretamente na producao | perda ou indisponibilidade       | homologacao, backup restauravel e migracoes apenas aditivas    |
| Duplicar oportunidades                    | conflito comercial               | verificador de duplicidade e confirmacao humana                |
| Alterar oportunidade existente por engano | perda de contexto comercial      | bloqueio server-side e modo somente leitura                    |
| Feature flag apenas no frontend           | chamadas indevidas ao backend    | validacao obrigatoria no hook/endpoint                         |
| Reutilizar hook atual sem isolamento      | regressao em disparos existentes | endpoint e servicos SDR separados                              |
| Logs incompletos                          | baixa rastreabilidade            | `sdr_audit_logs` obrigatorio e correlacao por campanha         |
| Falha no WhatsApp ou limite da Meta       | fila inconsistente               | idempotencia, status por mensagem e reprocessamento controlado |
| Regras multiusuario insuficientes         | acesso indevido                  | regras PocketBase e testes de autorizacao por perfil           |

## 8. Estrategia de backup e recuperacao

Antes da primeira migracao:

1. Identificar formalmente qual instancia PocketBase atende a producao.
2. Criar ou confirmar ambiente de homologacao isolado.
3. Gerar backup integral do banco e dos arquivos do PocketBase.
4. Registrar versao `0.0.96` e commit `9e8ab89` como ponto de partida.
5. Restaurar o backup em ambiente isolado.
6. Validar login, arquivos, colecoes e contagens apos restauracao.
7. Registrar data, responsavel, tamanho, hash e resultado da restauracao.
8. Somente depois aplicar as migracoes SDR em homologacao.

Bloqueio atual: nao ha evidencia verificavel, dentro do repositorio, de backup recente restaurado com sucesso nem de homologacao separada. Portanto, a migracao de banco permanece bloqueada.

## 9. Estrategia de testes

### Baseline antes da implementacao

Registrar, sem alterar dados:

- quantidade de usuarios ativos;
- quantidade de oportunidades por etapa;
- quantidade de oportunidades abertas, ganhas e perdidas;
- identificadores, valores e responsaveis das oportunidades;
- quantidade de notas e sessoes de abordagem;
- configuracoes de produtos, comissoes e WhatsApp.

### Testes do modulo SDR

- feature flag desativada impede toda operacao SDR no backend;
- usuario sem permissao nao acessa a rota nem os endpoints;
- leitura de oportunidade nao grava qualquer campo;
- campanha e mensagens ficam somente nas novas colecoes;
- duplicidade por telefone, e-mail ou empresa bloqueia criacao automatica;
- associacao ambigua exige confirmacao humana;
- falha de WhatsApp nao cria oportunidade nem registra sucesso falso;
- reprocessamento e idempotencia nao duplicam mensagem;
- auditoria registra usuario, agente, data, operacao, alvo e resultado;
- desativacao do modulo preserva o funcionamento original.

### Regressao obrigatoria

- autenticacao e primeiro acesso;
- painel e indicadores;
- oportunidades, Kanban e movimentacoes;
- criacao e edicao de oportunidade;
- historico e notas;
- responsaveis e permissoes;
- formulario publico e interno;
- playbook e abordagem;
- comissionamento;
- WhatsApp assistido e Cloud API existentes;
- modo claro e escuro;
- lint, typecheck, testes e build.

### Comparacao final

As contagens e os dados de referencia anteriores devem permanecer identicos, exceto por registros criados exclusivamente nas novas colecoes SDR durante testes autorizados.

## 10. Estrategia de reversao

1. Desativar `sdr_settings.enabled` no servidor.
2. Remover o item de menu e impedir acesso a `/sdr` por configuracao.
3. Interromper workers e filas SDR sem tocar no CRM.
4. Reverter o commit do modulo caso necessario.
5. Manter as colecoes SDR preservadas para auditoria ou remove-las somente mediante aprovacao destrutiva separada.
6. Se houver qualquer divergencia no CRM, restaurar o backup previamente validado.

Como o SDR nao altera colecoes existentes na primeira fase, a reversao funcional consiste em desativar a feature flag e retirar a extensao, sem migracao reversa destrutiva.

## 11. Fases propostas

### Fase 0 - Pre-requisitos

- Confirmar producao e homologacao.
- Executar e restaurar backup.
- Capturar baseline de dados.
- Aprovar este relatorio.

### Fase 1 - Estrutura segura desativada

- Concluido localmente: colecoes SDR aditivas.
- Concluido localmente: feature flag desativada.
- Concluido localmente: regras de leitura administrativa e escrita bloqueada no backend.
- Concluido localmente: modelo de auditoria imutavel.
- Concluido localmente: central administrativa sem campanhas reais.
- Pendente: aplicar a migracao somente em homologacao apos restauracao validada do backup.

### Fase 2 - Campanhas em homologacao

- Parcial local: painel somente leitura com contagens de campanhas, contatos, mensagens, scores, tarefas e auditoria.
- Parcial local: estados claros para colecoes indisponiveis e nova tentativa sem escrita silenciosa.
- Parcial local: motor puro de preparacao, normalizacao e deduplicacao de contatos.
- Parcial local: fila preparada sempre em `aguardando_confirmacao`, sem envio ou persistencia.
- Parcial local: simulador administrativo para validar contatos e mensagens, com criacao protegida de oportunidade disponivel somente quando a homologacao estiver habilitada.
- Parcial local: consulta explicita e somente leitura das oportunidades existentes.
- Parcial local: classificacao de duplicidade por telefone, e-mail e empresa em `Bloquear`, `Revisar` ou `Livre`.
- Validado localmente: contato sem autorizacao foi rejeitado e contato autorizado gerou fila simulada em `aguardando_confirmacao`.
- Validado localmente: contato ficticio autorizado foi comparado com as oportunidades por leitura e recebeu classificacao `Livre`, sem persistencia, associacao ou alteracao no CRM.
- Concluido localmente: servico cliente chama exclusivamente o endpoint protegido do SDR, sem gravacao direta do navegador em `opportunities`.
- Criar campanhas e contatos de teste autorizados.
- Implementar fila e mensagens em estruturas SDR.
- Integrar WhatsApp em ambiente autorizado.
- Testar falhas, limites, idempotencia e auditoria.

### Fase 3 - Integracao controlada com CRM

- Parcial local: deteccao de duplicidade no simulador, sem escrita ou associacao automatica.
- Parcial local: sugestao de candidata aberta por relevancia, com confianca alta ou media.
- Parcial local: empates nao pre-selecionam oportunidade e exigem escolha manual futura.
- Parcial local: confirmacao de revisao humana existe somente em memoria e nao persiste associacao.
- Validado localmente: correspondencia somente por empresa gerou sugestao de confianca media; a revisao humana foi marcada sem qualquer persistencia no CRM.
- Aprovado pelo usuario: fluxo local de revisao humana da sugestao de associacao.
- Parcial local: proposta de nova oportunidade somente para resultado `Livre`, com payload previsivel e chave de idempotencia.
- Concluido localmente: endpoint `POST /backend/v1/sdr/opportunities/create` exige autenticacao administrativa, homologacao, feature flags e confirmacao humana.
- Concluido localmente: o backend repete a deduplicacao antes e dentro da transacao, usa chave de idempotencia e grava oportunidade e auditoria atomicamente.
- Concluido localmente: qualquer falha na auditoria reverte a criacao da oportunidade.
- Validado localmente: contato ficticio `Livre` gerou proposta `Novo / Prospeccao / R$ 0,00`; a confirmacao humana foi aprovada pelo usuario e o botao respeita todas as travas do ambiente.
- Pendente ambiental: aplicar a fundacao SDR em homologacao restaurada e ativar `enabled` e `allow_opportunity_creation` para executar o primeiro teste real autorizado.
- Pendente: persistir uma associacao somente apos backend protegido, auditoria e aprovacao explicita.
- Manter alteracao de oportunidade existente desativada.

### Fase 4 - Regressao e liberacao

- Executar suite completa e comparar baseline.
- Validar desativacao e reversao.
- Obter aprovacao explicita.
- Habilitar gradualmente para usuarios autorizados.

## 12. Criterios de aceite da primeira implementacao

- Nenhum arquivo atual de oportunidade ou fluxo comercial removido.
- Nenhuma colecao atual alterada.
- Feature flag criada desativada.
- Rota SDR protegida para administrador.
- Backend bloqueia operacoes quando o modulo esta desativado.
- Auditoria registra todas as operacoes SDR.
- Testes demonstram que oportunidades existentes permanecem imutaveis.
- Backup restauravel e homologacao comprovados antes da migracao.

## 13. Situacao da aprovacao e bloqueios

O relatorio foi aprovado para implementacao local da Fase 1. Antes de aplicar a migracao ou publicar o modulo, ainda e necessario fornecer evidencia de:

1. backup recente do PocketBase;
2. teste de restauracao bem-sucedido;
3. ambiente de homologacao separado;
4. contatos e numeros autorizados para testes de WhatsApp.

## 14. Evolucao operacional da versao 0.0.105

- Ativacao e desativacao administrativa passam por endpoint autenticado e auditado.
- Producao exige a frase explicita `ATIVAR SDR EM PRODUCAO`.
- Confirmacao humana e auditoria permanecem obrigatorias no servidor.
- Alteracao de oportunidades existentes permanece desabilitada e nao pode ser ligada pela tela.
- Campanhas, contatos e mensagens sao gravados apenas nas colecoes SDR, em uma unica transacao.
- A fila nasce em `aguardando_confirmacao`; registrar campanha nao dispara WhatsApp.
- O backend repete a verificacao de oportunidade aberta imediatamente antes da persistencia.
- Criacao de oportunidade nova pode operar em homologacao ou producao, sempre com deduplicacao,
  idempotencia, confirmacao humana e auditoria atomica.
- A tela informa o estado real da WhatsApp Cloud API. Sem secrets e template aprovado, campanhas e
  oportunidades podem ser preparadas, mas o envio automatico permanece bloqueado.

Sem esses itens, nenhuma migracao, alteracao estrutural no banco ou publicacao do SDR sera executada. O codigo local da versao 0.0.104 esta pronto para a criacao controlada, mas o ambiente permanece com escrita operacional bloqueada e feature flag desativada.
