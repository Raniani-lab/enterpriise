# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import models


class ProjectTaskCreateSalesOrder(models.TransientModel):
    _inherit = 'project.task.create.sale.order'

    def _prepare_sale_order(self):
        """ Override to add material to sale order
        """
        sale_order = super(ProjectTaskCreateSalesOrder, self)._prepare_sale_order()
        self.task_id._fsm_add_material_to_sale_order()
        return sale_order
