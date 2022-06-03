/** @odoo-module **/

import { registry } from '@web/core/registry';
import { SaleSubscriptionDashboardAbstract } from '@sale_subscription_dashboard/components/dashboard_abstract';
import { SaleSubscriptionDashboardForecastBox } from './forecast_box';
import { SaleSubscriptionDashboardStatBox } from './stat_box';
import { SaleSubscriptionDashboardMainControlPanel } from '@sale_subscription_dashboard/components/main_control_panel/main_control_panel';
import { useMainDashboardData } from '@sale_subscription_dashboard/hooks/use_dashboard_data';

export class SaleSubscriptionDashboardMain extends SaleSubscriptionDashboardAbstract {
    setup() {
        super.setup();
        this.state = useMainDashboardData();
    }

    async fetchData() {
        const data = await this.rpc(
            '/sale_subscription_dashboard/fetch_data',
            {
                params: { context: this.user.context },
            }, {
                silent: true,
            },
        );
        const { dates_ranges: dateRanges, ...stateData} = data;
        Object.assign(this.state, stateData);
        this.convertDates(dateRanges);
    }

    onStatBoxClick(ev, selectedStat) {
        this.actionService.doAction(
            "sale_subscription_dashboard.action_subscription_dashboard_report_detailed",
            { props: { selectedStat } }
        );
    }

    onForecastBoxClick(ev) {
        this.actionService.doAction("sale_subscription_dashboard.action_subscription_dashboard_report_forecast");
    }
}

SaleSubscriptionDashboardMain.template = 'sale_subscription_dashboard.SaleSubscriptionDashboardMain';
SaleSubscriptionDashboardMain.components = {
    SaleSubscriptionDashboardMainControlPanel,
    SaleSubscriptionDashboardForecastBox,
    SaleSubscriptionDashboardStatBox,
}

registry.category('actions').add('sale_subscription_dashboard_main', SaleSubscriptionDashboardMain);
