/** @odoo-module **/

import { useSalespeopleDashboardData } from '@sale_subscription_dashboard/hooks/use_dashboard_data';
import { formatMonetaryNumber } from '@sale_subscription_dashboard/js/sale_subscription_dashboard_utils';
import { Component } from "@odoo/owl";

export class SalespersonSummary extends Component {
    setup() {
        this.state = useSalespeopleDashboardData();
        this.formatMonetaryNumber = formatMonetaryNumber;
    }
}

SalespersonSummary.template = 'sale_subscription_dashboard.salesperson_summary';
