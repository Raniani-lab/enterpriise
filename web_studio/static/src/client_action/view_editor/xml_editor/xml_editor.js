/** @odoo-module */
import { Component, onWillStart, onWillUpdateProps, useState } from "@odoo/owl";
import { _lt } from "@web/core/l10n/translation";
import { ResizablePanel } from "./resizable_panel/resizable_panel";
import { CodeEditor } from "./code_editor/code_editor";
import { SelectMenu } from "@web/core/select_menu/select_menu";
import { useBus, useService } from "@web/core/utils/hooks";

export class XmlEditor extends Component {
    static template = "web_studio.XmlEditor";
    static components = { ResizablePanel, CodeEditor, SelectMenu };
    static props = {
        slots: { type: Object },
        studioViewArch: { type: String },
    };

    setup() {
        this.rpc = useService("rpc");

        this.viewEditorModel = this.env.viewEditorModel;
        this.state = useState({
            resourcesOptions: [],
            currentResource: null,
            studioViewArch: this.props.studioViewArch,
        });

        useBus(this.viewEditorModel.bus, "error", () => this.render(true));
        onWillStart(() => {
            return Promise.all([
                CodeEditor.loadJSLibs("main", "themes", "qweb"),
                this.loadResources(),
            ]);
        });

        onWillUpdateProps((nextProps) => {
            this.state.studioViewArch = nextProps.studioViewArch;
            this.tempCode = "";
        });

        this.hiddenAlerts = useState({});
        this.alerts = [
            {
                message: _lt(
                    "Editing a built-in file through this editor is not advised, as it will prevent it from being updated during future App upgrades."
                ),
            },
        ];
    }

    isStudioResource(resource) {
        return resource.id === this.viewEditorModel.studioViewId;
    }

    get arch() {
        const currentResource = this.state.currentResource;
        if (!currentResource) {
            return "";
        }
        if (this.isStudioResource(currentResource)) {
            return this.state.studioViewArch;
        }
        return currentResource.arch;
    }

    set arch(value) {
        const currentResource = this.state.currentResource;
        if (!currentResource) {
            return;
        }

        if (this.isStudioResource(currentResource)) {
            this.state.studioViewArch = value;
        } else {
            currentResource.arch = value;
        }
    }

    onFormat() {
        this.arch = window.vkbeautify.xml(this.tempCode || this.arch, 4);
    }

    hideAlert(alert) {
        this.hiddenAlerts[alert.message] = true;
    }

    shouldShowAlert(alert) {
        return !(this.hiddenAlerts[alert.message] === true);
    }

    onCloseClick() {
        this.env.viewEditorModel.switchMode();
    }

    onCodeChange(code) {
        this.tempCode = code;
    }

    onSaveClick() {
        if (!this.tempCode) {
            return;
        }
        const resource = this.state.currentResource;
        const viewId = resource.id;
        this.env.viewEditorModel.doOperation({
            type: "replace_arch",
            viewId,
            oldArch: resource.oldArch,
            newArch: this.tempCode,
        });
    }

    onResourceChange(resource) {
        this.state.currentResource = resource;
        this.tempCode = "";
    }

    async loadResources() {
        const resources = await this.rpc("/web_editor/get_assets_editor_resources", {
            key: this.env.viewEditorModel.view.id,
            get_views: true,
            get_scss: false,
            get_js: false,
            bundles: false,
            bundles_restriction: [],
            only_user_custom_files: true,
        });

        const resourcesOptions = resources.views.map((res) => ({
            label: `${res.name} (${res.xml_id})`,
            value: {
                ...res,
                oldArch: res.arch,
            },
        }));
        this.state.resourcesOptions = resourcesOptions;

        if (resourcesOptions.length >= 1) {
            const studioView = resourcesOptions.find(
                (opt) => opt.value.id === this.viewEditorModel.studioViewId
            );
            if (studioView) {
                this.state.studioViewArch = studioView.value.arch;
                this.state.currentResource = studioView.value;
            } else {
                this.state.currentResource = this.state.resourcesOptions[0].value;
            }
        }
    }
}
