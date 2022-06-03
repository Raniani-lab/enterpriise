/** @odoo-module **/

import { DatePicker } from "@web/core/datepicker/datepicker";
import { useMainDashboardData } from "@sale_subscription_dashboard/hooks/use_dashboard_data";
import { Component } from "@odoo/owl";


export class SaleSubscriptionDashboardDateFilter extends Component {
    setup() {
        this.state = this.getState();
        this.customDate = {
            start_date: false,
            end_date: false
        }
    }

    getState() {
        return useMainDashboardData();
    }

    applyCustomDates() {
        this.state.start_date = this.customDate.start_date;
        this.state.end_date = this.customDate.end_date;
    }

    clickDateFilter(ev, filter) {
        if (filter == 'custom') {
            ev.stopPropagation();
            this.state.dashboard_options.filter = filter;
            return;
        }
        this.state.dashboard_options.filter = filter;
        const selectedRange = this.state.dashboard_options.ranges.find(section => filter in section)[filter];
        this.state.start_date = selectedRange.date_from;
        this.state.end_date = selectedRange.date_to;
    }
}

SaleSubscriptionDashboardDateFilter.components = {
    DatePicker
}

SaleSubscriptionDashboardDateFilter.template = 'sale_subscription_dashboard.date_filter';
