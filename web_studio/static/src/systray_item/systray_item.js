/** @odoo-module **/
import { registry } from "@web/core/registry";
import { useService } from "@web/core/service_hook";

export class StudioSystray extends owl.Component {
    constructor() {
        super(...arguments);
        this.actionManager = useService("action");
        this.hm = useService("home_menu");
        this.studio = useService("studio");
        this.env.bus.on("ACTION_MANAGER:UI-UPDATED", this, (mode) => {
            if (mode !== "new") {
                this.render();
            }
        });
    }
    /**
    should react to actionamanger and home menu, store the action descriptor
    determine if the action is editable
   **/
    get buttonDisabled() {
        return !this.studio.isStudioEditable();
    }
    _onClick() {
        this.studio.open();
    }
}
StudioSystray.template = "web_studio.SystrayItem";

registry.category("systray").add("StudioSystrayItem", StudioSystray, { sequence: 1 });
