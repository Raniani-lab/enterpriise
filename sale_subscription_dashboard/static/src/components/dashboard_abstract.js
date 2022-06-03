/** @odoo-module **/

import { loadJS } from "@web/core/assets";
import { useService } from "@web/core/utils/hooks";
import { Component, onWillStart } from "@odoo/owl";

const { DateTime } = luxon;

export class SaleSubscriptionDashboardAbstract extends Component {
    setup() {
        this.actionService = useService("action");
        this.rpc = useService("rpc");
        this.user = useService("user");
        onWillStart(() => Promise.all([
            loadJS("/web/static/lib/Chart/Chart.js"),
            this.fetchData(),
        ]));
    }

    async fetchData() {}

    /**
     * Sets the ranges using the dates returned from the server mapped to
     * the structure that is used in the template.
     * The template structure is an array of objects where the positions
     * of the array represent where the ranges should be separated in the
     * UI with a separator
     */
     convertDates(ranges) {
        this.state.dashboard_options.ranges.forEach((section, index) => {
            Object.keys(this.state.dashboard_options.ranges[index]).forEach((key) => {
                if (ranges[key] && ranges[key].date_from && ranges[key].date_to) {
                    this.state.dashboard_options.ranges[index][key].date_from = DateTime.fromISO(ranges[key].date_from);
                    this.state.dashboard_options.ranges[index][key].date_to = DateTime.fromISO(ranges[key].date_to);
                }
            })
        });
    }
}
