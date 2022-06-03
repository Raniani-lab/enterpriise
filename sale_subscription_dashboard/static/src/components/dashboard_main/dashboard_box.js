/** @odoo-module **/

import { useService } from "@web/core/utils/hooks";
import { loadChart, formatNumber} from '@sale_subscription_dashboard/js/sale_subscription_dashboard_utils';
import { useMainDashboardData } from '@sale_subscription_dashboard/hooks/use_dashboard_data';
import { Component, useRef, useState } from "@odoo/owl";

export class SaleSubscriptionDashboardBox extends Component {
    setup() {
        this.rpc = useService("rpc");
        this.user = useService("user");
        this.state = useMainDashboardData();
        this.chartState = useState({
            chartValues: false,
            value: false,
            percentage: 0,
            color: false
        })
        this.boxName = this.props.boxName;
        this.statType = this.props.statType;
        this.formatNumber = formatNumber;

        this.chartRef = useRef('chart');
    }

    get tooltipInfo() {
        return JSON.stringify({
            boxName: this.boxName,
            string: `${this.env._t('Current Value')}: ${this.formatNumber(this.chartState.value)}`
        })
    }

    get kpiDefinition() {
        return JSON.stringify({
            boxName: this.tooltip,
            string: '',
        })
    }

    renderChart() {
        loadChart(this.chartRef.el, false, this.chartState.chartValues, false, !this.state.has_mrr);
    }
};

SaleSubscriptionDashboardBox.template = 'sale_subscription_dashboard.box_content';
