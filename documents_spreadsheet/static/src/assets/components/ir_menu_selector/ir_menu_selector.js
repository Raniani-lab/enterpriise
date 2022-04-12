/** @odoo-module */

import { ComponentAdapter } from "web.OwlCompatibility";
import { Dialog } from "@web/core/dialog/dialog";
import { _lt } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { StandaloneMany2OneField } from "../../widgets/standalone_many2one_field";

const { Component, onMounted, onWillStart, useState, useExternalListener, xml } = owl;

export class MenuSelectorWidgetAdapter extends ComponentAdapter {
    setup() {
        super.setup();
        this.env = Component.env;
        onMounted(() => {
            this.widget.getFocusableElement().focus();
            this.widget.$el.addClass(this.props.class);
        });
    }

    _trigger_up(ev) {
        if (ev.name === "value-changed") {
            const { value } = ev.data;
            return this.props.onValueChanged(value);
        }
        super._trigger_up(ev);
    }

    /**
     * @override
     */
    get widgetArgs() {
        const domain = [
            ["action", "!=", false],
            "|",
            ["groups_id", "=", false],
            ["groups_id", "in", this.props.userGroups],
        ]
        const attrs = {
            placeholder: this.env._t("Select a menu..."),
            string: this.env._t("Menu Items"),
        };
        return ["ir.ui.menu", this.props.menuId, domain, attrs];
    }
}

export class IrMenuSelector extends Dialog {
    setup() {
        super.setup();
        this.StandaloneMany2OneField = StandaloneMany2OneField;
        this.user = useService("user");
        this.orm = useService("orm");
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
        useExternalListener(document.body, "click", (ev) => ev.stopPropagation())
        onWillStart(this.onWillStart);
    }
    async onWillStart() {
        const [{groups_id}] = await this.orm.read("res.users", [this.user.userId], ["groups_id"]);
        this.userGroups = groups_id;
    }
    _onConfirm() {
        this.props.onMenuSelected(this.selectedMenu.id);
    }
    _onValueChanged(value) {
        this.selectedMenu.id = value;
    }
}
IrMenuSelector.components = { MenuSelectorWidgetAdapter };
IrMenuSelector.title = _lt("Select an Odoo menu to link in your spreadsheet");
IrMenuSelector.size = "model-sm";

IrMenuSelector.bodyTemplate = xml/* xml */ `
    <MenuSelectorWidgetAdapter
        class="'o-ir-menu-selector'"
        Component="StandaloneMany2OneField"
        menuId="props.menuId"
        userGroups="userGroups"
        onValueChanged.bind="_onValueChanged"
    />`;
IrMenuSelector.footerTemplate = "documents_spreadsheet.IrMenuSelectorFooter";
