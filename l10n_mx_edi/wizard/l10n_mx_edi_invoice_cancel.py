from odoo import _, api, fields, models, Command
from odoo.addons.l10n_mx_edi.models.account_move import INVOICE_CANCELLATION_REASON_SELECTION, INVOICE_CANCELLATION_REASON_DESCRIPTION
from odoo.exceptions import UserError


class L10nMxEdiInvoiceCancel(models.TransientModel):
    _name = 'l10n_mx_edi.invoice.cancel'
    _description = "Request Invoice Cancellation"

    invoice_ids = fields.Many2many(comodel_name='account.move')
    has_substituted_invoices = fields.Boolean(compute='_compute_has_substituted_invoices')
    cancellation_reason = fields.Selection(
        selection=INVOICE_CANCELLATION_REASON_SELECTION,
        string="Reason",
        default='01',
        required=True,
        help=INVOICE_CANCELLATION_REASON_DESCRIPTION,
    )

    @api.depends('invoice_ids')
    def _compute_has_substituted_invoices(self):
        for wizard in self:
            wizard.has_substituted_invoices = bool(wizard.invoice_ids.l10n_mx_edi_cfdi_cancel_id)

    @api.model
    def default_get(self, fields_list):
        # EXTENDS 'base'
        results = super().default_get(fields_list)

        if 'invoice_ids' in results:
            invoices = self.env['account.move'].browse(results['invoice_ids'][0][2])
            if any(x.is_invoice() and x.l10n_mx_edi_cfdi_state != 'sent' for x in invoices):
                raise UserError(_("Some invoices are not signed."))
            if len(invoices.company_id) != 1:
                raise UserError(_("You can only process invoices sharing the same company."))
            substitution_invoices = invoices.l10n_mx_edi_cfdi_cancel_id
            if substitution_invoices:
                if len(substitution_invoices) != len(invoices):
                    raise UserError(_("Some invoices are already substituted by another but not all."))
                if any(x.is_invoice() and x.l10n_mx_edi_cfdi_state != 'sent' for x in substitution_invoices):
                    raise UserError(_("Some replacement invoices are not signed."))

            results['invoice_ids'] = [Command.set(invoices.ids)]

        return results

    def action_create_replacement_invoice(self):
        self.ensure_one()
        moves_vals_list = []
        for invoice in self.with_context(include_business_fields=True).invoice_ids:
            moves_vals_list.append(invoice.copy_data({
                'l10n_mx_edi_cfdi_origin': f'04|{invoice.l10n_mx_edi_cfdi_uuid}',
            })[0])
        new_invoices = self.env['account.move'].create(moves_vals_list)

        # Redirect.
        action_values = {
            'name': _('Reverse Moves'),
            'type': 'ir.actions.act_window',
            'res_model': 'account.move',
        }
        if len(new_invoices) == 1:
            action_values.update({
                'view_mode': 'form',
                'res_id': new_invoices.id,
                'context': {'default_move_type': new_invoices.move_type},
            })
        else:
            action_values.update({
                'view_mode': 'tree,form',
                'domain': [('id', 'in', new_invoices.ids)],
                'context': {'default_move_type': 'out_invoice'},
            })
        return action_values

    def action_cancel_invoices(self):
        self.ensure_one()
        self.invoice_ids \
            .with_context(skip_invoice_sync=True, skip_invoice_line_sync=True)\
            .write({'l10n_mx_edi_invoice_cancellation_reason': self.cancellation_reason})

        for invoice in self.invoice_ids:
            invoice._l10n_mx_edi_cfdi_invoice_try_cancel()
