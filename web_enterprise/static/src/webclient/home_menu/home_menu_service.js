/** @odoo-module **/

import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { Mutex } from "@web/core/utils/concurrency";
import { ControllerNotFoundError } from "@web/webclient/actions/action_service";
import { HomeMenu } from "./home_menu";

const { Component, tags } = owl;

/**
 * Traverses the given menu tree, executes the given callback for each node with
 * the node itself and the list of its ancestors as arguments.
 *
 * @param {Object} tree tree of menus as exported by the menus service
 * @param {Function} cb
 * @param {[Object]} [parents] the ancestors of the tree root, if any
 */
function traverseMenuTree(tree, cb, parents = []) {
    cb(tree, parents);
    tree.childrenTree.forEach((c) => traverseMenuTree(c, cb, parents.concat([tree])));
}

/**
 * Computes the "apps" and "menuItems" props of the HomeMenu component, from a
 * given menu tree.
 *
 * @param {Object} menuTree tree of menus as exported by the menus service
 * @returns {Object} with keys "apps" and "menuItems" (HomeMenu props)
 */
export function computeHomeMenuProps(menuTree) {
    const apps = [];
    const menuItems = [];
    traverseMenuTree(menuTree, (menuItem, parents) => {
        if (!menuItem.id || !menuItem.actionID) {
            return;
        }
        const isApp = menuItem.id === menuItem.appID;
        const item = {
            parents: parents
                .slice(1)
                .map((p) => p.name)
                .join(" / "),
            label: menuItem.name,
            id: menuItem.id,
            xmlid: menuItem.xmlid,
            actionID: menuItem.actionID,
            appID: menuItem.appID,
        };
        if (isApp) {
            if (menuItem.webIconData) {
                item.webIconData = menuItem.webIconData;
            } else {
                const [iconClass, color, backgroundColor] = (menuItem.webIcon || "").split(",");
                if (backgroundColor !== undefined) {
                    // Could split in three parts?
                    item.webIcon = { iconClass, color, backgroundColor };
                } else {
                    item.webIconData = "/web_enterprise/static/img/default_icon_app.png";
                }
            }
        } else {
            item.menuID = parents[1].id;
        }
        if (isApp) {
            apps.push(item);
        } else {
            menuItems.push(item);
        }
    });
    return { apps, menuItems };
}

export const homeMenuService = {
    dependencies: ["action", "router"],
    start(env) {
        let hasHomeMenu = false; // true iff the HomeMenu is currently displayed
        let hasBackgroundAction = false; // true iff there is an action behind the HomeMenu
        const mutex = new Mutex(); // used to protect against concurrent toggling requests

        class HomeMenuAction extends Component {
            setup() {
                this.router = useService("router");
                this.menus = useService("menu");
                this.homeMenuProps = computeHomeMenuProps(this.menus.getMenuAsTree("root"));
            }
            async mounted() {
                hasHomeMenu = true;
                hasBackgroundAction = this.props.breadcrumbs.length > 0;
                this.router.pushState({ menu_id: undefined }, { lock: false, replace: true });
                this.env.bus.trigger("HOME-MENU:TOGGLED");
            }
            willUnmount() {
                hasHomeMenu = false;
                hasBackgroundAction = false;
                const currentMenuId = this.menus.getCurrentApp();
                if (currentMenuId) {
                    this.router.pushState({ menu_id: currentMenuId.id }, { lock: true });
                }
                this.env.bus.trigger("HOME-MENU:TOGGLED");
            }
        }
        HomeMenuAction.components = { HomeMenu };
        HomeMenuAction.target = "current";
        HomeMenuAction.template = tags.xml`<HomeMenu t-props="homeMenuProps"/>`;

        registry.category("actions").add("menu", HomeMenuAction);

        return {
            get hasHomeMenu() {
                return hasHomeMenu;
            },
            get hasBackgroundAction() {
                return hasBackgroundAction;
            },
            async toggle(show) {
                return mutex.exec(async () => {
                    show = show === undefined ? !hasHomeMenu : Boolean(show);
                    if (show !== hasHomeMenu) {
                        if (show) {
                            await env.services.action.doAction("menu");
                        } else {
                            try {
                                await env.services.action.restore();
                            } catch (err) {
                                if (!(err instanceof ControllerNotFoundError)) {
                                    throw err;
                                }
                            }
                        }
                    }
                    // hack: wait for a tick to ensure that the url has been updated before
                    // switching again
                    return new Promise((r) => setTimeout(r));
                });
            },
        };
    },
};

registry.category("services").add("home_menu", homeMenuService);
