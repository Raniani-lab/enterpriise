# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import SUPERUSER_ID, fields, models, _
from markupsafe import Markup


class ProposeChange(models.TransientModel):
    _name = 'propose.change'
    _description = 'Propose a change in the production'

    workorder_id = fields.Many2one(
        'mrp.workorder', 'Workorder', required=True, ondelete='cascade')
    step_id = fields.Many2one('quality.check', 'Step to change')
    note = fields.Html('New Instruction')
    comment = fields.Char('Comment')
    picture = fields.Binary('Picture')
    change_type = fields.Selection([
        ('update_step', 'Update Current Step'),
        ('remove_step', 'Remove Current Step'),
        ('set_picture', 'Set Picture')], 'Type of Change')

    def process(self):
        for wizard in self:
            if wizard.change_type == 'update_step':
                wizard._do_update_step()
            elif wizard.change_type == 'remove_step':
                wizard._do_remove_step()
            elif wizard.change_type == 'set_picture':
                wizard._do_set_picture()

    def _workorder_name(self):
        return self.env.user.name

    def _do_update_step(self):
        self.ensure_one()
        self.step_id.note = self.note
        if self.workorder_id.production_id.bom_id:
            message = _("<b>New Instruction suggested by %s</b><br/>"
                 "%s<br/>", self._workorder_name(), self.note)
            if self.comment:
                message += _("<b>Reason: %s</b>", self.comment)
            body = Markup(message)
            self.env['mail.activity'].sudo().create({
                'res_model_id': self.env.ref('mrp.model_mrp_bom').id,
                'res_id': self.workorder_id.production_id.bom_id.id,
                'user_id': self.workorder_id.product_id.responsible_id.id or SUPERUSER_ID,
                'activity_type_id': self.env.ref('mail.mail_activity_data_todo').id,
                'summary': _('BoM feedback %s (%s)', self.step_id.title, self.workorder_id.production_id.name),
                'note': body,
            })

    def _do_remove_step(self):
        self.ensure_one()
        bom = self.step_id.workorder_id.production_id.bom_id
        if bom:
            body = Markup(_("<b>%s suggests to delete this instruction</b>", self._workorder_name()))
            self.env['mail.activity'].sudo().create({
                'res_model_id': self.env.ref('mrp.model_mrp_bom').id,
                'res_id': bom.id,
                'user_id': self.workorder_id.product_id.responsible_id.id or SUPERUSER_ID,
                'activity_type_id': self.env.ref('mail.mail_activity_data_todo').id,
                'summary': _('BoM feedback %s (%s)', self.step_id.title, self.workorder_id.production_id.name),
                'note': body,
            })
        self.step_id.do_fail()

    def _do_set_picture(self):
        self.ensure_one()
        self.step_id.worksheet_document = self.picture
        bom = self.step_id.workorder_id.production_id.bom_id
        if bom:
            body = Markup(_("<b>%s suggests to use this document as instruction</b>", self._workorder_name()))
            self.env['mail.activity'].sudo().create({
                'res_model_id': self.env.ref('mrp.model_mrp_bom').id,
                'res_id': bom.id,
                'user_id': self.workorder_id.product_id.responsible_id.id or SUPERUSER_ID,
                'activity_type_id': self.env.ref('mail.mail_activity_data_todo').id,
                'summary': _('BoM feedback %s (%s)', self.step_id.title, self.workorder_id.production_id.name),
                'note': body,
            })
        self.env['ir.attachment'].create({
            'name': 'coucou',
            'res_id': bom.id,
            'res_model': bom._name,
            'datas': self.picture,
            'type': 'binary',
        })
