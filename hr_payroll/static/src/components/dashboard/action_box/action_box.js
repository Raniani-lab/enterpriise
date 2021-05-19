/** @odoo-module **/

const { Component } = owl;

export class PayrollDashboardActionBox extends Component {

    // Public

    /**
     * @return {object} Complete data provided as props
     */
    get actionData() {
        return this.props.actions;
    }

    // Private

    /**
     * Executes the action given.
     *
     * @param {object} action
     */
    _doAction(action) {
        this.trigger('do-action', {
            action: action,
        });
    }
}

PayrollDashboardActionBox.template = 'hr_payroll.ActionBox';
