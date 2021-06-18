/** @odoo-module **/

import { ActionContainer } from "@web/webclient/actions/action_container";
import { useService } from "@web/core/service_hook";

export class StudioActionContainer extends ActionContainer {
    setup() {
        super.setup();
        this.actionService = useService("action");
        if (this.props.initialAction) {
            this.actionService.doAction(this.props.initialAction);
        }
    }
}
