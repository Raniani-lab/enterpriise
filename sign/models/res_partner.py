# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _


class ResPartner(models.Model):
    _inherit = 'res.partner'

    signature_count = fields.Integer(compute='_compute_signature_count', string="# Signatures")

    def _compute_signature_count(self):
        signature_data = self.env['sign.request.item'].sudo().read_group([('partner_id', 'in', self.ids)], ['partner_id'], ['partner_id'])
        signature_data_mapped = dict((data['partner_id'][0], data['partner_id_count']) for data in signature_data)
        for partner in self:
            partner.signature_count = signature_data_mapped.get(partner.id, 0)

    def open_signatures(self):
        self.ensure_one()
        request_ids = self.env['sign.request.item'].search([('partner_id', '=', self.id)]).mapped('sign_request_id')
        return {
            'type': 'ir.actions.act_window',
            'name': _('Signature(s)'),
            'view_mode': 'kanban,tree,form',
            'res_model': 'sign.request',
            'domain': [('id', 'in', request_ids.ids)],
            'context': {
                'search_default_reference': self.name,
                'search_default_signed': 1,
                'search_default_in_progress': 1,
            },
        }

    def write(self, vals):
        partners_email_changed = self.filtered(lambda r: r.email != vals['email']) if 'email' in vals else None
        res = super(ResPartner, self).write(vals)
        if partners_email_changed:
            request_items = self.env['sign.request.item'].sudo().search([
                ('partner_id', 'in', partners_email_changed.ids),
                ('state', '=', 'sent'),
                ('is_mail_sent', '=', True)])
            request_items.sign_request_id.check_senders_validity()
            for request_item in request_items:
                request_item.sign_request_id.message_post(
                    body=_('The mail address of %(partner)s has been updated. The request will be automatically resent.',
                           partner=request_item.partner_id.name))
                self.env['sign.log']._create_log(request_item, 'update_mail', is_request=False)
                request_item.access_token = self.env['sign.request']._default_access_token()
                request_item.resend_sign_access()
        return res
