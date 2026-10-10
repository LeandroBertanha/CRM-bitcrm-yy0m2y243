migrate(
  (app) => {
    // 1. Atualizar produtos (coleção products)
    try {
      const products = app.findRecordsByFilter(
        'products',
        'is_active = true',
        'display_order',
        100,
        0,
      )
      for (const prod of products) {
        prod.set('setup_value', 350)
        prod.set('commission_base_type', 'setup')
        prod.set(
          'commission_rules_note',
          'A comissão incide EXCLUSIVAMENTE sobre o setup (a partir de R$ 350,00). A mensalidade de R$ 55,00/mês NUNCA entra na base de comissão.',
        )
        app.save(prod)
      }
    } catch (err) {
      console.log('Erro ao atualizar products:', err)
    }

    // 2. Atualizar faixas de comissão (coleção commission_tiers)
    // Faixa 1 (1 a 4): 20% -> 70,00
    // Faixa 2 (5 a 9): 25% -> 87,50
    // Faixa 3 (10 ou mais): 30% -> 105,00
    try {
      const tiers = app.findRecordsByFilter(
        'commission_tiers',
        'is_active = true',
        'display_order',
        10,
        0,
      )
      for (const tier of tiers) {
        const minS = tier.getInt('min_sales')
        const maxS = tier.getInt('max_sales')

        if (minS === 1 && maxS === 4) {
          tier.set('percentage', 0.2)
          tier.set('commission_per_sale', 70)
          app.save(tier)
        } else if (minS === 5 && maxS === 9) {
          tier.set('percentage', 0.25)
          tier.set('commission_per_sale', 87.5)
          app.save(tier)
        } else if (minS >= 10 || maxS === 0) {
          tier.set('percentage', 0.3)
          tier.set('commission_per_sale', 105)
          app.save(tier)
        }
      }
    } catch (err) {
      console.log('Erro ao atualizar commission_tiers:', err)
    }

    // 3. Atualizar configurações de comissão (coleção commission_settings)
    try {
      const settingsList = app.findRecordsByFilter(
        'commission_settings',
        'is_active = true',
        'created',
        10,
        0,
      )
      for (const setting of settingsList) {
        setting.set('base_sale_value', 350)
        setting.set(
          'hosting_note',
          'A comissão incide EXCLUSIVAMENTE sobre o setup (a partir de R$ 350,00). A mensalidade de R$ 55,00/mês referente a hospedagem, suporte e manutenção NUNCA entra na base de comissão.',
        )
        setting.set(
          'essential_rules',
          JSON.stringify([
            'A comissão incide exclusivamente sobre o setup inicial negociado (a partir de R$ 350,00).',
            'A mensalidade de R$ 55,00/mês NUNCA integra a base de comissão.',
            'A faixa de comissão é definida pela quantidade total de vendas no mês (1-4 vendas: 20% = R$ 70; 5-9 vendas: 25% = R$ 87,50; 10+ vendas: 30% = R$ 105).',
            'Cálculo proporcional para setups negociados acima de R$ 350,00 (ex: setup de R$ 500,00 na Faixa 1 = R$ 100,00).',
          ]),
        )
        setting.set(
          'detailed_rules',
          JSON.stringify([
            {
              rule: '1. Base de Cálculo Exclusiva',
              description:
                'A comissão incide exclusivamente sobre o setup (a partir de R$ 350,00). A mensalidade de R$ 55,00/mês nunca entra na base de cálculo.',
            },
            {
              rule: '2. Faixas Progressivas de Vendas',
              description:
                'Faixa 1 (1-4 vendas): 20% (R$ 70,00 por venda base); Faixa 2 (5-9 vendas): 25% (R$ 87,50); Faixa 3 (10+ vendas): 30% (R$ 105,00).',
            },
            {
              rule: '3. Proporcionalidade Acima do Piso',
              description:
                'Para contratos fechados com setup superior a R$ 350,00 (ex: R$ 500, R$ 1.000, R$ 2.500), a comissão sobe proporcionalmente mantendo a taxa da faixa atingida.',
            },
          ]),
        )
        app.save(setting)
      }
    } catch (err) {
      console.log('Erro ao atualizar commission_settings:', err)
    }

    // 4. Atualizar Playbook Values (coleção playbook_values)
    try {
      const pValues = app.findRecordsByFilter(
        'playbook_values',
        'is_active = true',
        'created',
        10,
        0,
      )
      for (const pv of pValues) {
        pv.set('creation_value', 350)
        const currentScript = pv.getString('script')
        if (currentScript.includes('500')) {
          const updatedScript = currentScript
            .replace(/começa em R\$ 500,00/g, 'começa a partir de R$ 350,00')
            .replace(/R\$ 500,00 em valor único/g, 'a partir de R$ 350,00 em setup único')
            .replace(/R\$ 500,00/g, 'a partir de R$ 350,00')
          pv.set('script', updatedScript)
        }
        app.save(pv)
      }
    } catch (err) {
      console.log('Erro ao atualizar playbook_values:', err)
    }

    // 5. Atualizar Playbook Scripts (coleção playbook_scripts)
    try {
      const scripts = app.findRecordsByFilter(
        'playbook_scripts',
        'is_active = true',
        'display_order',
        100,
        0,
      )
      for (const sc of scripts) {
        let text = sc.getString('script_text')
        let changed = false
        if (text.includes('500')) {
          text = text
            .replace(/a partir de R\$ 500,00/g, 'a partir de R$ 350,00')
            .replace(/começa em R\$ 500,00/g, 'começa a partir de R$ 350,00')
            .replace(/R\$ 500,00/g, 'a partir de R$ 350,00')
          sc.set('script_text', text)
          changed = true
        }
        let inst = sc.getString('instructions')
        if (inst.includes('500')) {
          inst = inst.replace(/500/g, '350')
          sc.set('instructions', inst)
          changed = true
        }
        if (changed) {
          app.save(sc)
        }
      }
    } catch (err) {
      console.log('Erro ao atualizar playbook_scripts:', err)
    }

    // 6. Atualizar Playbook Objections (coleção playbook_objections)
    try {
      const objections = app.findRecordsByFilter(
        'playbook_objections',
        'is_active = true',
        'display_order',
        100,
        0,
      )
      for (const ob of objections) {
        let changed = false
        let treatment = ob.getString('treatment_script')
        if (treatment.includes('500')) {
          treatment = treatment
            .replace(/Por R\$ 500,00 de setup único/g, 'Com setup a partir de R$ 350,00')
            .replace(/R\$ 500,00/g, 'a partir de R$ 350,00')
            .replace(/500 único/g, 'a partir de R$ 350,00 de setup')
          ob.set('treatment_script', treatment)
          changed = true
        }
        let subRaw = ob.getString('sub_scenarios')
        if (subRaw && subRaw.includes('500')) {
          subRaw = subRaw.replace(/R\$ 500,00/g, 'a partir de R$ 350,00').replace(/500/g, '350')
          ob.set('sub_scenarios', subRaw)
          changed = true
        }
        if (changed) {
          app.save(ob)
        }
      }
    } catch (err) {
      console.log('Erro ao atualizar playbook_objections:', err)
    }

    // 7. Atualizar Playbook Arguments (coleção playbook_arguments)
    try {
      const argsList = app.findRecordsByFilter(
        'playbook_arguments',
        'is_active = true',
        'display_order',
        100,
        0,
      )
      for (const arg of argsList) {
        let text = arg.getString('argument_text')
        if (text.includes('500')) {
          text = text
            .replace(/criação a partir de R\$ 500,00/g, 'criação a partir de R$ 350,00')
            .replace(/setup único de R\$ 500,00/g, 'setup a partir de R$ 350,00')
            .replace(/R\$ 500,00/g, 'a partir de R$ 350,00')
          arg.set('argument_text', text)
          app.save(arg)
        }
      }
    } catch (err) {
      console.log('Erro ao atualizar playbook_arguments:', err)
    }

    // 8. Atualizar Playbook Answers (coleção playbook_answers)
    try {
      const answersList = app.findRecordsByFilter(
        'playbook_answers',
        'display_order > 0',
        'display_order',
        100,
        0,
      )
      for (const ans of answersList) {
        let recArg = ans.getString('recommended_argument')
        let changed = false
        if (recArg.includes('500')) {
          recArg = recArg
            .replace(/por R\$ 500,00 único/g, 'a partir de R$ 350,00 de setup')
            .replace(/setup é de R\$ 500,00/g, 'setup é a partir de R$ 350,00')
            .replace(/R\$ 500,00/g, 'a partir de R$ 350,00')
          ans.set('recommended_argument', recArg)
          changed = true
        }
        let ansText = ans.getString('answer_text')
        if (ansText.includes('500')) {
          ansText = ansText.replace(/500/g, '350')
          ans.set('answer_text', ansText)
          changed = true
        }
        if (changed) {
          app.save(ans)
        }
      }
    } catch (err) {
      console.log('Erro ao atualizar playbook_answers:', err)
    }
  },
  (app) => {
    // Rollback opcional: não reverter destructive
  },
)
