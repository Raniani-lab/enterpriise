# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import tools
from odoo import api, fields, models


class RentalReport(models.AbstractModel):
    _name = "sale.rental.report.abstract"
    _description = "Rental Report"
    _auto = False
    _order = 'order_date desc'
    _rec_name = 'partner_name'

    name = fields.Char('Order Reference', readonly=True)
    product_name = fields.Char('Product Reference', readonly=True)
    description = fields.Char('Description', readonly=True)
    order_date = fields.Datetime('Order Date', readonly=True)
    confirmation_date = fields.Datetime('Confirmation Date', readonly=True)
    pickup_date = fields.Datetime('Pickup Date', readonly=True)
    return_date = fields.Datetime('Return Date', readonly=True)
    product_id = fields.Many2one('product.product', 'Product', readonly=True)
    product_uom = fields.Many2one('uom.uom', 'Unit of Measure', readonly=True)
    product_uom_qty = fields.Float('Qty Ordered', readonly=True)
    qty_delivered = fields.Float('Qty Delivered', readonly=True)
    qty_returned = fields.Float('Qty Returned', readonly=True)
    partner_id = fields.Many2one('res.partner', 'Customer', readonly=True)
    partner_name = fields.Char(string="Customer Name", readonly=True)
    company_id = fields.Many2one('res.company', 'Company', readonly=True)
    user_id = fields.Many2one('res.users', 'Salesperson', readonly=True)
    product_tmpl_id = fields.Many2one('product.template', 'Product Template', readonly=True)
    categ_id = fields.Many2one('product.category', 'Product Category', readonly=True)
    nbr = fields.Integer('# of Lines', readonly=True)
    analytic_account_id = fields.Many2one('account.analytic.account', 'Analytic Account', readonly=True)
    team_id = fields.Many2one('crm.team', 'Sales Team', readonly=True)
    country_id = fields.Many2one('res.country', 'Customer Country', readonly=True)
    commercial_partner_id = fields.Many2one('res.partner', 'Customer Entity', readonly=True)
    rental_status = fields.Selection([
        ('draft', 'Quotation'),
        ('sent', 'Quotation Sent'),
        ('pickup', 'Reserved'),
        ('return', 'Pickedup'),
        ('returned', 'Returned'),
        ('cancel', 'Cancelled'),
    ], string="Rental Status", readonly=True)
    state = fields.Selection([
        ('draft', 'Draft Quotation'),
        ('sent', 'Quotation Sent'),
        ('sale', 'Sales Order'),
        ('done', 'Sales Done'),
        ('cancel', 'Cancelled'),
    ], string='Status', readonly=True)
    late = fields.Boolean("Is Late", readonly=True)

    order_id = fields.Many2one('sale.order', 'Order #', readonly=True)
    order_line_id = fields.Many2one('sale.order.line', 'Order line #', readonly=True)

    def _id(self):
        return """min(sol.id) as id,"""

    def _get_product_name(self):
        return """t.name as product_name,"""

    def _quantity(self):
        return """
            sum(sol.product_uom_qty / u.factor * u2.factor) as product_uom_qty,
            sum(sol.qty_delivered / u.factor * u2.factor) as qty_delivered,
            sum(sol.qty_returned / u.factor * u2.factor) as qty_returned,
        """

    def _price(self):
        return """ """

    def _with(self):
        return """ """

    def _select(self):
        return """%s
            %s
            sol.product_id as product_id,
            t.uom_id as product_uom,
            sol.name as description,
            s.name as name,
            %s
            %s
            count(*) as nbr,
            case WHEN sol.state NOT IN ('sale', 'done') then FALSE
                WHEN sol.pickup_date < NOW() then TRUE
                WHEN sol.return_date < NOW() then TRUE
                ELSE FALSE END as late,
            s.date_order as order_date,
            s.confirmation_date as confirmation_date,
            sol.pickup_date as pickup_date,
            sol.return_date as return_date,
            s.state as state,
            s.rental_status as rental_status,
            s.partner_id as partner_id,
            s.user_id as user_id,
            s.company_id as company_id,
            extract(epoch from avg(date_trunc('day',sol.return_date)-date_trunc('day',sol.pickup_date)))/(24*60*60)::decimal(16,2) as delay,
            t.categ_id as categ_id,
            s.pricelist_id as pricelist_id,
            s.analytic_account_id as analytic_account_id,
            s.team_id as team_id,
            p.product_tmpl_id,
            partner.country_id as country_id,
            partner.commercial_partner_id as commercial_partner_id,
            partner.name as partner_name,
            s.id as order_id,
            sol.id as order_line_id
        """ % (self._id(), self._get_product_name(), self._quantity(), self._price())

    def _from(self):
        return """
            sale_order_line sol
                join sale_order s on (sol.order_id=s.id)
                join res_partner partner on s.partner_id = partner.id
                left join product_product p on (sol.product_id=p.id)
                left join product_template t on (p.product_tmpl_id=t.id)
                left join uom_uom u on (u.id=sol.product_uom)
                left join uom_uom u2 on (u2.id=t.uom_id)
        """

    def _groupby(self):
        return """
            sol.product_id,
            sol.order_id,
            t.uom_id,
            t.categ_id,
            t.name,
            s.name,
            s.date_order,
            s.confirmation_date,
            sol.pickup_date,
            sol.return_date,
            s.partner_id,
            s.user_id,
            s.rental_status,
            s.company_id,
            s.pricelist_id,
            s.analytic_account_id,
            s.team_id,
            p.product_tmpl_id,
            partner.country_id,
            partner.commercial_partner_id,
            partner.name,
            s.id,
            sol.id
        """

    def _query(self):
        with_ = self._with()

        select_ = self._select()

        from_ = self._from()

        groupby_ = self._groupby()

        return '%s (SELECT %s FROM %s WHERE sol.product_id IS NOT NULL AND sol.is_rental GROUP BY %s)' % (with_, select_, from_, groupby_)

    def init(self):
        # self._table = sale_rental_report
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""CREATE or REPLACE VIEW %s as (%s)""" % (self._table, self._query()))
