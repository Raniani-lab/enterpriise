from odoo import models


class AccountChartTemplate(models.AbstractModel):
    _inherit = "account.chart.template"

    def _post_load_data(self, template_code, company, template_data):
        super()._post_load_data(template_code, company, template_data)
        self._load_payroll_accounts(template_code, company)

    def _load_payroll_accounts(self, template_code, companies):
        pass
