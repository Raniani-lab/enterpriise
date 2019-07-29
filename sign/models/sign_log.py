# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import fields, models, _
from odoo.exceptions import ValidationError
from odoo.http import request


class SignLog(models.Model):
    _name = 'sign.log'
    _order = 'log_date, id'
    _description = "Sign requests access history"

    sign_request_id = fields.Many2one('sign.request', required=True)
    # sign_template_id = fields.Many2one('sign.template', related='sign_request_id.template_id')
    sign_request_item_id = fields.Many2one('sign.request.item')

    # Accessed as ?
    # TODO when no user/partner : print Anonymous in report.
    user_id = fields.Many2one('res.users', groups="sign.group_sign_manager")  # TODO do we need the user when we have the partner?
    partner_id = fields.Many2one('res.partner')

    # Accessed on ?
    log_date = fields.Datetime(default=lambda self: fields.Datetime.now(), required=True)

    # Accessed from ?
    # If defined on request item when signing: take from it
    # Else : taken from geoip
    latitude = fields.Float(digits=(10, 7), groups="sign.group_sign_manager")
    longitude = fields.Float(digits=(10, 7), groups="sign.group_sign_manager")
    IP = fields.Char("IP address of the visitor", required=True, groups="sign.group_sign_manager")

    # Accessed for ?
    action = fields.Selection(
        string="Action Performed",
        selection=[
            ('create', 'Creation'),
            ('open', 'Opening and/or Download'),
            ('sign', 'Signature'),
        ],
    )
    """
    Do we want to distinguish public request creation and backend ?
    For the moment, creation logs are only saved for public creation (through controller).
    """

    request_state = fields.Selection([
        ("sent", "Signatures in Progress"),
        ("signed", "Fully Signed"),
        ("canceled", "Canceled")
    ], required=True, string="State of the request on action log", groups="sign.group_sign_manager")
    # Not related on purpose :P

    def write(self, vals):
        raise ValidationError(_("Log history of sign requests cannot be modified !"))

    def _prepare_vals_from_item(self, request_item):
        request = request_item.sign_request_id
        return dict(
            sign_request_item_id=request_item.id,
            sign_request_id=request.id,
            request_state=request.state,
            latitude=request_item.latitude,
            longitude=request_item.longitude,
            partner_id=request_item.partner_id.id)

    def _prepare_vals_from_request(self, sign_request):
        return dict(
            sign_request_id=sign_request.id,
            request_state=sign_request.state,
        )

    def _update_vals_with_http_request(self, vals):
        vals.update({
            'user_id': request.env.user.id if not request.env.user._is_public() else None,
            'IP': request.httprequest.remote_addr,
        })
        if not vals.get('partner_id', False):
            vals.update({
                'partner_id': request.env.user.partner_id.id if not request.env.user._is_public() else None
            })
        if 'geoip' in request.session:
            vals.update({
                'latitude': request.session['geoip'].get('latitude'),
                'longitude': request.session['geoip'].get('longitude'),
            })
        return vals