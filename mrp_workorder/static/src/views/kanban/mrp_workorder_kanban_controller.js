/** @odoo-module */

import { SelectionPopup } from '@mrp_workorder/components/popup';
import { WorkingEmployeePopupWOList } from "@mrp_workorder/components/working_employee_popup_wo_list";
import { PinPopup } from '@mrp_workorder/components/pin_popup';
import { useBus, useService } from "@web/core/utils/hooks";
import { KanbanController } from '@web/views/kanban/kanban_controller';

import { useConnectedEmployee } from '../hooks/employee_hooks';

const { onWillStart, useState } = owl;

export class MrpWorkorderKanbanController extends KanbanController {

    static components = {...KanbanController.components, SelectionPopup, PinPopup, WorkingEmployeePopupWOList}

    setup() {
        super.setup();
        this.context = {
            'from_manufacturing_order': this.props.context.from_manufacturing_order,
            'from_production_order': this.props.context.from_production_order,
        };
        this.orm = useService('orm');
        this.domain = useState({ workcenterEmployeeDomain: [] });
        this.useEmployee = useConnectedEmployee(
            this.model,
            "kanban",
            this.context,
            this.props.context.default_workcenter_id,
            this.domain,
        );
        this.barcode = useService("barcode");
        useBus(this.barcode.bus, 'barcode_scanned', (event) => this.useEmployee.onBarcodeScanned(event.detail.barcode));
        this.workcenterId = this.props.context.default_workcenter_id;
        this.workcenter = false;
        onWillStart(async () => {
            await this.onWillStart();
        });
    }

    async onWillStart() {
        if (this.workcenterId) {
            const workcenter = await this.orm.read(
                "mrp.workcenter",
                [this.workcenterId],
                ['employee_ids']
            );
            this.workcenter = workcenter[0];
            if (this.workcenter.employee_ids.length) {
                this.domain.workcenterEmployeeDomain.push(['id', 'in', this.workcenter.employee_ids]);
            }
        }

        await this.useEmployee.getConnectedEmployees(true);
    }

    actionBack() {
        this.actionService.doAction('mrp.mrp_workcenter_kanban_action', {
            clearBreadcrumbs: true,
        });
    }

    async openRecord(record, mode) {
        await this.useEmployee.openRecord(record, mode);
        const action = await this.orm.call(
            'mrp.workorder',
            'open_tablet_view',
            [record.resId],
        );
        Object.assign(action.context, this.context);
        this.actionService.doAction(action);
    }
}
