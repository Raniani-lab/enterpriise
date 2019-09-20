# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

import logging
import uuid

from odoo import api, fields, models

_logger = logging.getLogger(__name__)


class HrEmployee(models.Model):
    _inherit = 'hr.employee'
    _inherits = {'utm.source': 'utm_source_id'}

    utm_source_id = fields.Many2one('utm.source', 'Source', ondelete='cascade', required=True, groups="hr.group_hr_user")

    def _get_utm_name(self, name):
        if name:
            return ('%s-%s') % (name, str(uuid.uuid4())[:6])
        return str(uuid.uuid4())[:6]

    @api.model
    def create(self, vals):
        name = self._get_utm_name(vals['name'] if 'name' in vals else '')
        utm = self.env['utm.source'].sudo().create({'name': name})
        vals['utm_source_id'] = utm.id
        return super().create(vals)

    def _init_column(self, column_name):
        """ Create utm.campaign for already existing records """
        if column_name == "utm_source_id":
            _logger.debug("Table '%s': setting default value of new column %s to unique source for each row", self._table, column_name)
            self.env.cr.execute("SELECT id,name FROM %s WHERE utm_source_id IS NULL" % self._table)
            employee_ids = self.env.cr.dictfetchall()
            query_list = [{'id': e['id'], 'utm_source_id': self.env['utm.source'].create({'name': self._get_utm_name(e['name'])}).id} for e in employee_ids]
            query = 'UPDATE ' + self._table + ' SET utm_source_id = %(utm_source_id)s WHERE id = %(id)s;'
            self.env.cr._obj.executemany(query, query_list)
        else:
            super()._init_column(column_name)
