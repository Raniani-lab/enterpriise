/** @odoo-module **/

import { useService } from "@web/core/utils/hooks";
import { useMainDashboardData } from "@sale_subscription_dashboard/hooks/use_dashboard_data";
import { Component, useState } from "@odoo/owl";

export class SaleSubscriptionDashboardOptionsFilter extends Component {
    setup() {
        this.notificationService = useService("notification");
        this.rpc = useService("rpc");
        this.user = useService("user");
        this.state = useMainDashboardData();
        // copy state into local variable. We only want to update the main dashboard state after clicking the update button
        // this is done to prevent multiple API calls while changing the filters
        // spread is used to prevent state and local state having the same reference
        this.localFilters = useState({
            template_ids: [...this.state.filters.template_ids],
            tag_ids: [...this.state.filters.tag_ids],
            sale_team_ids: [...this.state.filters.sale_team_ids],
            company_ids: [...this.state.filters.company_ids],
        });
        this.availableFilters = {
            template_ids: {
                name: 'Subscription Plans',
                icon: 'fa-file-o',
                state: 'contract_templates'
            },
            tag_ids: {
                name: 'Categories',
                icon: 'fa-bar-chart',
                state: 'tags'
            },
            company_ids: {
                name: 'Companies',
                icon: 'fa-building',
                state: 'companies'
            },
            sale_team_ids: {
                name: 'Sales Team',
                icon: 'fa-users',
                state: 'sales_team'
            },
        }
    }

    onFilterSelect(ev, type, id) {
        //TODO maybe convert arrays to sets to allow O(1) insertion/deletion
        if (this.localFilters[type].includes(id)) {
            this.localFilters[type] = this.localFilters[type].filter(value => value !== id);
            return;
        }
        this.localFilters[type].push(id);
    }

    async checkCompanies() {
        return this.rpc(
            '/sale_subscription_dashboard/companies_check',
            {
                company_ids: this.localFilters.company_ids,
                context: this.user.context,
            },
            {
                silent: true,
            }
        )
    }

    async updateOptions() {
        if (!this.localFilters.company_ids || !this.localFilters.company_ids.length) {
            this.notificationService.add("Select at least one company", {
                title: this.env._t('Warning'),
                type: 'warning',
            });
            return;
        }

        const checkCompaniesResult = await this.checkCompanies();
        if (checkCompaniesResult.result) {
            this.state.currency_id = checkCompaniesResult.currency_id;
            // spread is used to prevent state and local state sharing the reference
            this.state.filters = {
                template_ids: [...this.localFilters.template_ids],
                tag_ids: [...this.localFilters.tag_ids],
                sale_team_ids: [...this.localFilters.sale_team_ids],
                company_ids: [...this.localFilters.company_ids]
            }
        } else {
            this.notificationService.add(checkCompaniesResult.error_message, {
                title: this.env._t('Warning'),
                type: 'warning'
            });
        }
    }

}

SaleSubscriptionDashboardOptionsFilter.template = 'sale_subscription_dashboard.dashboard_option_filters';
