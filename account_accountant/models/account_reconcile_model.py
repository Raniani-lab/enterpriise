# -*- coding: utf-8 -*-

from odoo import models, api


class AccountReconcileModel(models.Model):
    _inherit = "account.reconcile.model"

    @api.model
    def get_reconciliation_dict_for_widget(self, model_id, st_line, residual_balance):
        st_line = self.env['account.bank.statement.line'].browse(st_line)
        model = self.env['account.reconcile.model'].browse(model_id)
        new_aml_dicts = model._get_write_off_move_lines_dict(st_line, residual_balance=residual_balance)
        for line in new_aml_dicts:
            for m2o_name in ('account_id', 'journal_id', 'partner_id', 'analytic_account_id'):
                if line.get(m2o_name) and not isinstance(line[m2o_name], dict):
                    m2o_record = self.env[self.env['account.move.line']._fields[m2o_name].comodel_name].browse(line[m2o_name])
                    line[m2o_name] = {'display_name': m2o_record.display_name, 'id': m2o_record.id}
                    if m2o_name == 'account_id':
                        line['account_code'] = m2o_record.code
            for x2m_name in ('analytic_tag_ids', 'tax_ids', 'tag_ids'):
                if line.get(x2m_name) and not isinstance(line[x2m_name][0], dict):
                    x2m_records = self.env[self.env['account.move.line']._fields[x2m_name].comodel_name].browse(line[x2m_name][0][2])
                    line[x2m_name] = [{'display_name': r.display_name, 'id': r.id} for r in x2m_records]
            if 'reconcile_model_id' in line:
                line['to_check'] = self.env['account.reconcile.model'].browse(line['reconcile_model_id']).to_check
        return new_aml_dicts
