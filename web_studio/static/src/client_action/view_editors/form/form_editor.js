/** @odoo-module */

import { formView } from "@web/views/form/form_view";
import { FormEditorRenderer } from "./form_editor_renderer/form_editor_renderer";
import { FormEditorController } from "./form_editor_controller/form_editor_controller";
import { FormEditorCompiler } from "./form_editor_compiler";
import { registry } from "@web/core/registry";

class Model extends formView.Model {}
Model.Record = class RecordNoEdit extends formView.Model.Record {
    get isInEdition() {
        return false;
    }
};

const formEditor = {
    ...formView,
    Compiler: FormEditorCompiler,
    Renderer: FormEditorRenderer,
    Controller: FormEditorController,
    props(genericProps, editor, config) {
        const props = formView.props(genericProps, editor, config);
        props.Model = Model;
        props.preventEdit = true;
        return props;
    },
};
registry.category("studio_editors").add("form", formEditor);
