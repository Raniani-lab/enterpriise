/** @odoo-module **/

import { SearchDropdownItem } from "@web/search/search_dropdown_item/search_dropdown_item";
import { Component } from "@odoo/owl";

export class GroupMenu extends Component {
    get items() {
        return this.props.items;
    }

    _toggle_group(group) {
        const value = {};
        value[group] = !this.props.items[group];
        this.env.model._saveCompanySettings(value);
    }

}

GroupMenu.template = "mrp_mps.GroupMenu";
GroupMenu.components = { SearchDropdownItem };
