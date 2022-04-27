/** @odoo-module **/

import { dashboardView } from "@web_dashboard/dashboard_view";
import { registry } from "@web/core/registry";

/**
 * This file defines the WebsiteSaleDashboard view and adds it to the view registry.
 * The only difference with Dashboard View is that it has a control panel with a
 * "Go to website" button.
 */
export class WebsiteSaleDashboardController extends dashboardView.Controller {}
WebsiteSaleDashboardController.template = "website_sale_dashboard.WebsiteSaleDashboardView";

registry.category("views").add('website_sale_dashboard', {
  ...dashboardView,
  Controller: WebsiteSaleDashboardController
});
