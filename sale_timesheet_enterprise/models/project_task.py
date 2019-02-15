from odoo import fields, models
from datetime import datetime
from math import ceil
from odoo.tools import float_round


class ProjectTask(models.Model):
    _inherit = 'project.task'

    timesheet_timer_start = fields.Datetime(default=None)
    use_timesheet_timer = fields.Boolean(related='company_id.use_timesheet_timer')

    def action_timer_start(self):
        self.ensure_one()
        return self.write({'timesheet_timer_start': datetime.now()})

    def action_timer_stop(self):
        self.ensure_one()
        minutes_spent = (datetime.now() - self.timesheet_timer_start).total_seconds() / 60
        minutes_spent = self._round_minutes_spent(minutes_spent)
        self.write({'timesheet_timer_start': False})
        return self._timesheet_wizard(minutes_spent * 60 / 3600)

    def _round_minutes_spent(self, minutes_spent):
        minimum_duration = int(self.env['ir.config_parameter'].sudo().get_param('sale_timesheet_enterprise.timesheet_min_duration', 0))
        rounding = int(self.env['ir.config_parameter'].sudo().get_param('sale_timesheet_enterprise.timesheet_rounding', 0))
        minutes_spent = max(minimum_duration, minutes_spent)
        if rounding and ceil(minutes_spent % rounding) != 0:
            minutes_spent = ceil(minutes_spent / rounding) * rounding
        return minutes_spent

    def _timesheet_wizard(self, time_spent):
        return {
            "name": "Finished time recording!",
            "type": 'ir.actions.act_window',
            "res_model": 'project.task.create.timesheet',
            "views": [[False, "form"]],
            "target": 'new',
            "context": {
                **self.env.context,
                'active_id': self.id,
                'active_model': 'project.task',
                'default_time_spent': time_spent,
            },
        }
