from odoo import fields, models
from .l10n_pe_edi_vehicle import ISSUING_ENTITY

class ResPartner(models.Model):
    _inherit = "res.partner"

    l10n_pe_edi_operator_license = fields.Char(
        string="Driver's License",
        help="This person's driver's license number, for generating the Delivery Guide.",
    )
    l10n_pe_edi_mtc_number = fields.Char(
        string="MTC Registration Number",
        help="The company's MTC registration number, for generating the Delivery Guide."
    )
    l10n_pe_edi_authorization_issuing_entity = fields.Selection(
        selection=ISSUING_ENTITY,
        string="Authorization Issuing Entity",
        help="The issuing entity of the company's special authorization number, for generating the Delivery Guide."
    )
    l10n_pe_edi_authorization_number = fields.Char(
        string="Authorization Number",
        help="The company's special authorization number, for generating the Delivery Guide.",
    )
