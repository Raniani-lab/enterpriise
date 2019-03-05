# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class ResConfigSettings(models.TransientModel):
    _inherit = 'res.config.settings'

    days_between_two_followups = fields.Integer(related='company_id.days_between_two_followups', string='Days between two follow-ups', readonly=False)
    totals_below_sections = fields.Boolean(related='company_id.totals_below_sections', string='Add totals below sections', readonly=False,
                                           help='When ticked, totals and subtotals appear below the sections of the report.')
    tax_periodicity = fields.Selection(related='company_id.tax_periodicity', string='Periodicity', readonly=False, required=True)
    tax_periodicity_next_deadline = fields.Date(related='company_id.tax_periodicity_next_deadline', string='Next deadline', readonly=False, required=True)
    tax_periodicity_journal_id = fields.Many2one(related='company_id.tax_periodicity_journal_id', string='Journal', readonly=False, required=True)

    @api.multi
    def set_values(self):
        super(ResConfigSettings, self).set_values()
        self._create_edit_tax_reminder()

    @api.multi
    def _create_edit_tax_reminder(self, values=None):
        # Create/Edit activity type if needed
        if not values:
            values = {}
        company = values.get('company_id', False) or self.company_id or self.env.user.company_id
        if company.original_tax_periodicity_next_deadline and company.original_tax_periodicity_next_deadline == values.get('tax_periodicity_next_deadline', self.tax_periodicity_next_deadline):
            return True
        else:
            company.original_tax_periodicity_next_deadline = values.get('tax_periodicity_next_deadline', self.tax_periodicity_next_deadline)
        journal_res_model_id = self.env['ir.model'].search([('model', '=', 'account.journal')], limit=1).id
        activity_type = self.env['mail.activity.type'].search([('category', '=', 'tax_report'), ('company_id', '=', company.id)])
        vals = {
            'category': 'tax_report',
            'delay_count': values.get('tax_periodicity', self.tax_periodicity) == 'monthly' and 1 or 3,
            'delay_unit': 'months',
            'delay_from': 'previous_activity',
            'res_model_id': journal_res_model_id,
            'force_next': True,
            'company_id': company.id,
            'summary': _('Periodic Tax Return')
        }
        if not len(activity_type):
            vals['name'] = _('Tax Report for company %s') % (company.name,)
            activity_type = self.env['mail.activity.type'].create(vals)
            activity_type.default_next_type_id = activity_type
        else:
            activity_type.write(vals)
        
        # search for an existing reminder for given journal and change it's date
        tax_periodicity_journal_id = values.get('tax_periodicity_journal_id', self.tax_periodicity_journal_id)
        activity = self.env['mail.activity'].search(
            [('res_id', '=', tax_periodicity_journal_id.id), 
            ('res_model_id', '=', journal_res_model_id), 
            ('activity_type_id', '=', activity_type.id)], order="date_deadline desc", limit=1)
        if len(activity):
            activity.write({'date_deadline': self.tax_periodicity_next_deadline})
        else:
            activity_vals = {
                'res_id': tax_periodicity_journal_id.id,
                'res_model_id': journal_res_model_id,
                'activity_type_id': activity_type.id,
                'summary': _('Periodic Tax Return'),
                'date_deadline': values.get('tax_periodicity_next_deadline', self.tax_periodicity_next_deadline),
                'automated': True,
                'user_id': self.env.user.id,
                'note': _('You can edit the periodicity of the tax report in the Accounting Settings')
            }
            activity = self.env['mail.activity'].create(activity_vals)
        # search for existing reminder on other journal and delete them
        activities_to_delete = self.env['mail.activity'].search(
            [('res_id', '!=', tax_periodicity_journal_id.id), 
            ('res_model_id', '=', journal_res_model_id), 
            ('activity_type_id', '=', activity_type.id)], order="date_deadline desc")
        if activities_to_delete:
            journal_to_reset = [a.res_id for a in activities_to_delete]
            activities_to_delete.unlink()
            self.env['account.journal'].browse(journal_to_reset).write({'show_on_dashboard': False})

        # Finally, add the journal visible in the dashboard
        tax_periodicity_journal_id.show_on_dashboard = True