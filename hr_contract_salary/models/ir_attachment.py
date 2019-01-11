# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, models
from odoo.osv import expression


class IrAttachment(models.Model):
    _inherit = ['ir.attachment']

    @api.model
    def read_group(self, domain, fields, groupby, offset=0, limit=None, orderby=False, lazy=True):
        """
        The binary contents should be displayed as attachment on the chatter
        without being real attachments though, as it is the content of a binary
        field.
        """
        for elem in domain:
            if elem[0] == 'res_model' and elem[1] == '=' and elem[2] == 'hr.employee':
                domain = expression.AND([domain, ['|', ('res_field', '=', False), ('res_field', '!=', False)]]) 
                break
        return super().read_group(domain=domain, fields=fields, groupby=groupby, offset=offset, limit=limit, orderby=orderby, lazy=lazy)

    @api.model
    def _search(self, args, offset=0, limit=None, order=None, count=False, access_rights_uid=None):
        """
        The binary contents should be displayed as attachment on the chatter
        without being real attachments though, as it is the content of a binary
        field.
        """
        for elem in args:
            if elem[0] == 'res_model' and elem[1] == '=' and elem[2] == 'hr.employee':
                args = expression.AND([args, ['|', ('res_field', '=', False), ('res_field', '!=', False)]]) 
                break
        return super()._search(args=args, offset=offset, limit=limit, order=order, count=count, access_rights_uid=access_rights_uid)
