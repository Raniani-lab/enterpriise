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
        useComponentToModel({ fieldName: 'component' });
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @returns {ApprovalView}
     */
    get approvalView() {
        return this.props.record;
    }

}

Object.assign(Approval, {
    props: { record: Object },
    template: 'approvals.Approval',
});

registerMessagingComponent(Approval);

export default Approval;
