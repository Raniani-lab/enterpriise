# -*- coding: utf-8 -*-

from odoo import api, fields, models, _


class AccountMove(models.Model):
    _inherit = "account.move"

    @api.multi
    def _get_request_document_actions(self):
        actions = []
        view_id = self.env.ref('documents.documents_request_form_view').id
        for record in self:
            for line in record.line_ids:
                reconcile_model = line.reconcile_model_id
                if reconcile_model and reconcile_model.activity_type_id:
                    activity = reconcile_model.activity_type_id
                    if activity and activity.category == 'upload_file':
                        actions.append({
                            'type': 'ir.actions.act_window',
                            'res_model': 'documents.request_wizard',
                            'name': "Request Document for %s" % line.name,
                            'view_id': view_id,
                            'views': [(view_id, 'form')],
                            'target': 'new',
                            'view_mode': 'form',
                            'context': {'default_res_model': 'account.move.line',
                                        'default_res_id': line.id,
                                        'default_name': line.name,
                                        'default_activity_type_id': activity.id}
                        })
        return actions


class AccountMoveLine(models.Model):
    _inherit = "account.move.line"

    reconciliation_invoice_id = fields.One2many('account.invoice', 'reconciliation_move_line_id')
