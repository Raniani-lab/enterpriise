# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models, _
from odoo.exceptions import ValidationError


class AccountMove(models.Model):
    _inherit = 'account.move'

    def _post(self, soft=True):
        res = super(AccountMove, self)._post(soft)  # super post before as date may change at post

        for move in self:
            if move.is_invoice():
                errors = []
                not_in_use = []
                expired = []

                # sudo() because only advisors have access to intrastat codes. We want the check to be run for everyone able to post.
                for intra_trans in move.line_ids.sudo().intrastat_transaction_id:
                    if intra_trans.start_date and intra_trans.start_date > move.date:
                        not_in_use.append(f' code {intra_trans.code}')
                    if intra_trans.expiry_date and intra_trans.expiry_date <= move.date:
                        expired.append(f' code {intra_trans.code}')

                if not_in_use:
                    errors.append(_("Some intrastat codes are not in use at this invoice's date:%s", ','.join(not_in_use)))
                if expired:
                    errors.append(_("Some intrastat codes are expired at this invoice's date:%s", ','.join(expired)))

                if errors:
                    raise ValidationError('\n'.join(errors))

        return res
