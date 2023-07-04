/** @odoo-module **/

import { isDisplayStandalone } from "@web/core/browser/feature_detection";
import { patch } from "@web/core/utils/patch";
import { BurgerMenu } from "@web/webclient/burger_menu/burger_menu";
import { shareUrl } from "./share_url";

if (navigator.share && isDisplayStandalone()) {
    patch(BurgerMenu.prototype, "web_enterprise.BurgerMenu", {
        shareUrl,
    });

    patch(BurgerMenu, "web_enterprise.BurgerMenu", {
        template: "web_enterprise.BurgerMenu",
    });
}
