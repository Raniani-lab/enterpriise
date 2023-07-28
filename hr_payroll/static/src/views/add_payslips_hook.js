/** @odoo-module **/

import { useOwnedDialogs, useService } from "@web/core/utils/hooks";
import { SelectCreateDialog } from "@web/views/view_dialogs/select_create_dialog";

const { useEnv } = owl;

export function useAddPayslips() {
    const addDialog = useOwnedDialogs();
    const env = useEnv();
    const notification = useService("notification");
    const orm = useService('orm');

    return async (record) => {
        if (!await record.save()) {
            return;
        }

        addDialog(SelectCreateDialog, {
            resModel: 'hr.payslip',
            title: env._t('Add Payslips'),
            noCreate: true,
            domain: [['payslip_run_id', '=', false]],
            onSelected: async (resIds) => {
                const slipIds = resIds.map((id) => id);

                await orm.write('hr.payslip', slipIds, {
                    'payslip_run_id': record.resId,
                });
                await record.load();

                notification.add(env._t('The payslips(s) are now added to the batch'), { type: 'success' });
            }
        });
    }
}
