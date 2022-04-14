/** @odoo-module **/

import { useComponentToModel } from '@mail/component_hooks/use_component_to_model';
import { registerMessagingComponent } from '@mail/utils/messaging_component';
import { LegacyComponent } from "@web/legacy/legacy_component";

class Approval extends LegacyComponent {

    /**
     * @override
     */
     setup() {
        super.setup();
        useComponentToModel({ fieldName: 'component', modelName: 'ApprovalView' });
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @returns {ApprovalView}
     */
    get approvalView() {
        return this.messaging && this.messaging.models['ApprovalView'].get(this.props.localId);
    }

}

Object.assign(Approval, {
    props: { localId: String },
    template: 'approvals.Approval',
});

registerMessagingComponent(Approval);

export default Approval;
