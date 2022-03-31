/** @odoo-module **/

import { GroupMenu } from "./group_menu"
import { ControlPanel } from "@web/search/control_panel/control_panel";


export class MrpMpsControlPanel extends ControlPanel {
    get groups() {
        return this.env.model.data.groups[0];
    }

    /**
     * Handles the click on replenish button. It will call action_replenish with
     * all the Ids present in the view.
     *
     * @private
     * @param {MouseEvent} ev
     */
    _onClickReplenish(ev) {
        this.env.model.replenishAll();
    }

    _onMouseOverReplenish(ev) {
        const table = $('tr');
        table.find('.o_mrp_mps_to_replenish').addClass('o_mrp_mps_hover');
    }

    _onMouseOutReplenish(ev) {
        const table = $('tr');
        table.find('.o_mrp_mps_hover').removeClass('o_mrp_mps_hover');
    }

    _onClickCreate(ev) {
        this.env.model._createProduct();
    }
}

MrpMpsControlPanel.template = "mrp_mps.MrpMpsControlPanel";
MrpMpsControlPanel.components = {
    ...ControlPanel.components,
    GroupMenu,
};
