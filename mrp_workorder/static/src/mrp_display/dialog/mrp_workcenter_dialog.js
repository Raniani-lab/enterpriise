/** @odoo-module */

import { ConfirmationDialog } from "@web/core/confirmation_dialog/confirmation_dialog";
import { useService } from "@web/core/utils/hooks";

const { onWillStart } = owl;

export class MrpWorkcenterDialog extends ConfirmationDialog {
    static template = "mrp_workorder.MrpWorkcenterDialog";
    static props = {
        ...ConfirmationDialog.props,
        body: { type: String, optional: true },
        workcenters: { type: Array, optional: true },
        disabled: { type: Array, optional: true },
        active: { type: Array, optional: true },
    };

    setup() {
        super.setup();
        this.ormService = useService("orm");
        this.workcenters = [];
        for(const workcenter of this.props.workcenters || []) {
            this.workcenters.push({
                id: parseInt(workcenter[0]),
                display_name: workcenter[1],
            })
        }

        onWillStart(async () => {
            if (!this.workcenters.lenght) {
                await this._loadWorkcenters();
            }
        });
    }

    get active() {
        if (!this.props.active) {
            return false;
        }
        return this.props.active.includes(this.workcenter.id);
    }

    get disabled() {
        if (!this.props.disabled) {
            return false;
        }
        return this.props.disabled.includes(this.workcenter.id);
    }

    selectWorkcenter(workcenter) {
        this.props.confirm(workcenter);
        this.props.close();
    }

    async _loadWorkcenters() {
        this.workcenters = await this.ormService.searchRead("mrp.workcenter", [], ["display_name"]);
    }
}
