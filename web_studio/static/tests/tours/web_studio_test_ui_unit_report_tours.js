/** @odoo-module */
import { registry } from "@web/core/registry";
import { download } from "@web/core/network/download";
import { ReportEditorModel } from "@web_studio/client_action/report_editor/report_editor_model";
import { patch } from "@web/core/utils/patch";
import { assertEqual, stepNotInStudio } from "@web_studio/../tests/tours/tour_helpers";

const getBoundingClientRect = Element.prototype.getBoundingClientRect;

function insertText(element, text, offset = 0) {
    const doc = element.ownerDocument;
    const sel = doc.getSelection();
    sel.removeAllRanges();
    const range = doc.createRange();
    range.setStart(element, offset);
    range.setEnd(element, offset);
    sel.addRange(range);
    for (const char of text) {
        element.dispatchEvent(
            new KeyboardEvent("keydown", {
                key: char,
            })
        );
        const textNode = doc.createTextNode(char);
        element.append(textNode);
        sel.removeAllRanges();
        range.setStart(textNode, 1);
        range.setEnd(textNode, 1);
        sel.addRange(range);
        element.dispatchEvent(
            new InputEvent("input", {
                inputType: "insertText",
                data: char,
                bubbles: true,
            })
        );
        element.dispatchEvent(
            new KeyboardEvent("keyup", {
                key: char,
            })
        );
    }
}

function openEditorPowerBox(element, offset = 0) {
    return insertText(element, "/", offset);
}

/* global ace */

// This function allows to use and test the feature that automatically
// saves when we leave the reportEditor.
// Implem detail: it is done at willUnmount, so we need to wait for the promise
// to be sure we leave the tour when the save is done.
function patchReportEditorModelForSilentSave() {
    const saveProms = [];
    const _unpatch = patch(ReportEditorModel.prototype, {
        saveReport() {
            const prom = super.saveReport(...arguments);
            saveProms.push(prom);
            return prom;
        },
    });

    return {
        wait: async (unpatch = true) => {
            await Promise.all(saveProms);
            if (unpatch) {
                _unpatch();
            }
        },
        saveProms,
        unpatch: _unpatch,
    };
}

let silentPatch;
registry.category("web_tour.tours").add("web_studio.test_basic_report_edition", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: ".o_web_studio_sidebar input[id='name']",
            run: "text modified in test",
        },
        {
            trigger: ".o_web_studio_menu .breadcrumb-item.active",
            run() {
                assertEqual(this.$anchor[0].textContent, "modified in test");
            },
        },
        {
            trigger: ".o-web-studio-report-editor-wysiwyg iframe p:eq(0)",
            run: "text edited with odoo editor",
        },
        {
            trigger: ".o-web-studio-report-editor-wysiwyg iframe p:eq(2)",
            run: "text edited with odoo editor 2",
        },
        {
            // Don't explicitly save, this is a feature
            trigger: ".o_web_studio_leave a",
            run(helpers) {
                silentPatch = patchReportEditorModelForSilentSave();
                helpers.click(this.$anchor);
            },
        },
        stepNotInStudio(),
        {
            trigger: "body",
            run() {
                return silentPatch.wait();
            },
        },
    ],
});

registry.category("web_tour.tours").add("web_studio.test_basic_report_edition_xml", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: ".o_web_studio_sidebar button[name='report_edit_sources']",
        },
        {
            trigger: ".o_web_studio_xml_resource_selector .o_web_studio_xml_resource_select_menu",
            run() {
                assertEqual(
                    this.$anchor[0].textContent,
                    "web_studio.test_report_document (web_studio.test_report_document)"
                );
            },
        },
        {
            trigger: ".o_web_studio_code_editor.ace_editor",
            run() {
                ace.edit(this.$anchor[0])
                    .getSession()
                    .insert(
                        { row: 2, column: 0 },
                        '<span class="test-added-0">in document view</span>\n'
                    );
            },
        },
        {
            trigger: ".o_web_studio_xml_resource_selector .o_select_menu_toggler",
        },
        {
            trigger: ".o_web_studio_xml_resource_selector .o-dropdown--menu",
            run(helpers) {
                const mainView = Array.from(
                    this.$anchor[0].querySelectorAll(".o_select_menu_item")
                ).find(
                    (el) =>
                        el.textContent ===
                        "web_studio.test_report (web_studio.studio_test_report_view)"
                );
                helpers.click(mainView);
            },
        },
        {
            trigger: ".o_web_studio_code_editor.ace_editor",
            run() {
                ace.edit(this.$anchor[0])
                    .getSession()
                    .insert(
                        { row: 2, column: 0 },
                        '<span class="test-added-1">in main view</span>\n'
                    );
            },
        },
        {
            trigger: ".o-web-studio-save-report.btn-primary",
        },
        {
            extra_trigger: ".o-web-studio-save-report:not(.btn-primary)",
            trigger: ".o-web-studio-report-container iframe body",
            run() {
                assertEqual(
                    this.$anchor[0].querySelector(".test-added-0").textContent,
                    "in document view"
                );
                assertEqual(
                    this.$anchor[0].querySelector(".test-added-1").textContent,
                    "in main view"
                );
            },
        },
    ],
});

registry.category("web_tour.tours").add("web_studio.test_basic_report_edition_rollback", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: ".o-web-studio-report-editor-wysiwyg iframe p:eq(0)",
            run: "text edited with odoo editor",
        },
        {
            // Brutally add a t-else: this will crash in python on save
            trigger: ".o-web-studio-report-editor-wysiwyg iframe body",
            run() {
                const editable = this.$anchor[0].querySelector(".odoo-editor-editable");
                const wysiwyg = $(editable).data("wysiwyg");
                const telse = document.createElement("t");
                telse.setAttribute("t-else", "");
                wysiwyg.odooEditor.execCommand("insert", telse);
            },
        },
        {
            trigger: ".o-web-studio-report-editor-wysiwyg iframe p:eq(2)",
            run: "text edited with odoo editor 2",
        },
        {
            trigger: ".o-web-studio-save-report.btn-primary",
        },
        {
            trigger: ".o_notification .o_notification_title",
            run() {
                assertEqual(this.$anchor[0].textContent, "Report edition failed");
            },
        },
        {
            trigger: ".o-web-studio-report-editor-wysiwyg iframe p:eq(0)",
            run() {
                assertEqual(this.$anchor[0].textContent, "");
            },
        },
    ],
});

registry.category("web_tour.tours").add("web_studio.test_basic_report_edition_xml_rollback", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: ".o_web_studio_sidebar button[name='report_edit_sources']",
        },
        {
            trigger: ".o_web_studio_code_editor.ace_editor",
            run() {
                ace.edit(this.$anchor[0])
                    .getSession()
                    .insert(
                        { row: 2, column: 0 },
                        '<span t-else="" class="test-added">in main view</span>'
                    );
            },
        },
        {
            trigger: ".o-web-studio-save-report.btn-primary",
        },
        {
            extra_trigger: ".o-web-studio-save-report:not(.btn-primary)",
            trigger: ".o_notification .o_notification_title",
            run() {
                assertEqual(this.$anchor[0].textContent, "Report edition failed");
            },
        },
        {
            trigger: ".o-web-studio-report-container iframe body",
            run() {
                const element = this.$anchor[0].querySelector(".test-added");
                if (element) {
                    throw new Error("The iframe should have been re-rendered after an error");
                }
            },
        },
    ],
});

registry.category("web_tour.tours").add("web_studio.test_report_reset_archs", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: ".o_web_studio_sidebar button[name='report_reset_archs']",
        },
        {
            trigger: ".modal-footer",
            run(helpers) {
                const button = Array.from(this.$anchor[0].querySelectorAll("button")).find(
                    (el) => el.textContent === "Reset report" && el.classList.contains("btn-danger")
                );
                helpers.click(button);
            },
        },
        {
            trigger: ".o-web-studio-report-editor-wysiwyg iframe body p:eq(1)",
            run() {
                assertEqual(this.$anchor[0].textContent, "from file");
            },
        },
    ],
});

let downloadProm;
let steps = [];
registry.category("web_tour.tours").add("web_studio.test_print_preview", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: ".o_web_studio_sidebar button[name='report_print_preview']",
            run(helpers) {
                downloadProm = new Promise(resolve => {
                    const unpatch = patch(download, {
                        _download(options) {
                            steps.push("download report")
                            const context = JSON.parse(options.data.context);
                            assertEqual(context["report_pdf_no_attachment"], true);
                            assertEqual(context["discard_logo_check"], true);
                            assertEqual(context["active_ids"].length, 1);
                            unpatch();
                            resolve();
                        }
                    })
                })
                return helpers.click(this.$anchor);
            }
        },
        {
            trigger: ".o-web-studio-report-editor-wysiwyg",
            async run() {
                await downloadProm;
                assertEqual(steps.length, 1)
                assertEqual(steps[0], "download report")
            },
        },
    ],
});

registry.category("web_tour.tours").add("web_studio.test_table_rendering", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: ".o-web-studio-report-editor-wysiwyg iframe .valid_table",
            run() {
                assertEqual(
                    this.$anchor[0].outerHTML,
                    `<table class="valid_table">
                    <tbody><tr><td>I am valid</td></tr>
                </tbody></table>`
                );
            },
        },
        {
            trigger: ".o-web-studio-report-editor-wysiwyg iframe .invalid_table",
            run() {
                assertEqual(
                    this.$anchor[0].outerHTML,
                    `<div class="invalid_table" oe-origin-tag="table" oe-origin-style="">
                    <t t-foreach="doc.child_ids" t-as="child" oe-context="{&quot;docs&quot;: {&quot;model&quot;: &quot;res.partner&quot;, &quot;name&quot;: &quot;Contact&quot;, &quot;in_foreach&quot;: false}, &quot;company&quot;: {&quot;model&quot;: &quot;res.company&quot;, &quot;name&quot;: &quot;Companies&quot;, &quot;in_foreach&quot;: false}, &quot;doc&quot;: {&quot;model&quot;: &quot;res.partner&quot;, &quot;name&quot;: &quot;Contact&quot;, &quot;in_foreach&quot;: true}, &quot;child&quot;: {&quot;model&quot;: &quot;res.partner&quot;, &quot;name&quot;: &quot;Contact&quot;, &quot;in_foreach&quot;: true}}">
                        <div oe-origin-tag="tr" oe-origin-style=""><div oe-origin-tag="td" oe-origin-style="" style="width: calc(100% - 10px);">I am not valid</div></div>
                    </t>
                </div>`
                );
            },
        },
        {
            trigger:
                ".o-web-studio-report-editor-wysiwyg iframe .invalid_table [oe-origin-tag='td']",
            run: "text edited with odooEditor",
        },
        {
            trigger: ".o-web-studio-report-editor-wysiwyg iframe p:eq(1)",
            run: "text p edited with odooEditor",
        },
        {
            trigger: ".o_web_studio_sidebar input[id='name']",
            run: "text modified",
        },
        {
            trigger: ".o-web-studio-save-report.btn-primary",
        },
        {
            trigger: ".o-web-studio-save-report:not(.btn-primary)",
            run() {},
        },
    ],
});

registry.category("web_tour.tours").add("web_studio.test_field_placeholder", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            // 1 sec delay to make sure we call the download route
            trigger: ".o-web-studio-report-editor-wysiwyg iframe p:eq(2)",
            async run(helpers) {
                const el = this.$anchor[0];
                openEditorPowerBox(el);
            },
        },
        {
            trigger:
                ".oe-powerbox-wrapper .oe-powerbox-commandDescription:contains(Insert a field)",
        },
        {
            extra_trigger: ".o-web-studio-field-dynamic-placeholder",
            trigger: ".o-web-studio-report-editor-wysiwyg div:has(> .o-web-studio-report-container)",
            async run() {
                const placeholderBox = getBoundingClientRect.call(document.querySelector(".o-web-studio-field-dynamic-placeholder"));
                assertEqual(this.$anchor[0].scrollTop, 0);
                this.$anchor[0].scrollTop = 9999;
                await new Promise(requestAnimationFrame);
                const newPlaceholderbox = getBoundingClientRect.call(document.querySelector(".o-web-studio-field-dynamic-placeholder"));
                // The field placeholder should have followed its anchor, and it happens that the anchor's container
                // has been scrolled, so the anchor has moved upwards (and is actually outside of the viewPort, to the top)
                assertEqual(placeholderBox.top > newPlaceholderbox.top, true);
            }
        },
        {
            trigger:
                ".o-web-studio-field-dynamic-placeholder .o_model_field_selector_popover_search input",
            run: "text Job Position",
        },
        {
            trigger:
                ".o-web-studio-field-dynamic-placeholder .o_model_field_selector_popover_item_name:contains(Job Position)",
        },
        {
            trigger:
                ".o-web-studio-field-dynamic-placeholder .o_model_field_selector_default_value_input input",
            run: "text some default value",
        },
        {
            trigger: ".o-web-studio-field-dynamic-placeholder .o_model_field_selector_popover",
            run() {
                this.$anchor[0].dispatchEvent(
                    new KeyboardEvent("keydown", { key: "Enter", bubbles: true })
                );
            },
        },
        {
            trigger: ".o-web-studio-report-editor-wysiwyg iframe p:eq(0)",
            run() {
                insertText(this.$anchor[0], "edited with odooEditor");
            },
        },
        {
            trigger: ".o-web-studio-save-report.btn-primary",
        },
        {
            trigger: ".o-web-studio-save-report:not(.btn-primary)",
        },
    ],
});

registry.category("web_tour.tours").add("web_studio.test_edition_without_lang", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: ".o-web-studio-report-editor-wysiwyg iframe p:eq(1)",
            run() {
                assertEqual(this.$anchor[0].textContent, "original term");
            },
        },
        {
            trigger: ".o-web-studio-report-editor-wysiwyg iframe p:eq(1)",
            async run() {
                insertText(this.$anchor[0], " edited");
            },
        },
        {
            trigger: ".o_web_studio_sidebar button[name='report_edit_sources']",
        },
        {
            trigger: ".o_web_studio_code_editor_info .o_field_translate",
        },
        {
            trigger: ".o_translation_dialog .row:eq(1)",
            run() {
                assertEqual(this.$anchor[0].children[0].textContent.trim(), "French / Français");
                assertEqual(this.$anchor[0].children[1].textContent.trim(), "original term edited");
            },
        },
        {
            trigger: ".o_translation_dialog .row:eq(1) textarea",
            run: "text translated edited term",
        },
        {
            trigger: ".modal-footer button.btn-primary",
        },
    ],
});

registry.category("web_tour.tours").add("web_studio.test_report_xml_other_record", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: ".o_web_studio_sidebar button[name='report_edit_sources']",
        },
        {
            extra_trigger: ".o_web_studio_xml_editor",
            trigger: ".o-web-studio-report-container iframe body p:contains(partner_1)",
            run() {
                assertEqual(
                    document.querySelector(".o-web-studio-report-search-record input").value,
                    "partner_1"
                );
            },
        },
        {
            trigger: ".o-web-studio-report-pager .o_pager_next",
        },
        {
            trigger: ".o-web-studio-report-container iframe body p:contains(partner_2)",
            run() {
                assertEqual(
                    document.querySelector(".o-web-studio-report-search-record input").value,
                    "partner_2"
                );
            },
        },
    ],
});

registry.category("web_tour.tours").add("web_studio.test_partial_eval", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: ".o-web-studio-report-container iframe .lol",
            run() {
                const closestContextElement = this.$anchor[0].closest("[oe-context]");
                const oeContext = closestContextElement.getAttribute("oe-context");
                const expected = {
                    docs: { model: "res.partner", name: "Contact", in_foreach: false },
                    company: { model: "res.company", name: "Companies", in_foreach: false },
                    doc: { model: "res.partner", name: "Contact", in_foreach: true },
                    my_children: { model: "res.partner", name: "Contact", in_foreach: false },
                    child: { model: "res.partner", name: "Contact", in_foreach: true },
                };
                assertEqual(JSON.stringify(JSON.parse(oeContext)), JSON.stringify(expected));
            },
        },
        {
            trigger: ".o-web-studio-report-container iframe .couic",
        },
    ],
});

registry.category("web_tour.tours").add("web_studio.test_render_multicompany", {
    test: true,
    sequence: 260,
    steps: () => [
        {
            trigger: ".o-web-studio-report-container iframe .test_layout",
            run() {},
        },
        {
            trigger: ".o-web-studio-report-container iframe img",
            run() {
                const currentUrl = new URL(window.location)
                const cids = new URLSearchParams(currentUrl.hash.slice(1)).get("cids").split(",");
                assertEqual(this.$anchor[0].getAttribute("src"), `/logo.png?company=${cids[0]}`)
            }
        },
    ],
});
