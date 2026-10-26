# bitCRM - Expansão do Comissionamento SaaS

Versão: 0.0.106

## Resumo

A entrega expande `/comissionamento` sem substituir o módulo existente. As comissões atuais continuam na aba original e a categoria SaaS foi adicionada em áreas independentes: visão geral, lista, simulador, políticas e histórico.

## Implementado

- Política padrão versionada com seis faixas de comissão.
- Exceções percentuais ou fixas por vendedor e por tipo de comissão.
- Quatro modelos de hospedagem, sem alterar a faixa de desenvolvimento.
- Recorrência limitada aos meses elegíveis da política (três na política inicial).
- Simulação em centavos inteiros, com desconto, custos de desenvolvimento, custo recorrente mensal, tributos, margem e aprovação.
- Plano de recebíveis do desenvolvimento e da recorrência.
- Liberação proporcional e idempotente após recebimento confirmado.
- Estados de aprovação, recebimento, liberação, pagamento, cancelamento e estorno.
- Auditoria append-only dos eventos financeiros.
- Vendedor restrito às próprias comissões; ações financeiras e políticas restritas ao administrador.
- Vínculo opcional com oportunidade e bloqueio de comissão ativa duplicada.

## Segurança

As coleções financeiras não aceitam escrita direta pelo navegador após a migração `0038`. Todas as mutações passam por `POST /backend/v1/commissions/saas/{action}`, que usa o usuário autenticado, recalcula valores no servidor e executa operações relacionadas dentro de transação.

O identificador de ator enviado pelo frontend não é usado como fonte de autorização. Aprovação, recebimento, pagamento, cancelamento, estorno, políticas e exceções exigem administrador no backend.

## Migrações

- `0034` a `0037`: coleções SaaS aditivas e política inicial.
- `0038`: bloqueio de escritas financeiras diretas.
- `0039`: campo opcional `recurring_costs_cents` em `saas_commissions`.

Nenhuma migração altera ou exclui oportunidades, comissões legadas, clientes, vendedores ou históricos existentes.

## Publicação controlada

1. Gerar backup/snapshot do banco PocketBase da produção.
2. Sincronizar o commit exato no Skip.
3. Aplicar as migrações e confirmar a existência das seis coleções `saas_*`.
4. Entrar com administrador e validar a política ativa v1.
5. Simular sem gravar os limites de R$ 3.000,00 e R$ 3.000,01.
6. Criar uma comissão de teste sem oportunidade real.
7. Confirmar uma parcela, recarregar a página e validar liberação e histórico.
8. Validar com vendedor que políticas e ações administrativas não estão disponíveis.
9. Só então liberar o fluxo para operação real.

## Rollback

Se houver erro antes de registros SaaS reais, reverter a publicação para o commit anterior e restaurar o snapshot do PocketBase. Se já houver registros SaaS reais, não executar o `down` das migrações: voltar apenas o frontend/hook e preservar as coleções para auditoria e correção posterior.

## QA

- Testes direcionados de cálculo e segurança: 14 aprovados.
- TypeScript: aprovado.
- Lint: aprovado sem erros; permanecem avisos antigos fora do escopo.
- Build de produção: aprovado.
- Suíte completa: 251 testes aprovados e 32 falhas preexistentes fora do módulo, incluindo dependências de DOM ausente, backend interno indisponível e expectativas antigas de outros fluxos.

## Limitações atuais

O CRM não possui estruturas independentes de proposta e contrato para relacionar sem duplicação. O vínculo seguro implementado usa a oportunidade existente. Esses relacionamentos devem ser adicionados apenas quando houver entidades próprias no modelo de dados.
