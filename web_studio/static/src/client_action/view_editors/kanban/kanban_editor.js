/** @odoo-module */
import { registry } from "@web/core/registry";
import { kanbanView } from "@web/views/kanban/kanban_view";
import { KanbanEditorRenderer } from "@web_studio/client_action/view_editors/kanban/kanban_editor_renderer";

class OneRecordModel extends kanbanView.Model {
    async load() {
        this.progressAttributes = false;
        await super.load(...arguments);
        let list = this.root;
        let hasRecords;
        const isGrouped = list.isGrouped;
        if (!isGrouped) {
            hasRecords = list.records.length;
        } else {
            hasRecords = list.groups.some((g) => g.list.records.length);
        }
        if (!hasRecords) {
            if (isGrouped) {
                const group = this.createDataPoint("group", {
                    ...list.commonGroupParams,
                    isFolded: false,
                    count: 0,
                    value: "",
                    displayName: "",
                    aggregates: {},
                    groupByField: list.groupByField,
                    groupDomain: [],
                    rawContext: list.rawContext,
                });
                list.groups.push(group);

                list = group.list;
            }
            await list.createRecord();
            list.editedRecord = null;
        }
    }
}

const kanbanEditor = {
    ...kanbanView,
    Renderer: KanbanEditorRenderer,
    Model: OneRecordModel,
    props(genericProps, editor, config) {
        const props = kanbanView.props(genericProps, editor, config);
        props.defaultGroupBy = props.archInfo.defaultGroupBy;
        props.Model = OneRecordModel;
        props.limit = 1;
        props.Renderer = KanbanEditorRenderer;
        return props;
    },
};
registry.category("studio_editors").add("kanban", kanbanEditor);
