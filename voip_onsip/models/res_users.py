# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, fields


class ResUsers(models.Model):
    _inherit = 'res.users'

    onsip_auth_user = fields.Char("OnSIP authorization User", groups="base.group_user")

    @property
    def SELF_READABLE_FIELDS(self):
        return super().SELF_READABLE_FIELDS + ['onsip_auth_user']

    @property
    def SELF_WRITEABLE_FIELDS(self):
        return super().SELF_WRITEABLE_FIELDS + ['onsip_auth_user']

    def _neutralize(self):
        super()._neutralize()
        self.flush_model()
        self.invalidate_model()
        self.env.cr.execute("UPDATE res_users SET onsip_auth_user = 'dummy'")
