/** @odoo-module **/

import { NavBar } from "@web/webclient/navbar/navbar";
import { useService, useEffect, useBus } from "@web/core/utils/hooks";

const { useRef } = owl.hooks;

export class EnterpriseNavBar extends NavBar {
    setup() {
        super.setup();
        this.hm = useService("home_menu");
        this.menuAppsRef = useRef("menuApps");
        useBus(this.env.bus, "HOME-MENU:TOGGLED", () => this._updateMenuAppsIcon());
        useEffect(() => this._updateMenuAppsIcon());
    }
    get hasBackgroundAction() {
        return this.hm.hasBackgroundAction;
    }
    get isInApp() {
        return !this.hm.hasHomeMenu;
    }
    _updateMenuAppsIcon() {
        const menuAppsEl = this.menuAppsRef.el;
        menuAppsEl.classList.toggle("o_hidden", !this.isInApp && !this.hasBackgroundAction);
        menuAppsEl.classList.toggle("fa-th", this.isInApp);
        menuAppsEl.classList.toggle("fa-chevron-left", !this.isInApp && this.hasBackgroundAction);
        const { _t } = this.env;
        const title =
            !this.isInApp && this.hasBackgroundAction ? _t("Previous view") : _t("Home menu");
        menuAppsEl.title = title;
        menuAppsEl.ariaLabel = title;

        const menuBrand = this.el.querySelector(".o_menu_brand");
        if (menuBrand) {
            menuBrand.classList.toggle("o_hidden", !this.isInApp);
        }

        const appSubMenus = this.appSubMenus.el;
        if (appSubMenus) {
            appSubMenus.classList.toggle("o_hidden", !this.isInApp);
        }
    }
}
EnterpriseNavBar.template = "web_enterprise.EnterpriseNavBar";
