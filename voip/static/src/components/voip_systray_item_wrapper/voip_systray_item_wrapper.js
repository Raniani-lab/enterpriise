/** @odoo-module **/

import { useMessagingContainer } from '@mail/component_hooks/use_messaging_container';

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
        useMessagingContainer();
    }

    get messaging() {
        return this.env.services.messaging.modelManager.messaging;
    }

}
VoipSystrayItemWrapper.props = {};

Object.assign(VoipSystrayItemWrapper, {
    template: "voip.SystrayItemWrapper",
});
