/** @odoo-module */

import { SelectionPopup } from "@mrp_workorder_hr/components/popup";
import { WorkingEmployeePopupWOList } from "@mrp_workorder_hr/components/working_employee_popup_wo_list";
import { PinPopup } from "@mrp_workorder_hr/components/pin_popup";
import { useBus, useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { MrpWorkorderListController } from "@mrp_workorder/views/list/mrp_workorder_list_controller";
import { useConnectedEmployee } from "../hooks/employee_hooks";

const { onWillStart } = owl;

MrpWorkorderListController.components.SelectionPopup = SelectionPopup;
MrpWorkorderListController.components.WorkingEmployeePopupWOList = WorkingEmployeePopupWOList;
MrpWorkorderListController.components.PinPopup = PinPopup;

patch(MrpWorkorderListController.prototype, "mrp_workorder_hr", {
    setup() {
        this._super();
        this.notification = useService("notification");
        this.orm = useService("orm");
        this.useEmployee = useConnectedEmployee(
            this.model,
            "list",
            this.context,
            undefined
            )
        this.barcode = useService("barcode");
        useBus(this.barcode.bus, 'barcode_scanned', (event) => this.useEmployee.onBarcodeScanned(event.detail.barcode));
        onWillStart(async () => {
            await this.useEmployee.getConnectedEmployees();
        });
    },

    // Weird behavior
    async openRecord(record, mode) {
        const superOpenRecord = this._super
        await this.useEmployee.openRecord(record,mode)
        superOpenRecord(...arguments);
    },
});
