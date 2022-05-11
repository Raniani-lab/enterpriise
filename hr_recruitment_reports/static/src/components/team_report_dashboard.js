/** @odoo-module **/

const { Component } = owl;
import DashboardRanking from "./ranking_panel";

export default class PerformanceRankingDashboard extends Component {}

PerformanceRankingDashboard.template = 'hr_recruitment_reports.PerformanceRankingDashboard';
PerformanceRankingDashboard.components = { DashboardRanking };
