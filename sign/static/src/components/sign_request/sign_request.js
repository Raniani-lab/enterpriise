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
        useComponentToModel({ fieldName: 'component' });
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

Object.assign(SignRequest, {
    props: { record: Object },
    template: 'sign.SignRequest',
});

registerMessagingComponent(SignRequest);

export default SignRequest;
