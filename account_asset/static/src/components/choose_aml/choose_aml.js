/** @odoo-module **/

import { registry } from "@web/core/registry";
import { standardWidgetProps } from "@web/views/widgets/standard_widget_props";
import { useSelectCreate, useX2ManyCrud, useActiveActions } from "@web/views/fields/relational_utils";

const { Component } = owl;

export class x2mSelector extends Component {
    setup() {
        const targetField = this.props.record.fields[this.props.field];
        const targetActiveField = this.props.record.activeFields[this.props.field];

        const { saveRecord } = useX2ManyCrud(
            () => this.props.record.data[this.props.field],
            targetField.type === 'many2many'
        );
        this.activeActions = useActiveActions({
            crudOptions: targetActiveField.options,
            fieldType: targetField.type,
            subViewActiveActions: targetActiveField.views['list'].activeActions,
            getEvalParams: (props) => {
                return {
                    evalContext: this.props.record.evalContext,
                    readonly: this.props.readonly,
                };
            },
        });
        const selectCreate = useSelectCreate({
            resModel: targetField.relation,
            activeActions: this.activeActions,
            onSelected: (resIds) => saveRecord(resIds),
        });
        this.selectCreate = (params) => {
            return selectCreate(params);
        };
    }

    selectRelatedRecords() {
        const domain = this.props.record.getFieldDomain(this.props.field).toList();
        const context = this.props.record.getFieldContext(this.props.field);
        this.selectCreate({ domain, context });
    }
}
x2mSelector.template = "account_asset.x2mSelector";
x2mSelector.props = {
    ...standardWidgetProps,
    string: { type: String },
    class: { type: String, optional: true },
    field: { type: String },
};
x2mSelector.extractProps = ({ attrs }) => ({
    string: attrs.string,
    class: attrs.wclass,
    field: attrs.field,
});

registry.category("view_widgets").add("choose_aml", x2mSelector);
