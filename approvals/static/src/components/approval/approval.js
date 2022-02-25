/** @odoo-module **/

import { registerMessagingComponent } from '@mail/utils/messaging_component';
import { LegacyComponent } from "@web/legacy/legacy_component";

const { Component } = owl;

class Approval extends LegacyComponent {

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @returns {Approval}
     */
    get approval() {
        return this.messaging && this.messaging.models['Approval'].get(this.props.approvalLocalId);
    }

    //--------------------------------------------------------------------------
    // Handlers
    //--------------------------------------------------------------------------

    /**
     * @private
     */
    async _onClickApprove() {
        await this.approval.approve();
        this.trigger('o-approval-approved');
    }

    /**
     * @private
     */
    async _onClickRefuse() {
        await this.approval.refuse();
        this.trigger('o-approval-refused');
    }

}

Object.assign(Approval, {
    props: {
        approvalLocalId: String,
    },
    template: 'approvals.Approval',
});

registerMessagingComponent(Approval);

export default Approval;
