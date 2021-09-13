/* @odoo-module */
import { useEffect } from "@web/core/utils/hooks";

export class ControlPanelBottomContent extends owl.Component {
    setup() {
        useEffect(() => {
            const btns = this.el.querySelectorAll(".btn-primary,.btn-secondary");
            btns.forEach((btn) => {
                btn.classList.remove("btn-primary", "btn-secondary");
                btn.classList.add("btn-outline-secondary");
            });
            this.el
                .querySelectorAll("[class*=interval_button]")
                .forEach((el) => el.classList.add("text-muted", "text-capitalize"));
        });
    }
}
ControlPanelBottomContent.template = "web_dashboard.ControlPanelBottomContent";
