/** @odoo-module */
import { Component, useSubEnv, useRef } from "@odoo/owl";

import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { StudioView } from "@web_studio/client_action/view_editor/studio_view";

import { InteractiveEditor } from "./interactive_editor/interactive_editor";
import { XmlEditor } from "./xml_editor/xml_editor";
import { useViewEditorModel } from "./view_editor_hook";
import { standardActionServiceProps } from "@web/webclient/actions/action_service";
import { getDefaultConfig } from "@web/views/view";

export class ViewEditor extends Component {
    static props = { ...standardActionServiceProps };
    static components = { StudioView, InteractiveEditor, XmlEditor };
    static template = "web_studio.ViewEditor";

    setup() {
        /* Services */
        this.studio = useService("studio");
        this.user = useService("user");
        this.rpc = useService("rpc");
        this.orm = useService("orm");
        /* MISC */
        // Avoid pollution from the real actionService's env
        // Set config compatible with View.js
        useSubEnv({ config: getDefaultConfig() });

        // Usefull for drag/drop
        this.rootRef = useRef("root");
        this.rendererRef = useRef("viewRenderer");

        this.viewEditorModel = useViewEditorModel(this.rendererRef);
    }

    get interactiveEditorKey() {
        const { viewType, breadcrumbs } = this.viewEditorModel;
        let key = viewType;
        if (breadcrumbs.length > 1) {
            key += `_${breadcrumbs.length}`;
        }
        return key;
    }
}
registry.category("actions").add("web_studio.view_editor", ViewEditor);
