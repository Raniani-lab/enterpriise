/** @odoo-module **/

import { ComponentAdapter } from 'web.OwlCompatibility';

const { Component } = owl;

export default class ViewsWidgetAdapter extends ComponentAdapter {
    setup() {
        super.setup(...arguments);
        // Overwrite the OWL/legacy env with the WOWL's one.
        this.env = Component.env;
    }

    get widgetArgs() {
        const {model, view, additionalContext, params, mode, view_type} = this.props.data;
        return [
            model,
            view,
            additionalContext,
            params,
            mode,
            view_type
        ];
    }
}
