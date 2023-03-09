from odoo import fields, models, Command


class PosPreparationDisplayOrder(models.Model):
    _name = 'pos_preparation_display.order'
    _description = "Preparation orders"

    displayed = fields.Boolean("Order is displayed", help="Determines whether the order should be displayed on the preparation screen")
    pos_order_id = fields.Many2one('pos.order', help="ID of the original PoS order")
    pos_config_id = fields.Many2one(related='pos_order_id.config_id')
    order_stage_ids = fields.One2many('pos_preparation_display.order.stage', 'order_id', help="All the stage ids in which the order is placed")
    preparation_display_order_line_ids = fields.One2many(
        'pos_preparation_display.orderline',
        'preparation_display_order_id',
        string="Order Lines",
        readonly=True)

    def process_order(self, order):
        positive_orderlines = []
        negative_orderlines = []
        product_categories = []

        for orderline in order['preparation_display_order_line_ids']:
            product_categories.append(orderline['product_category_id'])
            del orderline['product_category_id']

            if orderline['product_quantity'] > 0:
                positive_orderlines.append(Command.create(orderline))
            else:
                negative_orderlines.append(orderline)

        if negative_orderlines:
            for negative_orderline in negative_orderlines:
                quantity_to_cancel = abs(negative_orderline['product_quantity'])

                orderlines = self.env['pos_preparation_display.orderline'].search(
                    [('preparation_display_order_id.pos_order_id', '=', order['pos_order_id']), ('product_id', '=', negative_orderline['product_id'])],
                    order='id desc'
                )

                for orderline in orderlines:
                    if orderline.internal_note == negative_orderline["internal_note"]:
                        if orderline.product_quantity > orderline.product_cancelled:
                            if orderline.product_quantity >= quantity_to_cancel:
                                orderline.product_cancelled = quantity_to_cancel
                                quantity_to_cancel = 0
                            elif orderline.product_quantity < quantity_to_cancel:
                                orderline.product_cancelled = orderline.product_quantity
                                quantity_to_cancel -= orderline.product_quantity

                    if quantity_to_cancel == 0:
                        break

        if positive_orderlines:
            self.create({
                'preparation_display_order_line_ids': positive_orderlines,
                'displayed': True,
                'pos_order_id':  order['pos_order_id'],
            })

        if positive_orderlines or negative_orderlines:
            preparation_displays = self.env['pos_preparation_display.display'].search([])

            for p_dis in preparation_displays:
                p_dis_categories = p_dis._get_pos_category_ids()

                if len(set(p_dis_categories.ids).intersection(product_categories)) > 0:
                    self.env['bus.bus']._sendone(f'preparation_display-{p_dis.id}', 'load_orders', {
                        'preparation_display_id': p_dis.id,
                    })

    def change_order_stage(self, stage_id, preparation_display_id):
        self.ensure_one()

        categories = self.preparation_display_order_line_ids.mapped('product_id.pos_categ_id.id')
        p_dis = self.env['pos_preparation_display.display'].search([('id', '=', preparation_display_id)])

        for orderline in self.preparation_display_order_line_ids:
            orderline.todo = 1

        p_dis_categories = p_dis._get_pos_category_ids()

        if len(set(p_dis_categories.ids).intersection(categories)) > 0:
            channel = f'preparation_display-{p_dis.id}'

            if stage_id in p_dis.stage_ids.ids:
                current_stage = self.order_stage_ids.create({
                    'preparation_display_id': p_dis.id,
                    'stage_id': stage_id,
                    'order_id': self.id,
                    'done': False
                })

                self.env['bus.bus']._sendone(channel, 'change_order_stage', {
                    'preparation_display_id': p_dis.id,
                    'order_id': self.id,
                    'last_stage_change': current_stage.write_date,
                    'stage_id': stage_id
                })

                return current_stage.write_date

    def done_orders_stage(self, preparation_display_id):
        preparation_display = self.env['pos_preparation_display.display'].browse(preparation_display_id)
        last_stage = preparation_display.stage_ids[-1]

        for order in self:
            current_order_stage = order.order_stage_ids.filtered(lambda order_stage:
                order_stage.preparation_display_id == preparation_display and
                order_stage.stage_id == last_stage
            )

            current_order_stage.done = True

    def get_preparation_display_order(self, preparation_display_id):
        preparation_display = self.env['pos_preparation_display.display'].browse(preparation_display_id)
        orders = self.env['pos_preparation_display.order'].search([('pos_config_id', 'in', preparation_display.get_pos_config_ids().ids)])
        first_stage = preparation_display.stage_ids[0]
        last_stage = preparation_display.stage_ids[-1]

        preparation_display_orders = []
        for order in orders:
            current_order_stage = []

            if order.order_stage_ids:
                current_order_stage = order.order_stage_ids.filtered(lambda stage: stage.preparation_display_id.id == preparation_display.id)[-1]

            if current_order_stage and current_order_stage.stage_id == last_stage and current_order_stage.done:
                continue
            elif not current_order_stage:
                order.order_stage_ids.create({
                    'preparation_display_id': preparation_display_id,
                    'stage_id': first_stage.id,
                    'order_id': order.id,
                    'done': False
                })

            order_ui = order._export_for_ui(preparation_display)
            if order_ui:
                preparation_display_orders.append(order_ui)

        return preparation_display_orders

    def _export_for_ui(self, preparation_display):
        preparation_display_orderlines = []

        for orderline in self.preparation_display_order_line_ids:
            if orderline.product_id.pos_categ_id.id in preparation_display._get_pos_category_ids().ids:
                preparation_display_orderlines.append({
                    'id': orderline.id,
                    'todo': orderline.todo,
                    'internal_note': orderline.internal_note,
                    'product_id': orderline.product_id.id,
                    'product_name': orderline.product_id.display_name,
                    'product_quantity': orderline.product_quantity,
                    'product_cancelled': orderline.product_cancelled,
                    'product_category_id': orderline.product_id.pos_categ_id.id,
                })

        if preparation_display_orderlines:
            current_order_stage = []

            if self.order_stage_ids:
                current_order_stage = self.order_stage_ids.filtered(lambda stage: stage.preparation_display_id.id == preparation_display.id)[-1]

            return {
                'id': self.id,
                'pos_order_id': self.pos_order_id.id,
                'create_date': self.create_date,
                'responsible': self.create_uid.display_name,
                'stage_id': current_order_stage.stage_id.id if current_order_stage else None,
                'last_stage_change': current_order_stage.write_date if current_order_stage else self.create_date,
                'displayed': self.displayed,
                'table': {
                    'id': self.pos_order_id.table_id.id,
                    'seats': self.pos_order_id.table_id.seats,
                    'name': self.pos_order_id.table_id.name,
                    'color': self.pos_order_id.table_id.color,
                },
                'orderlines': preparation_display_orderlines,
            }
