/** @odoo-module **/

import tour from 'web_tour.tour';

tour.register('payroll_dashboard_ui_tour', {
    test: true,
    url: '/web',
}, [
    tour.stepUtils.showAppsMenuItem(),
    {
        content: "Open payroll app",
        trigger: '.o_app[data-menu-xmlid="hr_work_entry_contract_enterprise.menu_hr_payroll_root"]',
    },
    {
        content: "Employees without running contracts",
        trigger: 'a:contains("Employees Without Running Contracts")',
    },
    {
        content: "Open employee profile",
        trigger: 'tr.o_data_row',
    },
    {
        content: "Open contract history",
        trigger: 'button[name="action_open_contract_history"]',
    },
    {
        content: "Create new contract",
        trigger: 'button[name="hr_contract_view_form_new_action"]',
    },
    {
        content: "Input contract name",
        trigger: 'input.o_field_char[name="name"]',
        run: 'text Laurie\'s Contract',
    },
    {
        content: "Set HR Responsible",
        trigger: 'div.o_field_widget.o_field_many2one[name="hr_responsible_id"] div input',
        run: 'text Laurie',
    },
    {
        content: "Select HR Reponsible",
        id: "set_hr_responsible",
        trigger: '.ui-menu-item a:contains("Laurie")',
    },
    {
        content: "Save contract",
        trigger: 'button.o_form_button_save',
    },
    {
        content: "Set contract as running",
        trigger: 'button[data-value="open"]',
    },
    {
        content: "Go back to dashboard",
        trigger: 'li.breadcrumb-item:first',
    },
    {
        content: "Check that the no contract error is gone",
        trigger: 'h2.btn:contains("Warning")',
        run: function(actions) {
            const errors = $('.o_hr_payroll_dashboard_block div.row div.col a:contains("Employees Without Running Contracts")').length;
            if (errors) {
                console.error("There should be no no running contract issue on the dashboard");
            }
        },
    },
    {
        content: "Create a new note",
        trigger: 'div.o_hr_payroll_todo_create',
    },
    {
        content: "Set a name",
        trigger: 'input[name="name"]',
        run: 'text Dashboard Todo List',
    },
    {
        content: "Save the note",
        trigger: 'footer button[special="save"]',
    },
    {
        content: "Click on new note",
        trigger: "div.o_hr_payroll_todo_tab:contains('Dashboard Todo List')",
    },
    {
        content: "Edit the note in dashboard view",
        trigger: 'div.o_hr_payroll_todo_value',
    },
]);
