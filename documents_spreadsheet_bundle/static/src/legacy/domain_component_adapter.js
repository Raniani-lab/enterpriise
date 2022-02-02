/** @odoo-module */

import { ComponentAdapter } from "web.OwlCompatibility";

const { Component } = owl;

/**
 * ComponentAdapter to allow using DomainSelector in a owl Component
 */
export default class DomainComponentAdapter extends ComponentAdapter {
    setup() {
        super.setup();
        this.env = Component.env;
    }
    get widgetArgs() {
        return [this.props.model, this.props.domain, { readonly: true, filters: {} }];
    }
}
