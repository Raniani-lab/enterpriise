# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _, api, fields, models
from odoo.exceptions import UserError


class ResCompany(models.Model):
    _inherit = 'res.company'

    l10n_hk_autopay = fields.Boolean(string="Payroll with HSBC Autopay payment")
    l10n_hk_autopay_type = fields.Selection(
        selection=[('h2h', "H2H Submission"), ('hsbcnet', "HSBCnet File Upload")],
        string="Autopay Type", help="H2H Submission: Directly submit to HSBC. HSBCnet File Upload: Upload file to HSBCnet.",
        default='h2h',
    )
    l10n_hk_autopay_partner_bank_id = fields.Many2one(string="Autopay Account", comodel_name='res.partner.bank', copy=False)
    l10n_hk_employer_name = fields.Char("Employer's Name shown on reports")
    l10n_hk_employer_file_number = fields.Char("Employer's File Number")
    l10n_hk_manulife_mpf_scheme = fields.Char("Manulife MPF Scheme", size=8)

    @api.constrains("l10n_hk_employer_file_number")
    def _check_l10n_hk_employer_file_number(self):
        for company in self:
            if company.l10n_hk_employer_file_number:
                file_number = company.l10n_hk_employer_file_number.strip()
                if len(file_number) != 12 or file_number[3] != '-':
                    raise UserError(_("The Employer's File Number must be in the format of XXX-XXXXXXXX."))
