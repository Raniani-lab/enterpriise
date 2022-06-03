/** @odoo-module **/

import { useService } from "@web/core/utils/hooks";
import { getColorClass, formatMonetaryNumber } from '@sale_subscription_dashboard/js/sale_subscription_dashboard_utils';
import { useSalespeopleDashboardData } from '@sale_subscription_dashboard/hooks/use_dashboard_data';
import { Component } from "@odoo/owl";

export class ContractModifications extends Component {
    setup() {
        this.state = useSalespeopleDashboardData();
        this.actionService = useService("action");
        this.salesperson = this.props.salesperson;
        this.modifications = this.props.modifications;
        this.nCompanies = this.props.nCompanies;
        this.formatMonetaryNumber = formatMonetaryNumber;
        this.getColorClass = getColorClass;
    }

    get contractModifications() {
        return this.state.salespeople_statistics[this.salesperson.id].contract_modifications;
    }

    getClass(type) {
        const ICON_BY_TYPE = {
            'churn': 'o_red fa fa-remove',
            'new': 'o_green fa fa-plus',
            'down': 'o_red fa fa-arrow-down',
            'up': 'o_green fa fa-arrow-up',
        };
        return ICON_BY_TYPE[type] || '';
    }

    onClickModification(subscription_id, model) {
        const action = {
            name: 'Test',
            type: 'ir.actions.act_window',
            res_model: model,
            res_id: subscription_id,
            views: [[false, 'form']],
            view_mode: 'form',
            target: 'current'
        };
        this.actionService.doAction(action);
    }
}

ContractModifications.template = 'sale_subscription_dashboard.contract_modifications';
