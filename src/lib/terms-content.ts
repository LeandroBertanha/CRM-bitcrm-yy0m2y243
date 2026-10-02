/**
 * Termos de Serviço e Política de Privacidade da bit Consulting
 * Específicos para a operação de criação de sites, landing pages e uso do bitCRM.
 */

export const CURRENT_TERMS_VERSION = '2025.1'
export const TERMS_LAST_UPDATED = '02 de outubro de 2025'

export interface TermsSection {
  id: string
  title: string
  content: string[]
}

export const TERMS_OF_SERVICE: TermsSection[] = [
  {
    id: 'objeto',
    title: '1. Objeto e Escopo dos Serviços',
    content: [
      'Estes Termos de Serviço regulam o acesso e a utilização dos sistemas internos da bit Consulting (incluindo o bitCRM) pela equipe comercial e parceiros, bem como as diretrizes contratuais vigentes na comercialização e entrega de projetos digitais.',
      'A bit Consulting atua no desenvolvimento estratégico e técnico de Landing Pages de alta conversão e Sites Institucionais responsivos, combinando design profissional, redação comercial persuasiva, infraestrutura em nuvem e suporte operacional contínuo.',
    ],
  },
  {
    id: 'valores-e-condicoes',
    title: '2. Valores, Planos e Condições Comerciais',
    content: [
      'Projetos de criação: os projetos de desenvolvimento de Sites Institucionais e Landing Pages são comercializados a partir de R$ 500,00 (quinhentos reais) no plano base, variando conforme a complexidade técnica e escopo personalizado aprovado na proposta comercial.',
      'Mensalidade de suporte e infraestrutura: os serviços incluem mensalidade operacional no valor de R$ 55,00/mês (cinquenta e cinco reais mensais), que contempla:',
      '• Hospedagem de alta performance em servidores gerenciados e seguros;',
      '• Registro ou renovação de 1 (um) domínio anual (.com.br ou .com) conforme disponibilidade;',
      '• Certificado de segurança SSL (HTTPS) com renovação automática;',
      '• Suporte técnico contínuo para manutenção corretiva, monitoramento de disponibilidade (uptime) e ajustes operacionais básicos de conteúdo.',
      'O não pagamento da mensalidade de suporte e infraestrutura enseja a suspensão temporária dos serviços de hospedagem e redirecionamentos após aviso prévio formal.',
    ],
  },
  {
    id: 'prazos-e-entregas',
    title: '3. Prazos, Homologação e Garantia',
    content: [
      'O prazo padrão para apresentação da primeira versão funcional é de até 5 (cinco) a 10 (dez) dias úteis após o recebimento completo do briefing, identidade visual e materiais indispensáveis fornecidos pelo cliente.',
      'O cliente terá prazo de até 7 (sete) dias corridos para homologar ou solicitar ajustes de alinhamento com base no briefing acordado.',
      'Garantia de estabilidade: a bit Consulting assegura a integridade técnica, compatibilidade responsiva (mobile e desktop) e correção sem custo adicional de eventuais inconsistências decorrentes do desenvolvimento inicial.',
    ],
  },
  {
    id: 'uso-crm',
    title: '4. Uso Interno do bitCRM pela Equipe Comercial',
    content: [
      'O bitCRM é uma ferramenta de trabalho de propriedade e uso estrito da bit Consulting e de seus consultores e vendedores devidamente autorizados.',
      'O usuário se compromete a zelar pelo sigilo e confidencialidade de suas credenciais de acesso, sendo estritamente proibido o compartilhamento de login ou a extração não autorizada de dados da base comercial.',
      'Todos os dados de oportunidades, contatos comerciais, anotações de negociação e métricas inseridos no sistema são de propriedade exclusiva da bit Consulting e protegidos por sigilo profissional e industrial.',
    ],
  },
  {
    id: 'cancelamento',
    title: '5. Cancelamento e Migração',
    content: [
      'O plano de suporte e hospedagem de R$ 55,00/mês não possui fidelidade forçada após a liquidação do projeto inicial, podendo ser cancelado mediante notificação prévia de 30 (trinta) dias.',
      'Em caso de cancelamento da mensalidade, o cliente terá direito ao fornecimento dos arquivos estáticos finais e liberação do código de transferência (auth-code) do domínio registrado em seu nome, mediante regularidade financeira.',
    ],
  },
]

export const PRIVACY_POLICY: TermsSection[] = [
  {
    id: 'lgpd-compromisso',
    title: '1. Conformidade com a LGPD (Lei 13.709/2018)',
    content: [
      'A bit Consulting assume o compromisso irrevogável de cumprir a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 - LGPD), implementando medidas técnicas e organizacionais adequadas para garantir a confidencialidade, integridade e segurança de todos os dados tratados.',
    ],
  },
  {
    id: 'dados-coletados',
    title: '2. Dados Tratados e Finalidade',
    content: [
      'Tratamos dados em dois contextos operacionais distintos:',
      'a) Usuários do bitCRM (consultores, equipe de vendas e administradores): coletamos nome, e-mail corporativo, logs de acesso, registros de atividades comerciais e registros de consentimento deste termo, para fins de autenticação segura, auditoria de segurança e gestão operacional interna.',
      'b) Leads e Clientes (via formulários de captação e negociações comerciais): coletamos nome do responsável, nome da empresa, e-mail, telefone/WhatsApp, interesse contratual (Site ou Landing Page), valor de serviço e anotações pertinentes à elaboração da proposta e cumprimento pré-contratual.',
      'Não coletamos nem solicitamos dados sensíveis (origem racial, convicção religiosa, dados biométricos ou de saúde) em nenhuma fase da nossa esteira comercial.',
    ],
  },
  {
    id: 'bases-legais',
    title: '3. Bases Legais do Tratamento',
    content: [
      'O tratamento de dados pessoais pela bit Consulting fundamenta-se nas seguintes bases legais do art. 7º da LGPD:',
      '• Execução de contrato ou procedimentos preliminares relacionados a contrato do qual seja parte o titular (Art. 7º, V);',
      '• Cumprimento de obrigação legal ou regulatória (Art. 7º, II), inclusive guarda de registros nos termos do Marco Civil da Internet;',
      '• Legítimo interesse do controlador (Art. 7º, IX) para aprimoramento da segurança e suporte técnico aos clientes e consultores;',
      '• Consentimento expresso e inequívoco do titular (Art. 7º, I) quando aplicável.',
    ],
  },
  {
    id: 'compartilhamento-e-seguranca',
    title: '4. Compartilhamento Restrito e Segurança da Informação',
    content: [
      'A bit Consulting não comercializa, aluga ou compartilha dados pessoais com terceiros para fins publicitários alheios.',
      'O compartilhamento restringe-se estritamente aos provedores de infraestrutura técnica necessários para a entrega dos serviços (ex: provedores de hospedagem em nuvem com criptografia em trânsito e em repouso, entidades registradoras de domínio como Registro.br e gateways de cobrança autorizados).',
      'Adotamos políticas rígidas de controle de acesso, senhas com requisitos criptográficos e sessões autenticadas.',
    ],
  },
  {
    id: 'direitos-titular',
    title: '5. Direitos do Titular de Dados',
    content: [
      'Nos termos do art. 18 da LGPD, o titular de dados possui o direito de solicitar a qualquer momento:',
      '• Confirmação da existência de tratamento e acesso aos dados;',
      '• Correção de dados incompletos, inexatos ou desatualizados;',
      '• Anonimização, bloqueio ou eliminação de dados desnecessários ou tratados em desconformidade;',
      '• Portabilidade dos dados ou revogação de consentimento quando aplicável.',
    ],
  },
  {
    id: 'encarregado-contato',
    title: '6. Encarregado pelo Tratamento de Dados (DPO) e Contato',
    content: [
      'Para exercer seus direitos de titular, esclarecer dúvidas sobre estes termos ou registrar apontamentos de privacidade, entre em contato direto com a administração e Encarregado pelo Tratamento de Dados da bit Consulting:',
      '• Responsável: Leandro Bertanha',
      '• E-mail direto: leandro.bertanha@lbertanha.com',
      '• Site oficial: https://lbertanha.com',
      'As solicitações serão analisadas e respondidas nos prazos legalmente previstos.',
    ],
  },
]
