/** @odoo-module */

import { _t } from "web.core";
import { AbstractBehavior } from "@knowledge/components/behaviors/abstract_behavior/abstract_behavior";
import { browser } from "@web/core/browser/browser";
import { SendAsMessageMacro, UseAsDescriptionMacro } from "@knowledge/macros/template_macros";
import { Tooltip } from "@web/core/tooltip/tooltip";
import { usePopover } from "@web/core/popover/popover_hook";
import { useService } from "@web/core/utils/hooks";
import {
    useRef,
    onMounted,
    onWillUnmount } from "@odoo/owl";


export class TemplateBehavior extends AbstractBehavior {
    setup() {
        super.setup();
        this.dialogService = useService("dialog");
        this.popover = usePopover(Tooltip);
        this.uiService = useService("ui");
        this.copyToClipboardButton = useRef("copyToClipboardButton");
        this.templateContent = useRef("templateContent");
        onMounted(() => {
            // Using ClipboardJS because ClipboardItem constructor is not
            // accepted by odoo eslint yet. In the future, it would be better
            // to use the CopyButton component (calling the native clipboard API).
            this.clipboard = new ClipboardJS(
                this.copyToClipboardButton.el,
                {target: () => this.templateContent.el}
            );
            this.clipboard.on('success', () => {
                window.getSelection().removeAllRanges();
                this.showTooltip();
            });
        });
        onWillUnmount(() => {
            if (this.clipboard) {
                this.clipboard.destroy();
            }
        });
        this.targetRecordInfo = this.knowledgeCommandsService.getCommandsRecordInfo();
    }
    showTooltip() {
        this.popover.open(this.copyToClipboardButton.el, {
            tooltip: _t("Template copied to clipboard."),
        });
        browser.setTimeout(this.popover.close, 800);
    }
    /**
     * @param {Event} ev
     */
    onClickCopyToClipboard(ev) {
        ev.stopPropagation();
        ev.preventDefault();
    }
    /**
     * Callback function called when the user clicks on the "Use As ..." button.
     * The function executes a macro that opens the latest form view containing
     * a valid target field (see `KNOWLEDGE_RECORDED_FIELD_NAMES`) and copy/past
     * the content of the template to it.
     * @param {Event} ev
     */
    onClickUseAsDescription(ev) {
        const dataTransfer = this._createHtmlDataTransfer();
        const macro = new UseAsDescriptionMacro({
            targetXmlDoc: this.targetRecordInfo.xmlDoc,
            breadcrumbs: this.targetRecordInfo.breadcrumbs,
            data: {
                fieldName: this.targetRecordInfo.fieldInfo.name,
                pageName: this.targetRecordInfo.fieldInfo.pageName,
                dataTransfer: dataTransfer,
            },
            services: {
                ui: this.uiService,
                dialog: this.dialogService,
            }
        });
        macro.start();
    }
    /**
     * Callback function called when the user clicks on the "Send as Message" button.
     * The function executes a macro that opens the latest form view, composes a
     * new message and attaches the associated file to it.
     * @param {Event} ev
     */
    onClickSendAsMessage(ev) {
        const dataTransfer = this._createHtmlDataTransfer();
        const macro = new SendAsMessageMacro({
            targetXmlDoc: this.targetRecordInfo.xmlDoc,
            breadcrumbs: this.targetRecordInfo.breadcrumbs,
            data: {
                dataTransfer: dataTransfer,
            },
            services: {
                ui: this.uiService,
                dialog: this.dialogService,
            }
        });
        macro.start();
    }
    /**
     * Create a dataTransfer object with the editable content of the template
     * block, to be used for a paste event in the editor
     */
    _createHtmlDataTransfer() {
        const dataTransfer = new DataTransfer();
        const content = this.props.anchor.querySelector('.o_knowledge_content');
        dataTransfer.setData('text/odoo-editor', `<p></p>${content.innerHTML}<p></p>`);
        return dataTransfer;
    }
}

TemplateBehavior.template = "knowledge.TemplateBehavior";
TemplateBehavior.props = {
    ...AbstractBehavior.props,
    content: { type: Object, optional: true },
};
