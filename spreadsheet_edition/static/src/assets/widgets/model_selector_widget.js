odoo.define("spreadsheet_edition.model_selector_widget", function (require) {
    const { ComponentAdapter } = require("web.OwlCompatibility");

    const { Component } = owl;

    class ModelSelectorWidgetAdapter extends ComponentAdapter {
        setup() {
            super.setup();
            this.env = Component.env;
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
            return ["ir.model", this.props.modelID, [["model", "in", this.props.models]]];
        }
    }

    return { ModelSelectorWidgetAdapter };
});
