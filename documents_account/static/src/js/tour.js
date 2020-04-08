odoo.define('documents_account.tour', function(require) {
"use strict";

const { _t } = require('web.core');
const tour = require('web_tour.tour');

tour.register('documents_account_tour', {
    url: "/web",
    rainbowManMessage: _t("Wow... 6 documents processed in a few seconds, You're good.<br/>The tour is complete. Try uploading your own documents now."),
}, [{
    trigger: '.o_app[data-menu-xmlid="documents.menu_root"]',
    content: _t("Want to become a <b>paperless company</b>? Let's discover Odoo Documents."),
    position: 'bottom',
}, { // equivalent to '.o_search_panel_label:contains('Internal')' but language agnostic.
    trigger: '.o_search_panel_category_value[data-id="1"] .o_search_panel_label',
    content: _t("Select the Internal workspace."),
    position: 'bottom',
}, {
    trigger: 'img[src="https://img.youtube.com/vi/Ayab6wZ_U1A/0.jpg"]',
    content: _t("Click on a thumbnail to <b>preview the document</b>."),
    position: 'bottom',
}, {
    trigger: '.o_close_btn',
    extra_trigger: '.o_documents_kanban',
    content: _t("<b>Close the preview</b> to go back."),
    position: 'left',
}, { // equivalent to '.o_search_panel_label_title:contains('Inbox')' but language agnostic.
    trigger: '.o_search_panel_filter_value[data-value-id="1"] .o_search_panel_label_title',
    extra_trigger: '.o_documents_kanban',
    content: _t("Let's process documents in your Inbox.<br/><i>Tip: Use Tags to filter documents and structure your process.</i>"),
    position: 'right',
}, {
    trigger: '.o_kanban_record:contains(invoice.png)',
    extra_trigger: '.o_documents_kanban',
    content: _t("Click on a card to <b>select the document</b>."),
    position: 'bottom',
}, { // equivalent to '.o_inspector_rule:contains('Send to Legal') .o_inspector_trigger_rule' but language agnostic.
    trigger: '.o_inspector_rule[data-id="3"] .o_inspector_trigger_rule',
    extra_trigger: '.o_documents_kanban',
    content: _t("Let's tag this bill as legal<br/> <i>Tips: actions can be tailored to your process, according to the workspace.</i>"),
    position: 'right',
}, { // the nth(0) ensures that the filter of the preceding step has been applied.
    trigger: '.o_kanban_record:nth(0):contains(Mails_inbox.pdf)',
    extra_trigger: '.o_documents_kanban',
    content: _t("Let's process this document, coming from our scanner."),
    position: 'bottom',
}, {
    trigger: '.o_inspector_split',
    extra_trigger: '[title="Mails_inbox.pdf"]',
    content: _t("As this PDF contains multiple documents, let's split and process in bulk."),
    position: 'bottom',
}, {
    trigger: '.o_pdf_scissors:nth(1)',
    extra_trigger: '.o_documents_pdf_canvas:nth(5)', // Makes sure that all the canvas are loaded.
    content: _t("Click on the <b>page separator</b>: we don't want to split these two pages as they belong to the same document."),
    position: 'right',
}, {
    trigger: '.o_documents_pdf_page_button:nth(3)',
    extra_trigger: '.o_documents_pdf_manager',
    content: _t("<b>Hide this page</b> as we plan to process all bills first."),
    position: 'left',
}, { // equivalent to '.o_pdf_rule_buttons:contains(Scan Bill)' but language agnostic.
    trigger: '.o_pdf_rule_buttons:nth(2)',
    extra_trigger: '.o_documents_pdf_manager',
    content: _t("Let's process these bills: turn them into vendor bills."),
    position: 'bottom',
}, { // equivalent to '.o_pdf_rule_buttons:contains(Send to Legal)' but language agnostic.
    trigger: '.o_pdf_rule_buttons:nth(1)',
    extra_trigger: '.o_pdf_rule_buttons:not(:disabled)',
    content: _t("Let's process these bills: send to Finance workspace, and scan automatically."),
    position: 'bottom',
}]);
});
