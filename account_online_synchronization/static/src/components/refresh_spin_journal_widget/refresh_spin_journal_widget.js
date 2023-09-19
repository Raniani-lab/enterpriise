/** @odoo-module **/

import { registry } from "@web/core/registry";
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";
import { useService } from "@web/core/utils/hooks";
import { Component, useState } from "@odoo/owl";

class RefreshSpin extends Component {
    static template = "account_online_synchronization.RefreshSpin";
    static props = { ...standardWidgetProps, };

    setup() {
        this.state = useState({
            isHovered: false,
        });
        this.action = useService("action");
    }

    refresh() {
        this.action.restore(this.action.currentController.jsId);
    }

    onMouseEnter() {
        this.state.isHovered = true;
    }

    onMouseLeave() {
        this.state.isHovered = false;
    }
}

export const refreshSpin = {
    component: RefreshSpin,
};

registry.category("view_widgets").add("refresh_spin_widget", refreshSpin);
