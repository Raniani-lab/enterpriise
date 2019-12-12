# -*- coding: utf-8 -*-

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError
from odoo.tools import float_compare, float_round

from .taxcloud_request import TaxCloudRequest


class SaleSubscription(models.Model):
    """Ensure a correct invoice by validating taxcloud taxes in the subscription before invoice generation."""
    _inherit = "sale.subscription"

    is_taxcloud_configured = fields.Boolean(related='company_id.is_taxcloud_configured', help='Used to determine whether or not to warn the user to configure TaxCloud.')
    is_taxcloud = fields.Boolean(related='fiscal_position_id.is_taxcloud', help='Technical field to determine whether to hide taxes in views or not.')


    def _prepare_invoice(self):
        if self.fiscal_position_id.is_taxcloud:
            self.validate_taxes_on_subscription()
        return super(SaleSubscription, self)._prepare_invoice()

    def validate_taxes_on_subscription(self):
        for subscription in self:
            company = subscription.company_id
            shipper = company or subscription.env.company_id
            api_id = shipper.taxcloud_api_id
            api_key = shipper.taxcloud_api_key
            request = TaxCloudRequest(api_id, api_key)

            request.set_location_origin_detail(shipper)
            request.set_location_destination_detail(subscription.partner_id)

            request.set_subscription_items_detail(subscription)

            response = request.get_all_taxes_values()

            if response.get("error_message"):
                raise ValidationError(
                    _("Unable to retrieve taxes from TaxCloud: ")
                    + "\n"
                    + response["error_message"]
                    + "\n\n"
                    + _(
                        "The configuration of TaxCloud is in the Accounting app, Settings menu."
                    )
                )

            tax_values = response["values"]

            for index, line in enumerate(subscription.recurring_invoice_line_ids):
                if line.price_unit >= 0.0 and line.quantity >= 0.0:
                    price = (
                        line.price_unit
                        * (1 - (line.discount or 0.0) / 100.0)
                        * line.quantity
                    )
                    if not price:
                        tax_rate = 0.0
                    else:
                        tax_rate = tax_values[index] / price * 100
                    if len(line.tax_ids) != 1 or float_compare(
                        line.tax_ids.amount, tax_rate, precision_digits=3
                    ):
                        tax_rate = float_round(tax_rate, precision_digits=3)
                        tax = (
                            subscription.env["account.tax"]
                            .with_context(active_test=False)
                            .sudo()
                            .search(
                                [
                                    ("amount", "=", tax_rate),
                                    ("amount_type", "=", "percent"),
                                    ("type_tax_use", "=", "sale"),
                                    ("company_id", "=", company.id),
                                ],
                                limit=1,
                            )
                        )
                        if tax:
                            tax.active = True # Needs to be active to be included in order total computation
                        else:
                            tax = (
                                subscription.env["account.tax"]
                                .sudo()
                                .create(
                                    {
                                        "name": "Tax %.3f %%" % (tax_rate),
                                        "amount": tax_rate,
                                        "amount_type": "percent",
                                        "type_tax_use": "sale",
                                        "description": "Sales Tax",
                                        "company_id": company.id,
                                    }
                                )
                            )
                        line.tax_ids = tax
        self._amount_all()
        return True
