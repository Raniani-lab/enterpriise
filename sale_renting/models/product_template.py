# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _


class ProductTemplate(models.Model):
    _inherit = 'product.template'

    rent_ok = fields.Boolean(
        string="Can be Rented",
        help="Allow renting of this product.")
    qty_in_rent = fields.Float("Quantity currently in rent", compute='_get_qty_in_rent')

    # Delays pricing

    extra_hourly = fields.Float("Extra Hour", help="Fine by hour overdue", company_dependent=True)
    extra_daily = fields.Float("Extra Day", help="Fine by day overdue", company_dependent=True)

    @api.depends('rent_ok')
    def _compute_is_temporal(self):
        super()._compute_is_temporal()
        self.filtered('rent_ok').is_temporal = True

    def _compute_visible_qty_configurator(self):
        super(ProductTemplate, self)._compute_visible_qty_configurator()
        for product_template in self:
            if len(product_template.product_variant_ids) > 1 and product_template.rent_ok:
                product_template.visible_qty_configurator = False

    def _get_qty_in_rent(self):
        rentable = self.filtered('rent_ok')
        not_rentable = self - rentable
        not_rentable.update({'qty_in_rent': 0.0})
        for template in rentable:
            template.qty_in_rent = sum(template.mapped('product_variant_ids.qty_in_rent'))

    def action_view_rentals(self):
        """Access Gantt view of rentals (sale.rental.schedule), filtered on variants of the current template."""
        return {
            "type": "ir.actions.act_window",
            "name": _("Scheduled Rentals"),
            "res_model": "sale.rental.schedule",
            "views": [[False, "gantt"]],
            'domain': [('product_id', 'in', self.mapped('product_variant_ids').ids)],
            'context': {
                'search_default_Rentals':1,
                'group_by_no_leaf':1,
                'group_by':[],
                'restrict_renting_products': True,
            }
        }

    def name_get(self):
        res_names = super(ProductTemplate, self).name_get()
        if not self._context.get('rental_products'):
            return res_names
        result = []
        rental_product_ids = self.filtered(lambda p: p.rent_ok).ids
        for res in res_names:
            result.append((res[0], res[0] in rental_product_ids and "%s %s" % (res[1], _("(Rental)")) or res[1]))
        return result
