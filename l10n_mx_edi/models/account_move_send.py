# -*- coding: utf-8 -*-

from odoo import _, api, fields, models


class AccountMoveSend(models.Model):
    _inherit = 'account.move.send'

    l10n_mx_edi_enable_cfdi = fields.Boolean(compute='_compute_send_mail_extra_fields')
    l10n_mx_edi_checkbox_cfdi = fields.Boolean(
        string="CFDI",
        compute='_compute_l10n_mx_edi_checkbox_cfdi',
        store=True,
        readonly=False,
    )

    @api.model
    def _get_default_l10n_mx_edi_enable_cfdi(self, move):
        return not move.invoice_pdf_report_id \
            and move.l10n_mx_edi_is_cfdi_needed \
            and move.is_invoice() \
            and move.l10n_mx_edi_cfdi_state != 'sent'

    # -------------------------------------------------------------------------
    # COMPUTE METHODS
    # -------------------------------------------------------------------------

    def _compute_send_mail_extra_fields(self):
        # EXTENDS 'account'
        super()._compute_send_mail_extra_fields()
        for wizard in self:
            wizard.l10n_mx_edi_enable_cfdi = any(wizard._get_default_l10n_mx_edi_enable_cfdi(m) for m in wizard.move_ids)

    @api.depends('l10n_mx_edi_checkbox_cfdi')
    def _compute_mail_attachments_widget(self):
        # EXTENDS 'account' - add depends
        super()._compute_mail_attachments_widget()

    @api.depends('l10n_mx_edi_enable_cfdi')
    def _compute_l10n_mx_edi_checkbox_cfdi(self):
        for wizard in self:
            wizard.l10n_mx_edi_checkbox_cfdi = wizard.l10n_mx_edi_enable_cfdi

    # -------------------------------------------------------------------------
    # ATTACHMENTS
    # -------------------------------------------------------------------------

    @api.model
    def _get_invoice_extra_attachments(self, move):
        # EXTENDS 'account'
        return super()._get_invoice_extra_attachments(move) + move.l10n_mx_edi_cfdi_attachment_id

    def _get_placeholder_mail_attachments_data(self, move):
        # EXTENDS 'account'
        results = super()._get_placeholder_mail_attachments_data(move)

        if (
            not move.l10n_mx_edi_cfdi_attachment_id \
            and self.l10n_mx_edi_enable_cfdi \
            and self.l10n_mx_edi_checkbox_cfdi
        ):
            filename = move._l10n_mx_edi_get_invoice_cfdi_filename()
            results.append({
                'id': f'placeholder_{filename}',
                'name': filename,
                'mimetype': 'application/xml',
                'placeholder': True,
            })

        return results

    # -------------------------------------------------------------------------
    # BUSINESS ACTIONS
    # -------------------------------------------------------------------------

    def _get_invoice_pdf_report_to_render(self, invoice, invoice_data):
        # EXTENDS 'account'
        template, template_values = super()._get_invoice_pdf_report_to_render(invoice, invoice_data)

        if invoice.l10n_mx_edi_cfdi_attachment_id:
            template = 'l10n_mx_edi.report_invoice_document'
            template_values['cfdi_values'] = invoice._l10n_mx_edi_get_extra_invoice_report_values()

        return template, template_values

    def _call_web_service_before_invoice_pdf_render(self, invoices_data):
        # EXTENDS 'account'
        super()._call_web_service_before_invoice_pdf_render(invoices_data)

        if not self.l10n_mx_edi_checkbox_cfdi:
            return

        for invoice, invoice_data in invoices_data.items():

            if not self._get_default_l10n_mx_edi_enable_cfdi(invoice):
                continue

            # Sign it.
            invoice._l10n_mx_edi_cfdi_invoice_try_send()

            # Check for success.
            if invoice.l10n_mx_edi_cfdi_state == 'sent':
                continue

            # Check for error.
            errors = [_("Error when sending the CFDI to the PAC:")]
            for document in invoice.l10n_mx_edi_invoice_document_ids:
                if document.state == 'invoice_sent_failed':
                    errors.append(document.message)
                    break

            invoice_data['error'] = "\n".join(errors)

            if self._can_commit():
                self._cr.commit()
