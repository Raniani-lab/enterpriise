# -*- coding:utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, models

class Note(models.Model):
    _inherit = 'note.note'

    def action_add_follower(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.act_window',
            'res_model': 'mail.wizard.invite',
            'view_mode': 'form',
            'name': _('Invite Follower'),
            'target': 'new',
            'context': {
                'default_res_model': 'note.note',
                'default_res_id': self.id,
            },
        }
