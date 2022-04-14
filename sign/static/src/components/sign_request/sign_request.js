/** @odoo-module **/

import { useComponentToModel } from '@mail/component_hooks/use_component_to_model';
import { registerMessagingComponent } from '@mail/utils/messaging_component';
import { LegacyComponent } from "@web/legacy/legacy_component";

class SignRequest extends LegacyComponent {

    /**
     * @override
     */
     setup() {
        super.setup();
        useComponentToModel({ fieldName: 'component', modelName: 'SignRequestView' });
    }

    //--------------------------------------------------------------------------
    // Public
    //--------------------------------------------------------------------------

    /**
     * @returns {SignRequestView}
     */
    get signRequestView() {
        return this.messaging && this.messaging.models['SignRequestView'].get(this.props.localId);
    }

}

Object.assign(SignRequest, {
    props: { localId: String },
    template: 'sign.SignRequest',
});

registerMessagingComponent(SignRequest);

export default SignRequest;
