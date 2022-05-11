/** @odoo-module **/

import { dashboardView } from '@web_dashboard/dashboard_view';
import PerformanceRankingDashboard from '@hr_recruitment_reports/components/team_report_dashboard';
import DashboardRanking from '@hr_recruitment_reports/components/ranking_panel';
import { registry } from "@web/core/registry";
import { useService } from '@web/core/utils/hooks';
const { useState, onWillStart } = owl;

export class RecruitmentTeamReportController extends dashboardView.Controller {
    async setup() {
        super.setup();
        this.orm = useService('orm');
        this.state = useState({
            ranking_list: [],
        });
        onWillStart(async () => {
            this.state.ranking_list = await this.orm.call('hr.recruitment.report', 'get_leaderboard', [[]]);
        });
    }
}
RecruitmentTeamReportController.template = "hr_recruitment_reports.PerformanceRankingDashboard";
RecruitmentTeamReportController.components = {
    ...dashboardView.Controller.components,
    PerformanceRankingDashboard,
    DashboardRanking,
};

registry.category("views").add('team_ranking_dashboard', {
    ...dashboardView,
    Controller: RecruitmentTeamReportController,
});

