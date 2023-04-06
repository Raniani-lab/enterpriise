/** @odoo-module */
import { Component, onWillStart, onWillUnmount, toRaw, useState } from "@odoo/owl";
import { XmlResourceEditor } from "@web_studio/client_action/xml_resource_editor/xml_resource_editor";
import { useEditorMenuItem } from "@web_studio/client_action/editor/edition_flow";
import { ReportEditorSnackbar } from "@web_studio/client_action/report_editor/report_editor_snackbar";
import { ReportRecordNavigation } from "./report_record_navigation";
import { useBus, useOwnedDialogs, useService } from "@web/core/utils/hooks";
import { ReportEditorIframe } from "../report_editor_iframe";
import { localization } from "@web/core/l10n/localization";
import { TranslationDialog } from "@web/views/fields/translation_dialog";

class ReportResourceEditor extends XmlResourceEditor {
    static props = { ...XmlResourceEditor.props, slots: Object };
    setup() {
        super.setup();
        useBus(this.env.reportEditorModel.bus, "node-clicked", (ev) => {
            const { viewId } = ev.detail;
            const nextResource = this.state.resourcesOptions.find((opt) => opt.value === viewId);
            if (nextResource) {
                this.state.currentResourceId = nextResource.value;
            }
        });
    }
}

class TranslationButton extends Component {
    static template = "web.TranslationButton";
    static props = {
        resourceId: Number,
    };

    setup() {
        this.user = useService("user");
        this.addDialog = useOwnedDialogs();
    }

    get isMultiLang() {
        return localization.multiLang;
    }
    get lang() {
        return this.user.lang.split("_")[0].toUpperCase();
    }
    onClick() {
        this.addDialog(TranslationDialog, {
            fieldName: "arch_db",
            resModel: "ir.ui.view",
            resId: this.props.resourceId,
            onSave: () => {
                const model = this.env.reportEditorModel;
                model.loadReportHtml({ resId: model.reportEnv.currentId });
            },
        });
    }
}

export class ReportEditorXml extends Component {
    static components = {
        XmlResourceEditor: ReportResourceEditor,
        ReportRecordNavigation,
        ReportEditorIframe,
        TranslationButton,
    };
    static template = "web_studio.ReportEditorXml";
    static props = {
        paperFormatStyle: String,
    };

    setup() {
        this.reportEditorModel = useState(this.env.reportEditorModel);
        this.state = useState({
            xmlChanges: null,
            get isDirty() {
                return !!this.xmlChanges;
            },
        });

        useEditorMenuItem({
            component: ReportEditorSnackbar,
            props: { state: this.state, onSave: this.save.bind(this) },
        });

        onWillStart(() => this.reportEditorModel.loadReportHtml());

        onWillUnmount(() => {
            this.save({ urgent: true });
        });
    }

    get minWidth() {
        return Math.floor(document.documentElement.clientWidth * 0.4);
    }

    async onCloseXmlEditor() {
        await this.save();
        this.reportEditorModel.mode = "wysiwyg";
    }

    onXmlChanged(changes) {
        this.state.xmlChanges = changes;
    }

    async save({ urgent = false } = {}) {
        await this.reportEditorModel.saveReport({
            urgent,
            xmlVerbatim: { ...toRaw(this.state.xmlChanges) },
        });
        this.state.xmlChanges = null;
    }

    onIframeLoaded({ iframeRef }) {
        iframeRef.el.contentWindow.document.addEventListener("click", (ev) => {
            const target = ev.target;
            const brandingTarget = target.closest(
                `[data-oe-model="ir.ui.view"][data-oe-field="arch"]`
            );
            if (!brandingTarget) {
                return;
            }
            const viewId = parseInt(brandingTarget.getAttribute("data-oe-id"));
            this.reportEditorModel.bus.trigger("node-clicked", { viewId });
        });
    }
}
