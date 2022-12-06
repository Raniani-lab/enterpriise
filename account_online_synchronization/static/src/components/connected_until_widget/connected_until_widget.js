/** @odoo-module **/

import { registry } from "@web/core/registry";
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";
import { useService } from "@web/core/utils/hooks";
import { Component, useState } from "@odoo/owl";

class ConnectedUntil extends Component {
    static template = "account_online_synchronization.ConnectedUntil";
    setup() {
        this.state = useState({
            isHovered: false,
        });
        this.action = useService("action");
        this.orm = useService("orm");
    }

    onMouseEnter() {
        this.state.isHovered = true;
    }

    onMouseLeave() {
        this.state.isHovered = false;
    }

    async extendConnection() {
        const action = await this.orm.call('account.journal', 'action_extend_consent', [this.props.journal_id], {});
        this.action.doAction(action);
    }
}

ConnectedUntil.props = {
    ...standardWidgetProps,
    formatted_date: { type: String, optional: false },
    journal_id: { type: Number, optional: false},
    styling: { type: String, optional: false},
    warning: { type: Boolean, optional: false},
};

export const connectedUntil = {
    component: ConnectedUntil,
    extractProps: ({ attrs }) => ({
        formatted_date: attrs.formatted_date || "",
        journal_id: attrs.journal_id || 0,
        styling: attrs.styling || "",
        warning: attrs.warning || false,
    }),
};

registry.category("view_widgets").add("connected_until_widget", connectedUntil);
