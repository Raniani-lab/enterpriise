/** @odoo-module **/
import { useService } from "@web/core/utils/hooks";
import { useSalespeopleDashboardData } from '@sale_subscription_dashboard/hooks/use_dashboard_data';
import { formatMonetaryNumber } from '@sale_subscription_dashboard/js/sale_subscription_dashboard_utils';
import { Component } from "@odoo/owl";

export class NRRInvoices extends Component {
    setup() {
        this.state = useSalespeopleDashboardData();
        this.formatMonetaryNumber = formatMonetaryNumber;
        this.salesperson = this.props.salesperson;
        this.nCompanies = this.props.nCompanies;
        this.actionService = useService("action");
    }

    get invoices() {
        return this.state.salespeople_statistics[this.salesperson.id].nrr_invoices;
    }

    onClickInvoice(id, model) {
        const action = {
            type: 'ir.actions.act_window',
            res_model: model,
            res_id: id,
            views: [[false, 'form']],
        };
        this.actionService.doAction(action);
    }
}

NRRInvoices.template = 'sale_subscription_dashboard.nrr_invoices';
