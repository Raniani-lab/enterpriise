odoo.define('approvals/static/src/models/activity/activity.js', function (require) {
'use strict';

const {
    registerClassPatchModel,
    registerFieldPatchModel,
} = require('@mail/model/model_core');
const { one2one } = require('@mail/model/model_field');
const { insert, unlinkAll } = require('@mail/model/model_field_command');

registerClassPatchModel('mail.activity', 'approvals/static/src/models/activity/activity.js', {
    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    /**
     * @override
     */
    convertData(data) {
        const data2 = this._super(data);
        if ('approver_id' in data && 'approver_status' in data) {
            if (!data.approver_id) {
                data2.approval = unlinkAll();
            } else {
                data2.approval = [
                    insert({ id: data.approver_id, status: data.approver_status }),
                ];
            }
        }
        return data2;
    },
});

registerFieldPatchModel('mail.activity', 'approvals/static/src/models/activity/activity.js', {
    approval: one2one('approvals.approval', {
        inverse: 'activity',
    }),
});

});
