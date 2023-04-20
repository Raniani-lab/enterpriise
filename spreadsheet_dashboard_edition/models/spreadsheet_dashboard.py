from odoo import api, fields, models, _


class SpreadsheetDashboard(models.Model):
    _name = 'spreadsheet.dashboard'
    _inherit = ['spreadsheet.dashboard', 'spreadsheet.mixin']

    file_name = fields.Char(compute='_compute_file_name')

    def action_edit_dashboard(self):
        self.ensure_one()
        return {
            "type": "ir.actions.client",
            "tag": "action_edit_dashboard",
            "params": {
                "spreadsheet_id": self.id,
            },
        }

    def write(self, vals):
        if "spreadsheet_binary_data" in vals:
            self._delete_collaborative_data()
        return super().write(vals)

    @api.depends("name")
    def _compute_file_name(self):
        for dashboard in self:
            dashboard.file_name = f"{dashboard.name}.osheet.json"

    def action_edit(self):
        self.ensure_one()
        return {
            'type': 'ir.actions.client',
            'tag': 'action_edit_dashboard',
            'params': {
                'spreadsheet_id': self.id,
            }
        }

    def _creation_msg(self):
        return _("New dashboard created")
