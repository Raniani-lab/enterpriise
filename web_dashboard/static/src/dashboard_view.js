/** @odoo-module **/

import { registry } from "@web/core/registry";
import { DashboardArchParser } from "./dashboard_arch_parser";
import { DashboardCompiler } from "./dashboard_compiler/dashboard_compiler";
import { DashboardModel } from "./dashboard_model";
import { DashboardController } from "./dashboard_controller";

export const dashboardView = {
    type: "dashboard",
    display_name: "dashboard",
    icon: "fa fa-tachometer",
    multiRecord: true,
    searchMenuTypes: ["filter", "comparison", "favorite"],
    Model: DashboardModel,
    Controller: DashboardController,
    ArchParser: DashboardArchParser,
    Compiler: DashboardCompiler,

    props: (genericProps, view) => {
        return {
            ...genericProps,
            Model: view.Model,
            Compiler: view.Compiler,
            ArchParser: view.ArchParser,
        };
    },
};

registry.category("views").add("dashboard", dashboardView);
