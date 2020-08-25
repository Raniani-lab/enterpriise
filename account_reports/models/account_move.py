# -*- coding: utf-8 -*-

from odoo import models, _


class AccountMove(models.Model):
    _inherit = "account.move"

    def _post(self, soft=True):
        for move in self.filtered(lambda m: not m.posted_before and m.tax_closing_end_date):
            # When working with carried over lines, update the tax line with the changes when posting the period move
            options = move._get_report_options_from_tax_closing_entry()
            new_context = self.env['account.generic.tax.report']._set_context(options)
            report_lines = self.env['account.generic.tax.report'].with_context(new_context)._get_lines(options)

            for line in [line for line in report_lines if line['columns'][0].get('carryover_bounds', False)]:
                line_balance = line['columns'][0]['balance']
                carryover_bounds = line['columns'][0].get('carryover_bounds')
                tax_line = self.env['account.tax.report.line'].browse(line['id'])
                carry_to_line = tax_line.carry_over_destination_line_id or tax_line
                AccountGenericTaxReport = self.env['account.generic.tax.report']

                country_id = self.env['account.tax.report'].browse(options['tax_report']).country_id

                reports = self.env['account.tax.report'].search([('country_id', '=', country_id.id)])

                for report in reports:
                    options['tax_report_option'] = report.id

                    old_carryover_balance = AccountGenericTaxReport.get_carried_over_balance_before_date(
                        carry_to_line.carryover_line_ids, options)
                    dummy, carryover_balance = AccountGenericTaxReport.get_amounts_after_carryover(
                        carry_to_line, line_balance, carryover_bounds, options, 0)

                    carryover_delta = carryover_balance - old_carryover_balance

                    if options['fiscal_position'] == 'domestic':
                        fiscal_position_id = False
                    else:
                        fiscal_position_id = options['fiscal_position']

                    if carryover_delta != 0:
                        self.env['account.tax.carryover.line'].create({
                            'name': _('Carryover for period %s to %s', new_context['date_from'], new_context['date_to']),
                            'amount': carryover_delta,
                            'date': new_context['date_to'],
                            'tax_report_line_id': carry_to_line.id,
                            'foreign_vat_fiscal_position_id': fiscal_position_id
                        })

        return super()._post(soft)
