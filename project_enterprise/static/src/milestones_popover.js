/** @odoo-module **/

import { Component } from "@odoo/owl";

export class MilestonesPopover extends Component {}
MilestonesPopover.template = "project_enterprise.MilestonesPopover";
MilestonesPopover.props = ["close", "displayMilestoneDates", "displayProjectName", "milestones"];
