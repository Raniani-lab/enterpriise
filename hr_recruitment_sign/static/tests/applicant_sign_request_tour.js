odoo.define('hr_recruitment_sign.tour', function (require) {
    'use strict';

    var Tour = require('web_tour.tour');

    Tour.register('applicant_sign_request_tour', {
            test: true,
            url: '/web',
        },[
            {
                content: "Access on the recruitment app",
                trigger: '.o_app[data-menu-xmlid="hr_recruitment.menu_hr_recruitment_root"]',
                run: 'click',
            },
            {
                content: "Go on applications",
                trigger: '.dropdown-toggle[title="Applications"]',
                run: 'click',
            },
            {
                content: "Go on all applications",
                trigger: 'a[data-menu-xmlid="hr_recruitment.menu_crm_case_categ_all_app"]',
                run: 'click',
            },
            {
                content: "Open Saitama's application",
                trigger: '.o_data_cell[data-tooltip="Saitama"]',
                run: 'click',
            },
            {
                content: "Open a Sign Request Wizard",
                trigger: '.o_cp_action_menus .btn.dropdown-toggle',
                run: 'click',
            },
            {
                content: "Open a Sign Request Wizard",
                trigger: ".dropdown-item:contains('Request Signature')",
                run: 'click',
            },
            {
                content: "Select the document to sign",
                trigger: 'input#sign_template_ids',
                run: 'text Non-Disclosure Agreement.pdf',
            },
            {
                content: "Select the document to sign",
                trigger: "a.dropdown-item:contains('Non-Disclosure Agreement.pdf')",
                run: 'click',
                in_modal: false,
            },
            {
                content: "Send the request",
                trigger: '.btn[name="validate_signature"]',
                run: 'click',
                in_modal: true,
            },
            {
                content: "Create an employee",
                trigger: '.btn[name="create_employee_from_applicant"]',
                run: 'click',
            },
            {
                content: "Validate the creation",
                trigger: '.btn.o_form_button_save',
                run: 'click',
            },
        ]
    );
});
