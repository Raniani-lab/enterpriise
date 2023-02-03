/** @odoo-module */

import { SelectionPopup } from '@mrp_workorder_hr/components/popup';
import { WorkingEmployeePopupWOList } from "@mrp_workorder_hr/components/working_employee_popup_wo_list";
import { PinPopup } from '@mrp_workorder_hr/components/pin_popup';
import { useBus, useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { MrpWorkorderKanbanController } from '@mrp_workorder/views/kanban/mrp_workorder_kanban_controller';
import { useConnectedEmployee } from '../hooks/employee_hooks';

const { onWillStart, useState } = owl;

MrpWorkorderKanbanController.components = {
    ...MrpWorkorderKanbanController.components,
    SelectionPopup,
    PinPopup,
    WorkingEmployeePopupWOList
}

patch(MrpWorkorderKanbanController.prototype, 'mrp_workorder_hr', {
    /**
     * There is Two types of flow
     * 1) The one where we already selected a workcenter
     * 2) The one where we have all the workorders
     *
     * In case 1), infos should be updated and reduced to what we have already
     * In case 2), this need to be as generic as possible, like in the list controller.
     * **/

    setup() {
        this._super();

        this.notification = useService('notification');
        this.orm = useService("orm");
        this.domain = useState({ workcenterEmployeeDomain: [] });
        this.useEmployee = useConnectedEmployee(
            this.model,
            "kanban",
            this.context,
            this.props.context.default_workcenter_id,
            this.domain,
        )
        this.barcode = useService("barcode");
        useBus(this.barcode.bus, 'barcode_scanned', (event) => this.useEmployee.onBarcodeScanned(event.detail.barcode));
        this.workcenterId = this.props.context.default_workcenter_id;
        this.workcenter = false;
        onWillStart(async () => {
            await this.onWillStart();
        });
    },

    async onWillStart() {
        if (this.workcenterId) {
            const workcenter = await this.orm.read(
                "mrp.workcenter",
                [this.workcenterId],
                ['allow_employee', 'employee_ids']
            );
            this.workcenter = workcenter[0];
            if (this.workcenter.allow_employee && this.workcenter.employee_ids.length) {
                this.domain.workcenterEmployeeDomain.push(['id', 'in', this.workcenter.employee_ids]);
            }
        }

        await this.useEmployee.getConnectedEmployees()
    },

    async openRecord(record, mode) {
        const superOpenRecord = this._super
        await this.useEmployee.openRecord(record,mode)
        superOpenRecord(...arguments);
    },
});