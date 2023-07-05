from odoo.fields import Datetime
from odoo.tests import new_test_user

from odoo.addons.project.models.project_task import CLOSED_STATES
from odoo.addons.project.tests.test_project_base import TestProjectCommon


class TestTaskGanttView(TestProjectCommon):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()

        cls.user_gantt_test_1 = new_test_user(cls.env, login='ganttviewuser1', groups='project.group_project_user')
        cls.project_gantt_test = cls.env['project.project'].create({
            'name': 'Project Gantt View Test',
        })

    def test_empty_line_current_user(self):
        """This test will check that an empty line is indeed displayed for the current user in task gantt view"""
        domain = [
            ('project_id', '=', self.project_gantt_test.id),
            ('state', 'not in', list(CLOSED_STATES)),
        ]
        empty_line_users = self.env['project.task'].with_context({
            'gantt_start_date': Datetime.to_datetime('2023-01-01'),
            'gantt_scale': 'day',
        }).with_user(self.user_gantt_test_1)._group_expand_user_ids(None, domain, None)

        self.assertTrue(self.user_gantt_test_1 in empty_line_users, 'There should be an empty line in project gantt view for test current user')
