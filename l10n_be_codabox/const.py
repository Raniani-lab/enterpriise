# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import _lt, _

CODABOX_ERROR_CODES = {
    "error_codabox_not_configured": _lt("Codabox is not configured. Please check your configuration."),
    "error_connecting_iap": _lt("Error while connecting to the IAP server. Please contact Odoo support."),
    "error_missing_parameters": _lt("Missing parameters in the request to IAP. Please contact Odoo support."),
    "error_fidu_registered_no_iap_token": _lt("It seems that you have already registered this fiduciary. You must reuse the same access token to connect to Codabox."),
    "error_fidu_registered_invalid_iap_token": _lt("The provided access token is not valid for this fiduciary. Please check your configuration."),
    "error_connecting_codabox": _lt("Error while connecting to Codabox. Please contact Odoo support."),
    "error_connection_not_found": _lt("It seems that no connection linked to your database/VAT number exists. Please check your configuration."),
    "error_consent_not_valid": _lt("It seems that your Codabox consent is not valid anymore.  Please check your configuration."),
    "error_file_not_found": _lt("No files were found. Please check your configuration."),
}

DEFAULT_IAP_ENDPOINT = "https://l10n_be_codabox.api.odoo.com/api/l10n_be_codabox/1"

def get_error_msg(error_code):
    return CODABOX_ERROR_CODES.get(error_code, _("Unknown error %s while fetching files from Codabox. Please contact Odoo support.") % error_code)

def get_iap_endpoint(env):
    return env["ir.config_parameter"].sudo().get_param("l10n_be_codabox.iap_endpoint", DEFAULT_IAP_ENDPOINT)
