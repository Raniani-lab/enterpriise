/** @odoo-module */

import { useBus, useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { MrpWorkorderKanbanController } from '@mrp_workorder/views/kanban/mrp_workorder_kanban_controller';
import { useConnectedEmployee } from '../hooks/employee_hooks';

const { onWillStart, useState } = owl;

patch(MrpWorkorderKanbanController.prototype, 'mrp_workorder_hr', {
    setup() {
        this._super();
        this.orm = useService("orm");
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

        await this.useEmployee.getConnectedEmployees();
    },

    async openRecord(record, mode) {
        const _super = this._super.bind(this);
        await this.useEmployee.openRecord(record, mode);
        _super(...arguments);
    },
});