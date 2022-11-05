/** @odoo-module **/

import { clear, insert, one, registerPatch } from '@mail/model';

registerPatch({
    name: 'Activity',
    modelMethods: {
        /**
         * @override
         */
        convertData(data) {
            const data2 = this._super(data);
            if ('approver_id' in data && 'approver_status' in data) {
                if (!data.approver_id) {
                    data2.approval = clear();
                } else {
                    data2.approval = [
                        insert({ id: data.approver_id, status: data.approver_status }),
                    ];
                }
            }
            return data2;
        },
    },
    fields: {
        approval: one('Approval', {
            inverse: 'activity',
        }),
    },
});
