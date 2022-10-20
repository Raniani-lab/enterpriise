/** @odoo-module **/

import { registerMessagingComponent } from "@mail/utils/messaging_component";

export class VoipSystrayItemView extends owl.Component {

    /**
     * @returns {VoipSystrayItemView}
     */
    get record() {
        return this.props.record;
    }

}

Object.assign(VoipSystrayItemView, {
    props: { record: Object },
    template: "voip.SystrayItemView",
});

registerMessagingComponent(VoipSystrayItemView);
