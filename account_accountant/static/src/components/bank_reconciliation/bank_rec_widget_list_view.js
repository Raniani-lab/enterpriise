/** @odoo-module */

import { registry } from "@web/core/registry";
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";
import { View } from "@web/views/view";

const { Component } = owl;

/**
 * This widget allows to embed a list view in the form view
 */
class FormEmbeddedListView extends Component {

    get bankRecListViewProps() {
        return {
            type: "list",
            display: { 
                controlPanel: { 
                    "top-left": false,
                    "bottom-left": false,
                }
            },
            resModel: this.props.resModel,
            searchMenuTypes: ["filter"],
            domain: this.props.record.data[this.props.dataField].domain,
            dynamicFilters: this.props.record.data[this.props.dataField].dynamic_filters,
            context: {
                ...this.props.record.data[this.props.dataField].context,
            },
            allowSelectors: false,
        }
    }
}

FormEmbeddedListView.template = "account_accountant.FormEmbeddedListView";
FormEmbeddedListView.props = {
    ...standardWidgetProps,
    resModel: { type: String },
    dataField: { type: String },
}
FormEmbeddedListView.extractProps = ({ attrs }) => ({
    resModel: attrs.resModel,
    dataField: attrs.dataField,
});
FormEmbeddedListView.components = { View }

registry.category("view_widgets").add("bank_rec_form_list", FormEmbeddedListView);
