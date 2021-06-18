/** @odoo-module **/

import { useBus } from "@web/core/bus_hook";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/service_hook";
import { cleanDomFromBootstrap } from "@web/legacy/utils";
import { computeHomeMenuProps } from "@web_enterprise/webclient/home_menu/home_menu_service";
import { ComponentAdapter } from "web.OwlCompatibility";
import { AppCreatorWrapper } from "./app_creator/app_creator";
import { Editor } from "./editor/editor";
import { StudioNavbar } from "./navbar/navbar";
import { StudioHomeMenu } from "./studio_home_menu/studio_home_menu";

const { Component } = owl;

export class StudioClientAction extends Component {
    setup() {
        this.studio = useService("studio");
        useBus(this.studio.bus, "UPDATE", () => {
            this.render();
            cleanDomFromBootstrap();
        });

        this.menus = useService("menu");
        this.actionService = useService("action");
        this.homeMenuProps = computeHomeMenuProps(this.menus.getMenuAsTree("root"));
        useBus(this.env.bus, "MENUS:APP-CHANGED", () => {
            this.homeMenuProps = computeHomeMenuProps(this.menus.getMenuAsTree("root"));
            this.render();
        });

        this.AppCreatorWrapper = AppCreatorWrapper; // to remove
    }

    willStart() {
        return this.studio.ready;
    }

    mounted() {
        this.studio.pushState();
        document.body.classList.add("o_in_studio"); // FIXME ?
    }

    patched() {
        this.studio.pushState();
    }

    willUnmount() {
        document.body.classList.remove("o_in_studio");
    }

    async onNewAppCreated(ev) {
        const { menu_id, action_id } = ev.detail;
        await this.menus.reload();
        this.menus.setCurrentMenu(menu_id);
        const action = await this.actionService.loadAction(action_id);
        this.studio.setParams({
            mode: this.studio.MODES.EDITOR,
            editorTab: "views",
            action,
            viewType: "form",
        });
    }
}
StudioClientAction.template = "web_studio.StudioClientAction";
StudioClientAction.components = {
    StudioNavbar,
    StudioHomeMenu,
    Editor,
    ComponentAdapter: class extends ComponentAdapter {
        setup() {
            super.setup();
            this.env = owl.Component.env;
        }
    },
};
StudioClientAction.target = "fullscreen";

// force: true to override action defined by studio_action_loader
registry.category("actions").add("studio", StudioClientAction, { force: true });
