# coding: utf-8
from odoo import api, fields, models, _


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    l10n_co_edi_username = fields.Char(related='company_id.l10n_co_edi_username',
                                       string='Username')
    l10n_co_edi_password = fields.Char(related='company_id.l10n_co_edi_password',
                                       string='Password')
    l10n_co_edi_company = fields.Char(related='company_id.l10n_co_edi_company',
                                       string='Company ID')
    l10n_co_edi_account = fields.Char(related='company_id.l10n_co_edi_account',
                                      string='Account ID')
    l10n_co_edi_test_mode = fields.Boolean(related='company_id.l10n_co_edi_test_mode',
                                           string='Test mode')
    l10n_co_edi_header_gran_contribuyente = fields.Char(related='company_id.l10n_co_edi_header_gran_contribuyente',
                                                        string='Gran Contribuyente')
    l10n_co_edi_header_tipo_de_regimen = fields.Char(related='company_id.l10n_co_edi_header_tipo_de_regimen',
                                                     string='Tipo de Régimen')
    l10n_co_edi_header_retenedores_de_iva = fields.Char(related='company_id.l10n_co_edi_header_retenedores_de_iva',
                                                        string='Retenedores de IVA')
    l10n_co_edi_header_autorretenedores = fields.Char(related='company_id.l10n_co_edi_header_autorretenedores',
                                                      string='Autorretenedores')
    l10n_co_edi_header_resolucion_aplicable = fields.Char(related='company_id.l10n_co_edi_header_resolucion_aplicable',
                                                          string='Resolucion Aplicable')
    l10n_co_edi_header_actividad_economica = fields.Char(related='company_id.l10n_co_edi_header_actividad_economica',
                                                         string='Actividad Económica')
    l10n_co_edi_header_bank_information = fields.Text(related='company_id.l10n_co_edi_header_bank_information',
                                                      string='Bank Information')
