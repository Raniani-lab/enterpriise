# -*- coding: utf-8 -*-

from markupsafe import Markup
from odoo.fields import Command
from odoo.tests import tagged

from .gantt_reschedule_dates_common import ProjectEnterpriseGanttRescheduleCommon

@tagged('-at_install', 'post_install')
class TestTaskDependencies(ProjectEnterpriseGanttRescheduleCommon):

    def test_task_dependencies_display_warning_dependency_in_gantt(self):

        Stage = self.env['project.task.type']
        todo_stage = Stage.create({
            'sequence': 1,
            'name': 'TODO',
        })
        fold_stage = Stage.create({
            'sequence': 30,
            'name': 'Done',
            'fold': True,
        })
        stages = todo_stage + fold_stage
        self.project_pigs.write(
            {'type_ids': [Command.link(stage_id) for stage_id in stages.ids]})

        self.task_1.write({'stage_id': todo_stage.id})
        self.assertTrue(self.task_1.display_warning_dependency_in_gantt, 'display_warning_dependency_in_gantt should be True if the task stage is neither closed or fold')
        self.task_1.write({'stage_id': fold_stage.id})
        self.assertFalse(self.task_1.display_warning_dependency_in_gantt, 'display_warning_dependency_in_gantt should be False if the task stage is fold')

    def test_tasks_dependencies_warning_when_planning(self):
        self.task_4.write({'depend_on_ids': [Command.link(self.task_1.id)]})
        self.assertFalse(self.task_4.dependency_warning)
        self.task_5.write({'depend_on_ids': False})
        self.task_4.write({'depend_on_ids': [Command.link(self.task_5.id)]})
        self.assertEqual(self.task_4.dependency_warning, Markup('<p>This task cannot be planned before Tasks %s, on which it depends.</p>') % (self.task_5.name))
