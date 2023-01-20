/** @odoo-module */

import { Dialog } from "@web/core/dialog/dialog";
import { _t, _lt } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { Many2XAutocomplete } from "@web/views/fields/relational_utils";
import { computeAppsAndMenuItems } from "@web/webclient/menus/menu_helpers";

const { Component, useState, useExternalListener, useRef, onMounted } = owl;

export class IrMenuSelector extends Component {
    setup() {
        super.setup();
        this.ref = useRef("menuSelectorRef");
        this.menus = useService("menu");
        onMounted(() => {
            if (this.props.autoFocus) {
                this.ref.el.querySelector("input")?.focus();
            }
        });
    }

    get many2XAutocompleteProps() {
        return {
            resModel: "ir.ui.menu",
            fieldString: _t("Menu Items"),
            getDomain: this.getDomain.bind(this),
            update: this.updateMenu.bind(this),
            activeActions: {},
            placeholder: _t("Select a menu..."),
            value: this._getMenuPath(this.props.menuId),
        };
    }

    updateMenu(selectedMenus) {
        this.props.onValueChanged(selectedMenus[0]?.id);
    }

    getDomain() {
        return [
            ["action", "!=", false],
            ["id", "in", this.availableMenuIds],
        ];
    }

    get availableMenuIds() {
        return this.menus
            .getAll()
            .map((menu) => menu.id)
            .filter((menuId) => menuId !== "root");
    }

    /**
     * Get the path of the given menu as a string of the form "App/Menu/Submenu".
     * @private
     */
    _getMenuPath(menuId) {
        if (menuId === undefined) {
            return "";
        }
        const menuTree = this.menus.getMenuAsTree("root");
        const computedTree = computeAppsAndMenuItems(menuTree);
        const menu = computedTree.menuItems.find((menu) => menu.id === menuId);
        if (!menu) {
            return "";
        }
        const path = menu.parents.replace(/ \/ /g, "/");
        return path + "/" + menu.label;
    }
}
IrMenuSelector.components = { Many2XAutocomplete };
IrMenuSelector.template = "spreadsheet_edition.IrMenuSelector";
IrMenuSelector.props = {
    menuId: { type: Number, optional: true },
    onValueChanged: Function,
    autoFocus: { type: Boolean, optional: true },
};

export class IrMenuSelectorDialog extends Component {
    setup() {
        this.selectedMenu = useState({
            id: undefined,
        });
        // Clicking anywhere will close the link editor menu. It should be
        // prevented otherwise the chain of event would be broken.
        // A solution would be to listen all clicks coming from this dialog and stop
        // their propagation.
        // However, the autocomplete dropdown of the Many2OneField widget is *not*
        // a child of this component. It's actually a direct child of "body" ¯\_(ツ)_/¯
        // The following external listener handles this.
        useExternalListener(document.body, "click", (ev) => ev.stopPropagation());
    }
    _onConfirm() {
        this.props.onMenuSelected(this.selectedMenu.id);
    }
    _onValueChanged(value) {
        this.selectedMenu.id = value;
    }
}
IrMenuSelectorDialog.components = { Dialog, IrMenuSelector };
IrMenuSelectorDialog.title = _lt("Select an Odoo menu to link in your spreadsheet");
IrMenuSelectorDialog.template = "spreadsheet_edition.IrMenuSelectorDialog";
