/** @odoo-module **/

import { registerMessagingComponent } from '@mail/utils/messaging_component';

const { Component } = owl;

class ApprovalView extends Component {

    /**
     * @returns {ApprovalView}
     */
    get approvalView() {
        return this.props.record;
    }

}

Object.assign(ApprovalView, {
    props: { record: Object },
    template: 'approvals.ApprovalView',
});

registerMessagingComponent(ApprovalView);
