/** @odoo-module **/

import { registerMessagingComponent } from '@mail/utils/messaging_component';
import { LegacyComponent } from "@web/legacy/legacy_component";

export class SignRequestView extends LegacyComponent {

    /**
     * @override
     */
     setup() {
        super.setup();
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @returns {SignRequestView}
     */
    get signRequestView() {
        return this.props.record;
    }

}

Object.assign(SignRequestView, {
    props: { record: Object },
    template: 'sign.SignRequestView',
});

registerMessagingComponent(SignRequestView);
