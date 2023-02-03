/** @odoo-module **/

import { registry } from "@web/core/registry";

const { Component } = owl;

export class MoveReversed extends Component {}
MoveReversed.template = "account_asset.moveReversed";

export const moveReversed = {
    component: MoveReversed,
    noLabel: true,
};

registry.category("fields").add("deprec_lines_reversed", moveReversed);
