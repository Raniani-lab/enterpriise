# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from hashlib import sha256
from json import dumps
from datetime import datetime
import logging

from odoo import fields, models, api, _
from odoo.exceptions import ValidationError, UserError
from odoo.http import request

_logger = logging.getLogger()

LOG_FIELDS = ['log_date', 'action', 'partner_id', 'request_state', 'latitude', 'longitude', 'IP',]


class SignLog(models.Model):
    _name = 'sign.log'
    _order = 'log_date, id'
    _description = "Sign requests access history"

    sign_request_id = fields.Many2one('sign.request', required=True)
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
    log_hash = fields.Char(string="Inalterability Hash", readonly=True, copy=False)
    string_to_hash =fields.Char() # fields.Char(store=False)
    integrity_check = fields.Boolean(store=False)

    # Accessed for ?
    action = fields.Selection(
        string="Action Performed",
        selection=[
            ('create', 'Creation'),
            ('open', 'Opening and/or Download'),
            ('sign', 'Signature'),
            ('check', 'Check'),
        ], required=True,
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

    def unlink(self):
        raise ValidationError(_("Log history of sign requests cannot be deleted !"))

    def create(self, vals):
        """
        1/ if action=='create': get iniital shasign from template (checksum pdf)
        2/ if action == 'sign': search for logs with hash for the same request and use that to compute new hash
        """
        vals['log_date'] = datetime.utcnow()
        if vals['action'] == 'create':
            sign_request = self.env['sign.request'].browse(vals['sign_request_id'])
            vals['log_hash'] = sha256(sign_request.template_id.datas).hexdigest()
        elif vals['action'] == 'sign':
            vals['log_hash'] = self._get_new_hash(vals)
            del vals['token']
        res = super(SignLog, self).create(vals)
        return res

        # ----------------------

    def _get_new_hash(self, vals):
        """ Returns the hash to write on sign log entries """
        # get the previous activity
        # check if sign logs already exists for this sign_request
        if 'check_id' in vals:
            prev_activity = self.sudo().search([('sign_request_id', '=', vals['sign_request_id']),
                                                ('id', '<', vals['check_id'])], limit=1, order='id desc')
        else:
            prev_activity = self.sudo().search([('sign_request_id', '=', vals['sign_request_id']),
                                                ], limit=1, order='id desc')
        if not prev_activity:
            raise UserError(
                _(
                    'An error occurred when computing the hash. Impossible to get the unique previous activity.'))
        # build and return the hash
        return self._compute_hash(prev_activity.log_hash, vals)

    def _compute_hash(self, previous_hash, vals):
        """ Computes the hash of the browse_record given as self, based on the hash
        of the previous record in the company's securisation sequence given as parameter"""
        if vals['action'] in ['sign', 'check']:
            string_to_hash = self._compute_string_to_hash(vals)
            hash_string = sha256((str(previous_hash) + string_to_hash).encode('utf-8'))
            return hash_string.hexdigest()
        else:
            return False

    def _compute_string_to_hash(self, vals):
        def _getattrstring(vals, field_str):
            field_value = vals[field_str]
            return str(field_value)
        values = {}
        for field in LOG_FIELDS:
            values[field] = _getattrstring(vals, field)
        context_check = vals.get('check', False)
        # Values are filtered based on the token
        if context_check:
            request_items_ids = self.browse(vals['check_id']).sign_request_id.request_item_ids.filtered(lambda item: item.access_token == vals['token'])
        else:
            # Signer is signing the document. We save the value of its field. self is an empty recorset.
            request_items_ids = self.env['sign.request'].browse(vals['sign_request_id']).request_item_ids.filtered(lambda item: item.access_token == vals['token'])

        for request_item in request_items_ids:
            for signature_value in request_item.sign_item_value_ids:
                values[str(signature_value.id)] = str(signature_value.value)
        vals['string_to_hash'] = dumps(values, sort_keys=True,
                                       ensure_ascii=True, indent=None,
                                       separators=(',', ':'))
        return vals['string_to_hash']

    def _check_document_integrity(self):
        """
        Check the integrity of a sign request by comparing the logs hash to the computed values.
        """
        sha_pdf = sha256(self.sign_request_id.template_id.attachment_id.datas).hexdigest()
        logs = self.filtered(lambda item: item.action in ['sign', 'create'])
        verified_hashes = []
        for log in logs:
            if log.action == "create":
                if log.log_hash == sha_pdf:
                    verified_hashes.append(log.log_hash)
                    continue
                else:
                    log.integrity_check = False
                    msg = f'An error occurred when computing the hash {id}. Something went wrong.\nINVALID HASH: {log.log_hash}'
                    raise UserError(_(msg))
            elif log.action == "sign":
                request_items_ids = log.sign_request_id.request_item_ids
                for request_item_id in request_items_ids:
                    vals = {'sign_request_id': log.sign_request_id.id,
                            'sign_request_item_id': log.sign_request_item_id.id,
                            'user_id': log.user_id.id,
                            'log_date': log.log_date,
                            'string_to_hash': log.string_to_hash,
                            'IP': log.IP,
                            'latitude': log.latitude,
                            'longitude': log.longitude,
                            'action': log.action,
                            'partner_id': log.partner_id.id,
                            'request_state': log.request_state,
                            'check_id': log.id,
                            'log_hash': log.log_hash,
                            'check': 'check',
                            'token': request_item_id.access_token
                            }
                    if log.log_hash == self._get_new_hash(vals):
                        verified_hashes.append(log.log_hash)
                        msg = f"Coherent Hash for request_id: {log.sign_request_id.id} : Log {log.id}"
                        _logger.info(msg)

        if len(verified_hashes) < len(logs):
            print(verified_hashes)
            msg = 'An error occurred when computing the hash. Something went wrong.\n'
            log.sign_request_id.integrity = False
            raise UserError(_(msg))
        else:
            msg = "The Activity log is coherent with the values. :-)"
            _logger.info(msg)

    def _prepare_vals_from_item(self, request_item):
        request = request_item.sign_request_id
        return dict(
            sign_request_item_id=request_item.id,
            sign_request_id=request.id,
            request_state=request.state,
            latitude=request_item.latitude or 0.0,
            longitude=request_item.longitude or 0.0,
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
                'latitude': request.session['geoip'].get('latitude') or 0.0,
                'longitude': request.session['geoip'].get('longitude') or 0.0,
            })
        return vals
