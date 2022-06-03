/** @odoo-module **/

"use strict";

import { session } from "@web/session";
import { makeTestEnv } from "@web/../tests/helpers/mock_env";
import { nbsp } from "@web/core/utils/strings";
import { patchWithCleanup, getFixture, mount, nextTick } from "@web/../tests/helpers/utils";
import { SaleSubscriptionDashboardMain } from '@sale_subscription_dashboard/components/dashboard_main/dashboard_main';
import { DashboardForecast } from '@sale_subscription_dashboard/components/dashboard_forecast/dashboard_forecast';
import { SaleSubscriptionDashboardDetailed } from "@sale_subscription_dashboard/components/dashboard_detailed/dashboard_detailed";
import { SaleSubscriptionDashboardSalespeople } from "@sale_subscription_dashboard/components/dashboard_salesperson/dashboard_salespeople";
import { dashboardDataService } from "@sale_subscription_dashboard/hooks/use_dashboard_data";
import { browser } from "@web/core/browser/browser";
import { registry } from "@web/core/registry";
import { companyService } from "@web/webclient/company_service";
import { setupViewRegistries } from "@web/../tests/views/helpers";

const serviceRegistry = registry.category("services");
let fixture;

const data = {
    fetch_data: {
        stat_types: {
            net_revenue: {
                prior: 1,
                add_symbol: "currency",
                code: "net_revenue",
                name: "Net Revenue",
                dir: "up",
                type: "sum",
            }
        },
        forecast_stat_types: {
            mrr_forecast: {
                prior: 1,
                add_symbol: "currency",
                code: "mrr_forecast",
                name: "Forecasted Annual MRR Growth",
            },
        },
        currency_id: 2,
        contract_templates: [{
            id: 1,
            name: "Odoo Monthly",
        }, {
            id: 2,
            name: "Odoo Yearly",
        }],
        companies: [{
            id: 1,
            name: "YourCompany",
        }],
        has_mrr: true,
        has_template: true,
        dates_ranges: {
            'this_year': {'date_from':  '2020-01-01', 'date_to': '2020-12-31'},
            'last_year': {'date_from': '2019-01-01' , 'date_to': '2019-12-31'},
            'this_quarter': {'date_from':  '2019-12-01' , 'date_to': '2020-02-01'},
            'last_quarter': {'date_from': '2019-09-01', 'date_to': '2019-11-31'},
            'this_month': {'date_from': '2020-02-01', 'date_to':  '2020-02-29'},
            'last_month':  {'date_from': '2020-01-01', 'date_to': '2020-01-31' },
        }

    },
    compute_stats_graph: {
        graph: [{
            0: "2017-08-15",
            1: 0,
            series: 0,
        }, {
            0: "2017-08-16",
            1: 0,
            series: 0,
        }, {
            0: "2017-08-17",
            1: 0,
            series: 0,
        }, {
            0: "2017-08-18",
            1: 0,
            series: 0,
        }, {
            0: "2017-08-19",
            1: 0,
            series: 0,
        }, {
            0: "2017-08-20",
            1: 0,
            series: 0,
        }, {
            0: "2017-08-21",
            1: 0,
            series: 0,
        }, {
            0: "2017-08-22",
            1: 240,
            series: 0,
        }, {
            0: "2017-08-23",
            1: 40,
            series: 0,
        }, {
            0: "2017-08-24",
            1: 0,
            series: 0,
        }],
        stats: {
            perc: 0,
            value_1: "0",
            value_2: "280"
        }

    },
    forecast_values: {
        starting_value: 1056,
        projection_time: 12,
        churn: 0,
        expon_growth: 15,
        linear_growth: 0,
    },
    fetch_salesmen: {
        currency_id: 2,
        migration_date: '2020-01-01',
        default_salesman: [{
            id: 1,
            name: "Mitchell Admin",
        }],
        salesman_ids: [{
            id: 1,
            name: "Mitchell Admin",
        }, {
            id: 5,
            name: "Marc Demo",
        }],
        dates_ranges: {
            'this_year': {'date_from':  '2020-01-01', 'date_to': '2020-12-31'},
            'last_year': {'date_from': '2019-01-01' , 'date_to': '2019-12-31'},
            'this_quarter': {'date_from':  '2019-12-01' , 'date_to': '2020-02-01'},
            'last_quarter': {'date_from': '2019-09-01', 'date_to': '2019-11-31'},
            'this_month': {'date_from': '2020-02-01', 'date_to':  '2020-02-29'},
            'last_month':  {'date_from': '2020-01-01', 'date_to': '2020-01-31' },
        }
    },
    salesman_values: {
        salespersons_statistics: {1: {
            new: 625,
            churn: 0,
            up: 50,
            down: 0,
            net_new: 600,
            contract_modifications: [{
                partner: "Agrolait",
                account_analytic: "Agrolait",
                account_analytic_template: "Odoo Monthly",
                previous_mrr: 500,
                current_mrr: 800,
                diff: 300,
                type: 'up',
            }],
            nrr: 1195,
            nrr_invoices: [{
                partner: "Joel Willis",
                account_analytic_template: "Odoo Monthly",
                nrr: 20.0,
                account_analytic: false,
                move_id: 1,
            }, {
                partner: "Agrolait",
                account_analytic_template: "Odoo Monthly",
                nrr: 525.0,
                account_analytic: false,
                move_id: 2,
            }, {
                partner: "Agrolait",
                account_analytic_template: "Odoo Monthly",
                nrr: 650.0,
                account_analytic: false,
                move_id: 3,
            }]
        }}
    },
    get_stats_by_plan: [{
        name: "Odoo Monthly",
        nb_customers: 0,
        value: 0,
    }, {
        name: "Odoo Yearly",
        nb_customers: 0,
        value: 0,
    }],
    get_stats_history: {
        value_1_months_ago: 0,
        value_3_months_ago: 0,
        value_12_months_ago: 0,
    },
    compute_stat: 10495,
};

QUnit.module('sale_subscription_dashboard', {
    beforeEach: function (assert) {
        patchWithCleanup(browser.sessionStorage, {
            getItem(key) {
                if (key === 'mainDashboardData') {
                    return JSON.stringify({
                        start_date: "2022-01-01T00:00:00.000+01:00",
                        end_date: "2022-12-31T00:00:00.000+01:00",
                        filters: {
                            template_ids: [],
                            tag_ids: [],
                            sale_team_ids: [],
                            company_ids: [data.fetch_data.companies[0].id],
                        },
                        stat_types: data.fetch_data.stat_types,
                        forecast_stat_types: data.fetch_data.forecast_stat_types,
                        currency_id: 2,
                        contract_templates: data.fetch_data.contract_templates,
                        companies: data.fetch_data.companies,
                        has_mrr: true,
                        has_template: true,
                        sales_team: false,
                        dashboard_options: {
                            filter: 'last_month',
                            ranges: [
                                {
                                    this_month: {name: 'This Month', date_from: undefined, date_to: undefined},
                                    this_quarter: {name: 'This Quarter', date_from: undefined, date_to: undefined},
                                    this_year: {name:'This Financial Year', date_from: undefined, date_to: undefined},
                                },
                                {
                                    last_quarter: {name: 'Last Quarter', date_from: undefined, date_to: undefined},
                                    last_month: {name: 'Last Month', date_from: undefined, date_to: undefined},
                                    last_year: {name: 'Last Financial Year', date_from: undefined, date_to: undefined},
                                },
                            ],
                        }
                    });
                } else if (key === 'salespeopleDashboardData') {
                    return JSON.stringify({
                        start_date: "2022-01-01T00:00:00.000+01:00",
                        end_date: "2022-12-31T00:00:00.000+01:00",
                        selected_salespeople: data.fetch_salesmen.default_salesman,
                        available_salespeople: data.fetch_salesmen.salesman_ids,
                        salespeople_statistics: data.salesman_values.salespersons_statistics,
                        currency_id: 2,
                        dashboard_options: {
                            filter: 'last_month',
                            ranges: [
                                {
                                    this_month: {name: 'This Month', date_from: undefined, date_to: undefined},
                                    this_quarter: {name: 'This Quarter', date_from: undefined, date_to: undefined},
                                    this_year: {name:'This Financial Year', date_from: undefined, date_to: undefined},
                                },
                                {
                                    last_quarter: {name: 'Last Quarter', date_from: undefined, date_to: undefined},
                                    last_month: {name: 'Last Month', date_from: undefined, date_to: undefined},
                                    last_year: {name: 'Last Financial Year', date_from: undefined, date_to: undefined},
                                },
                            ],
                        }
                    })
                }
            }
        });
        patchWithCleanup(session.currencies, {
            2: {
                digits: [69, 2],
                position: "before",
                symbol: "$",
            }
        });

        setupViewRegistries();
        serviceRegistry.remove("company"); //removes fake company service from registry
        serviceRegistry.add("company", companyService);
        serviceRegistry.add("dashboardDataService", dashboardDataService);
        fixture = getFixture();
    },
}, function () {

    QUnit.test('sale_subscription_test', async function (assert) {
        assert.expect(2);
        const mockRPC = (route, params) => {
            if (route === '/sale_subscription_dashboard/fetch_data') {
                return Promise.resolve(data.fetch_data);
            }
            if (route === '/sale_subscription_dashboard/compute_graph_and_stats') {
                return Promise.resolve(data.compute_stats_graph);
            }
            if (route === '/sale_subscription_dashboard/get_default_values_forecast') {
                return Promise.resolve(data.forecast_values);
            }
            return Promise.resolve();
        };
        const env = await makeTestEnv({ mockRPC , config: { breadcrumbs: [] }});
        await mount(SaleSubscriptionDashboardMain, fixture, { env });
        await nextTick();
        assert.strictEqual(fixture.querySelector('.on_stat_box .o_stat_box_card_amount').innerText, `$${nbsp}280.00`, "Should contain net revenue amount '$ 280.00'")
        assert.strictEqual(fixture.querySelector('.on_forecast_box .o_stat_box_card_amount').innerText, `$${nbsp}1.06k`, "Should contain forecasted annual amount '$ 1.06k'");
    });

    QUnit.test('sale_subscription_forecast', async function (assert) {
        assert.expect(10);
        const mockRPC = (route, params) => {
            if (route === '/sale_subscription_dashboard/get_default_values_forecast') {
                assert.deepEqual(Object.keys(params).sort(), ['context', 'end_date', 'filters', 'forecast_type'], "should be requested only with defined parameters");
                return Promise.resolve(data.forecast_values);
            }
            return Promise.resolve();
        };
        const env = await makeTestEnv({ mockRPC , config: { breadcrumbs: []}});
        await mount(DashboardForecast, fixture, { env });
        await nextTick();

        assert.containsOnce(fixture, '.o_account_contract_dashboard', "should have a dashboard");
        assert.containsN(fixture, '.o_account_contract_dashboard .box', 2, "should have a dashboard with 2 forecasts");

        assert.containsOnce(fixture, '.o_account_contract_dashboard .box:first #forecast_summary_mrr', "first forecast should have summary header");
        assert.containsOnce(fixture, '.o_account_contract_dashboard .box:first .o_forecast_options', "first forecast should have options");
        assert.containsOnce(fixture, '.o_account_contract_dashboard .box:first #forecast_chart_div_mrr', "first forecast should have chart");

        assert.containsOnce(fixture, '.o_account_contract_dashboard .box:last #forecast_summary_contracts', "last forecast should have summary header");
        assert.containsOnce(fixture, '.o_account_contract_dashboard .box:last .o_forecast_options', "last forecast should have options");
        assert.containsOnce(fixture, '.o_account_contract_dashboard .box:last #forecast_chart_div_contracts', "last forecast should have chart");
    });

    QUnit.test('sale_subscription_detailed', async function (assert) {
        assert.expect(8);
        const mockRPC = (route, params) => {
            if (route === '/sale_subscription_dashboard/compute_stat') {
                return Promise.resolve(data.compute_stat);
            }
            if (route === '/sale_subscription_dashboard/get_stats_history') {
                return Promise.resolve(data.get_stats_history);
            }
            if (route === '/sale_subscription_dashboard/compute_graph') {
                return Promise.resolve(data.compute_stats_graph.graph);
            }
            if (route === '/sale_subscription_dashboard/get_stats_by_plan') {
                return Promise.resolve(data.get_stats_by_plan);
            }
            return Promise.resolve();
        };
        const env = await makeTestEnv({ mockRPC, config: { breadcrumbs: []}});
        await mount(SaleSubscriptionDashboardDetailed, fixture, { env, props: {selectedStat: 'net_revenue' }});
        await nextTick();
        assert.containsOnce(fixture, '.o_account_contract_dashboard', "should have a dashboard");
        assert.containsN(fixture, '.o_account_contract_dashboard .box', 3, "should have a dashboard with 3 boxes");

        assert.containsOnce(fixture, '.o_account_contract_dashboard .box.o_graph_detailed', "should have in first a graph box");
        assert.containsOnce(fixture, '.o_account_contract_dashboard .box.o_graph_detailed .o_metric_current', "should have the current metric");
        assert.strictEqual(
            fixture.querySelector('.o_account_contract_dashboard .box.o_graph_detailed .o_metric_current').innerText,
            `$${nbsp}10.50k`,
            "should format correctly the current metric value"
        );
        assert.containsOnce(fixture, '.o_account_contract_dashboard .box.o_graph_detailed #stat_chart_div', "should display a chart");

        assert.containsOnce(fixture, '.o_account_contract_dashboard #o-stat-history-box.box', "should have in second a history box");
        assert.containsOnce(fixture, '.o_account_contract_dashboard .box table', "should have in third a table box");
    });

    QUnit.test('sale_subscription_salesman', async function (assert) {
        assert.expect(11);
        const mockRPC = (route, params) => {
            if (route === '/sale_subscription_dashboard/fetch_salesmen') {
                return Promise.resolve(data.fetch_salesmen);
            }
            if (route === '/sale_subscription_dashboard/get_values_salesmen') {
                return Promise.resolve(data.salesman_values);
            }
            return Promise.resolve();
        };
        const env = await makeTestEnv({ mockRPC, config: { breadcrumbs: [] }});
        await mount(SaleSubscriptionDashboardSalespeople, fixture, { env });
        await nextTick();
        assert.containsOnce(fixture, '#mrr_growth_salesperson', " should display the salesman graph");
        const h2 = fixture.querySelectorAll('h2');
        assert.equal(h2[0].innerText, `Monthly Recurring Revenue : $${nbsp}600.00`, "should contain the Monthly Recurring Revenue Amount '$ 600.00'");
        assert.equal(h2[1].innerText, `Non-Recurring Revenue : $${nbsp}1.20k`, "should contain the Non-Recurring Revenue Amount ' $ 1.20k'");
        assert.containsOnce(fixture, '.contract_modifications', "should display the list of subscription");
        const subscriptionRowTDs = fixture.querySelectorAll('.o_subscription_row td');
        assert.strictEqual(subscriptionRowTDs[2].innerText, "Agrolait", "should contain subscription modifications partner 'Agrolait'");
        assert.strictEqual(subscriptionRowTDs[6].innerText, `$${nbsp}500.00`, "should contain previous MRR Amount '$ 500.00'");
        assert.strictEqual(subscriptionRowTDs[7].innerText, `$${nbsp}800.00`, "should contain current MRR Amount '$ 800.00'");
        assert.strictEqual(subscriptionRowTDs[8].innerText, `$${nbsp}300.00`, "should contain delta '$ 300.00'");
        assert.containsOnce(fixture, '.nrr_invoices', "should display the list of NRR Invoices");
        const NRRInvoicesRows = fixture.querySelectorAll('.nrr_invoices tr');
        const NRRInvoicesSecondRow = NRRInvoicesRows && NRRInvoicesRows[2];
        assert.strictEqual(NRRInvoicesSecondRow.querySelectorAll('td')[1].innerText, "Agrolait", "should contain NRR Invoices partner 'Agrolait'");
        assert.strictEqual(NRRInvoicesSecondRow.querySelectorAll('td')[4].innerText, `$${nbsp}525.00`, "should contain NRR Invoices Amount '$ 525.00'");
    });

    QUnit.test('clicking on a box make the right doAction', async function (assert) {
        assert.expect(2);
        serviceRegistry.remove('action');
        serviceRegistry.add('action', {
            start() {
                return { 
                    doAction(action, options) {
                        assert.equal(action, 'sale_subscription_dashboard.action_subscription_dashboard_report_detailed');
                        assert.equal(options.props.selectedStat, 'net_revenue');
                    },
                };
            }
        });
        const mockRPC = (route, params) => {
            if (route === '/sale_subscription_dashboard/fetch_data') {
                return Promise.resolve(data.fetch_data);
            }
            if (route === '/sale_subscription_dashboard/compute_graph_and_stats') {
                return Promise.resolve(data.compute_stats_graph);
            }
            if (route === '/sale_subscription_dashboard/get_default_values_forecast') {
                return Promise.resolve(data.forecast_values);
            }
        };
        const env = await makeTestEnv({ mockRPC, config: { breadcrumbs: []}});
        await mount(SaleSubscriptionDashboardMain, fixture, { env });
        await nextTick();
        fixture.querySelector('.on_stat_box').click();
        serviceRegistry.remove('action');
    });
});
