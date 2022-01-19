odoo.define("documents_spreadsheet.model_selector_widget", function (require) {
    const { ComponentAdapter } = require("web.OwlCompatibility");

    const { Component } = owl;

    class ModelSelectorWidgetAdapter extends ComponentAdapter {
        setup() {
            this.env = Component.env;
        }
        /**
         * @override
         */
        get widgetArgs() {
            return [
                "ir.model",
                this.props.modelID,
                [["model", "in", this.props.models]],
            ];
        }
    }

    return { ModelSelectorWidgetAdapter };
});
