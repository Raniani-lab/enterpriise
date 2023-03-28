/** @odoo-module **/

import { Component } from "@odoo/owl";

export class ControlPanelButtons extends Component {
    static template = "mrp_workorder.ControlPanelButtons";
    static props = {
        activeWorkcenter: [Boolean, Number],
        employeeWorkorderCount: Number,
        productions: Array,
        selectWorkcenter: Function,
        toggleWorkcenter: Function,
        workcenters: Array,
        workorders: Array,
    };

    get workcenterButtons() {
        const productionCount = this.props.productions.length;
        const workcenterButtons = {};
        for (const { id, display_name } of this.props.workcenters) {
            workcenterButtons[id] = { count: 0, name: display_name };
        }
        for (const workorder of this.props.workorders) {
            const id = workorder.data.workcenter_id[0];
            if (workcenterButtons[id]) {
                workcenterButtons[id].count++;
            }
        }
        return [
            ["0", { count: productionCount, name: this.env._t("All") }],
            ["-1", { count: this.props.employeeWorkorderCount, name: this.env._t("My") }],
            ...Object.entries(workcenterButtons)
        ];
    }
}
