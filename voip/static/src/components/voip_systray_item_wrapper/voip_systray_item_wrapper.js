/** @odoo-module **/

import { useModels } from "@mail/component_hooks/use_models";
import { getMessagingComponent } from "@mail/utils/messaging_component";
// Force the SystrayItemView to be loaded before its wrapper by importing it
// explicitly. It ensures that VoipSystrayItemView has been registered as a
// messaging component, allowing to retrieve it from getMessagingComponent.
import "@voip/components/voip_systray_item_view/voip_systray_item_view";

/**
 * This wrapper is intended to provide integration with the models framework. It
 * is responsible for passing the VoipSystrayItemView record to its component
 * and displaying a spinner instead of it when Messaging is not created yet.
 */
export class VoipSystrayItemWrapper extends owl.Component {

    /**
     * @override
     */
    setup() {
        useModels();
        super.setup();
    }

    get messaging() {
        return this.env.services.messaging.modelManager.messaging;
    }

}
VoipSystrayItemWrapper.props = {};

Object.assign(VoipSystrayItemWrapper, {
    components: { VoipSystrayItemView: getMessagingComponent("VoipSystrayItemView") },
    template: "voip.SystrayItemWrapper",
});
