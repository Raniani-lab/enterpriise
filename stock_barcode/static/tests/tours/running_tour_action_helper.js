/** @odoo-module **/

import { RunningTourActionHelper } from "@web_tour/tour_service/tour_utils";
import { patch } from "@web/core/utils/patch";

patch(RunningTourActionHelper.prototype, {
    _scan(element, barcode) {
        odoo.loader.modules.get('@web/legacy/js/services/core').bus.trigger('barcode_scanned', barcode, element);
    },
    scan(barcode, element) {
        this._scan(this._get_action_values(element), barcode);
    },
});
