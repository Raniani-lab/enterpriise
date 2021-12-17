/** @odoo-module **/

import { MockModels } from '@mail/../tests/helpers/mock_models';
import { patch } from 'web.utils';

patch(MockModels, 'approvals/static/tests/helpers/mock_models.js', {

    //----------------------------------------------------------------------
    // Public
    //----------------------------------------------------------------------

    /**
     * @override
     */
    generateData() {
        const data = this._super(...arguments);
        Object.assign(data, {
            'approval.request': {
                fields: {
                    activity_ids: { string: "Activities", type: 'one2many', relation: 'mail.activity' },
                    approver_ids: { string: "Approvers", type: 'one2many', relation: 'approval.approver' },
                },
                records: [],
            },
            'approval.approver': {
                fields: {
                    request_id: { string: "Request", type: "many2one", relation: 'approval.request' },
                    status: { string: "Status", type: 'selection', selection: [
                        ['new', 'New'],
                        ['pending', 'To Approve'],
                        ['waiting', 'Waiting'],
                        ['approved', 'Approved'],
                        ['refused', 'Refused'],
                        ['cancel', 'Cancel'],
                    ] },
                    user_id: { string: "User", type: "many2one", relation: 'res.users' },
                },
                records: [],
            },
        });
        return data;
    },

});
