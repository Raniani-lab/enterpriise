# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, fields, models
from odoo.exceptions import UserError


class PaymentToken(models.Model):
    _inherit = 'payment.token'

    sdd_mandate_id = fields.Many2one(
        string="SEPA Direct Debit Mandate", comodel_name='sdd.mandate', readonly=True,
        ondelete='set null')
