/** @odoo-module */

import { useBus, useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { MrpWorkorderListController } from "@mrp_workorder/views/list/mrp_workorder_list_controller";
import { useConnectedEmployee } from "../hooks/employee_hooks";

const { onWillStart } = owl;

patch(MrpWorkorderListController.prototype, "mrp_workorder_hr", {
    setup() {
        this._super();
        this.orm = useService("orm");
        this.useEmployee = useConnectedEmployee(
            this.model,
            "list",
            this.context,
            undefined
        );
        this.barcode = useService("barcode");
        useBus(this.barcode.bus, 'barcode_scanned', (event) => this.useEmployee.onBarcodeScanned(event.detail.barcode));
        onWillStart(async () => {
            await this.useEmployee.getConnectedEmployees();
        });
    },

    async openRecord(record, mode) {
        const _super = this._super.bind(this);
        await this.useEmployee.openRecord(record, mode);
        _super(...arguments);
    },
});
