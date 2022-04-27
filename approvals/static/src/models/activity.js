/** @odoo-module **/

import { addFields, patchModelMethods } from '@mail/model/model_core';
import { one } from '@mail/model/model_field';
import { clear, insert } from '@mail/model/model_field_command';
// ensure that the model definition is loaded before the patch
import '@mail/models/activity';

patchModelMethods('Activity', {
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
});

addFields('Activity', {
    approval: one('Approval', {
        inverse: 'activity',
    }),
});
