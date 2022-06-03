/** @odoo-module **/

import { registry } from "@web/core/registry";
import { browser } from "@web/core/browser/browser";
import { session } from "@web/session";
import { useService } from "@web/core/utils/hooks";
import { useState, onWillDestroy, reactive, useExternalListener, validate } from "@odoo/owl";

const { DateTime } = luxon;

export const dashboardDataService = {
    dependencies: [],
    start() {
        return new Map();
    }
};

registry.category('services').add('dashboardDataService', dashboardDataService);

function useDashboardData(defaultData, sessionStorageKey, schema) {
    const dashboardData = useService('dashboardDataService');
    if (!dashboardData.has(sessionStorageKey)) {
      let storedData = JSON.parse(browser.sessionStorage.getItem(sessionStorageKey) || null);
      if (storedData) {
          storedData.start_date = DateTime.fromISO(storedData.start_date);
          storedData.end_date = DateTime.fromISO(storedData.end_date);
          // check if storedData follows the correct format
          try {
            validate(storedData, schema);
          } catch {
            storedData = {};
          }
      }
      dashboardData.set(sessionStorageKey, reactive({...defaultData, ...storedData}));
    }

    onWillDestroy(() => {
        browser.sessionStorage.setItem(sessionStorageKey, JSON.stringify(dashboardData.get(sessionStorageKey)));
    })

    useExternalListener(window, 'beforeunload', (e) => {
        browser.sessionStorage.setItem(sessionStorageKey, JSON.stringify(dashboardData.get(sessionStorageKey)));
    });

    return useState(dashboardData.get(sessionStorageKey));
}

export function useSalespeopleDashboardData() {
    const sessionStorageKey = 'salespeopleDashboardData';
    const salespeopleDashboardSchema = {
        start_date: {type: Object},
        end_date: {type: Object},
        selected_salespeople: {
            type: Array,
            element: {
                type: Object,
                shape: {
                    id: {type: Number},
                    name: {type: String},
                    display_name: {type: String, optional: true}
                }
            }
        },
        available_salespeople: {
            type: Array,
            element: {
                type: Object,
                shape: {
                    id: {type: Number},
                    name: {type: String},
                    display_name: {type: String, optional: true}
                }
            }
        },
        salespeople_statistics: {
            type: Object
        },
        currency_id: {type: Number},
        dashboard_options: {
            type: Object,
            shape: {
                filter: {
                    type: String
                },
                ranges: {
                    type: Array
                }
            }
        }
    };

    const defaultData = {
        start_date: DateTime.now().minus({months: 1}).startOf('month'),
        end_date: DateTime.now().minus({months: 1}).endOf('month'),
        selected_salespeople: [],
        available_salespeople: [],
        salespeople_statistics: {},
        currency_id: false,
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
                }
            ]
        }
    };
    return useDashboardData(defaultData, sessionStorageKey, salespeopleDashboardSchema);
}

export function useMainDashboardData() {
    const sessionStorageKey = 'mainDashboardData';
    const mainDashboardSchema = {
        start_date: {type: Object},
        end_date: {type: Object},
        filters: {
            type: Object,
            shape: {
                company_ids: {type: Array, element: {type: Number}},
                sale_team_ids: {type: Array, element: {type: Number}},
                tag_ids: {type: Array, element: {type: Number}},
                template_ids:  {type: Array, element: {type: Number}},
            }
        },
        stat_types: {type: Object},
        forecast_stat_types: {type: Object},
        currency_id: {type: Number},
        contract_templates: {
            type: Array,
            element: {
                type: Object,
                shape: {
                    id: { type: Number},
                    name: { type: String}
                }
            }
        },
        companies: {
            type: Array,
            element: {
                type: Object,
                shape: {
                    id: { type: Number},
                    name: { type: String}
                }
            }
        },
        has_mrr: {type: Boolean},
        has_template: {type: Boolean},
        sales_team: {
            type: [
                Boolean, 
                {
                    type: Array,
                    element: {
                        type: Object,
                        shape: {
                            id: { type: Number},
                            name: { type: String}
                        }
                    }
                }
            ]
        },
        dashboard_options: {
            type: Object,
            shape: {
                filter: {
                    type: String
                },
                ranges: {
                    type: Array
                }
            }
        }
    }
    const defaultData = {
        start_date: DateTime.now().minus({months: 1}).startOf('month'),
        end_date: DateTime.now().minus({months: 1}).endOf('month'),
        filters: {
            template_ids: [],
            tag_ids: [],
            sale_team_ids: [],
            company_ids: [session.company_id],
        },
        stat_types: [],
        forecast_stat_types: [],
        currency_id: false,
        contract_templates: [],
        companies: [],
        has_mrr: false,
        has_template: false,
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
                }
            ]
        }
    };
    return useDashboardData(defaultData, sessionStorageKey, mainDashboardSchema);
}
