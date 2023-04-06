from odoo import http
from odoo.http import request
from odoo.addons.stock_barcode.controllers.stock_barcode import StockBarcodeController


class MRPStockBarcode(StockBarcodeController):

    @http.route()
    def main_menu(self, barcode):
        ret_open_production = self._try_open_production(barcode)
        return ret_open_production or super().main_menu(barcode)

    @http.route('/stock_barcode_mrp/save_barcode_data', type='json', auth='user')
    def save_barcode_mrp_data(self, model_vals):
        """ Saves data from the barcode app, allows multiple model saves in the same http call

        :param model_vals: list of list with model name,res_id and a dict of write_vals
        :returns the barcode data from the mrp model passed
        """
        target_record = request.env['mrp.production']
        for model, res_id, vals in model_vals:
            if res_id == 0:
                record = request.env[model].create(vals)
                # difficult to use precompute as there are lots of depends fields to precompute
                if model == 'mrp.production':
                    record._compute_move_finished_ids()
            else:
                record = request.env[model].browse(res_id)
                for key in vals:
                    # check if dict val is passed for creation (for many2one, lot_producing_id in case of mrp)
                    if isinstance(vals[key], dict):
                        sub_model = request.env[model]._fields[key].comodel_name
                        vals[key] = request.env[sub_model].create(vals[key]).id

                record.write(vals)
        target_record = record if model == 'mrp.production' else record.production_id
        if target_record.state == 'draft':
            target_record.action_confirm()
        return target_record._get_stock_barcode_data()

    @http.route()
    def get_barcode_data(self, model, res_id):
        if res_id and model == 'mrp.production':
            mo_id = request.env[model].browse(res_id)
            # when MO product_qty is changed, the MO needs to check availability again,
            # this is done automatically when fetching the data
            if mo_id.reservation_state != 'assigned':
                mo_id.action_assign()
        return super().get_barcode_data(model, res_id)

    def _get_groups_data(self):
        group_data = super()._get_groups_data()
        group_data.update({
            'group_mrp_byproducts': request.env.user.has_group('mrp.group_mrp_byproducts')
        })
        return group_data

    def _try_open_production(self, barcode):
        """ If barcode represents a production order, open it
        """
        production = request.env['mrp.production'].search([
            ('name', '=', barcode),
        ], limit=1)
        if production:
            action = production.action_open_barcode_client_action()
            return {'action': action}
        return False
