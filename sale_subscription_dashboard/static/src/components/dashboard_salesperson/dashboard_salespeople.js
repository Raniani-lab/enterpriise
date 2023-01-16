/** @odoo-module **/

import { registry } from '@web/core/registry';
import { useService } from "@web/core/utils/hooks";
import { SaleSubscriptionDashboardAbstract } from "@sale_subscription_dashboard/components/dashboard_abstract";
import { SaleSubscriptionDashboardSalesperson } from './dashboard_salesperson';
import { SalespeopleControlPanel } from './salespeople_control_panel';
import { serializeDate } from "@web/core/l10n/dates";
import { useSalespeopleDashboardData } from '@sale_subscription_dashboard/hooks/use_dashboard_data';
import { useEffect } from "@odoo/owl";

const { DateTime } = luxon;
export class SaleSubscriptionDashboardSalespeople extends SaleSubscriptionDashboardAbstract {
    setup() {
        super.setup();
        this.barGraph = {};
        this.migrationDate = false;
        this.companyService = useService("company");
        this.currentCompany = this.companyService.currentCompany.id;
        this.PDFValues = {'salespersons_statistics': {}, 'salesman_ids': [],'graphs': {}, 'company': this.currentCompany}

        this.state = useSalespeopleDashboardData();

        useEffect(() => {
            this.fetchSalesmanStatistics();
        }, () => [
            ...this.state.selected_salespeople.map(salespeople => salespeople.id),
            this.state.start_date,
            this.state.end_date
        ]);
    }

    // holds the Chart instances that are rendered in salesperson component
    setBarGraph(id, value) {
        this.barGraph[id] = value;
    }

    async onPrintPreview() {
        const result = await this.rpc(
            '/web/dataset/call_kw/sale.subscription/print_pdf',
            {
                model: 'sale.order',
                method: 'print_pdf',
                args: [],
                kwargs: {},
            },
            {
                silent: true,
            }
        );
        for (const key in this.barGraph) {
            const base64Image = this.barGraph[key].toBase64Image();
            this.PDFValues.graphs[key] = base64Image;
        }
        result.data.rendering_values = JSON.stringify(this.PDFValues);
        return this.actionService.doAction(result);
    }

    async fetchData() {
        return this.fetchSalesManChartData();
    }

    async fetchSalesManChartData() {
        const result = await this.rpc(
            '/sale_subscription_dashboard/fetch_salesmen',
            {
                context: {
                    ...this.user.context,
                    allowed_company_ids: [this.currentCompany]
                }
            },
            {
                silent: true,
            }
        );
        this.state.available_salespeople = result.salesman_ids;
        this.PDFValues.salesman_ids = result.salesman_ids;
        const availableSalespeopleSet = new Set(this.state.available_salespeople.map(salesperson => salesperson.id));
        const allSelectedSalespeopleAvailable = this.state.selected_salespeople.reduce((prev, salesperson) => {
            return prev && availableSalespeopleSet.has(salesperson.id);
        }, true);

        if (!this.state.selected_salespeople.length || !allSelectedSalespeopleAvailable) {
            this.state.selected_salespeople = result.default_salesman || result.salesman_ids.slice(0, 1);
        }
        this.state.currency_id = result.currency_id;
        this.migrationDate = DateTime.fromISO(result.migration_date);
        this.convertDates(result.dates_ranges);
    }

    async fetchSalesmanStatistics() {
        if (!this.state.selected_salespeople.length) return;
        const result = await this.rpc(
            '/sale_subscription_dashboard/get_values_salesmen',
            {
                start_date: serializeDate(this.state.start_date),
                end_date: serializeDate(this.state.end_date),
                salesman_ids: this.state.selected_salespeople,
                context: {
                    ...this.user.context,
                    allowed_company_ids: [this.currentCompany], // TODO check if required (company service should be adding this in context)
                }
            },
            {
                silent: true,
            }
        );
        this.state.salespeople_statistics = result.salespersons_statistics;
        this.PDFValues['salespersons_statistics'] = result.salespersons_statistics;
    }

}

SaleSubscriptionDashboardSalespeople.template='sale_subscription_dashboard.salespeople';
SaleSubscriptionDashboardSalespeople.components = {
    SalespeopleControlPanel,
    SaleSubscriptionDashboardSalesperson
}

registry.category('actions').add('sale_subscription_dashboard_salespeople', SaleSubscriptionDashboardSalespeople);
