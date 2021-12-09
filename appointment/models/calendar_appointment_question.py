# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo import api, fields, models, _
from odoo.exceptions import ValidationError

class CalendarAppointmentQuestion(models.Model):
    _name = "calendar.appointment.question"
    _description = "Online Appointment : Questions"
    _order = "sequence"

    sequence = fields.Integer('Sequence')
    appointment_type_id = fields.Many2one('calendar.appointment.type', 'Appointment Type', ondelete="cascade")
    name = fields.Char('Question', translate=True, required=True)
    placeholder = fields.Char('Placeholder', translate=True)
    question_required = fields.Boolean('Required Answer')
    question_type = fields.Selection([
        ('char', 'Single line text'),
        ('text', 'Multi-line text'),
        ('select', 'Dropdown (one answer)'),
        ('radio', 'Radio (one answer)'),
        ('checkbox', 'Checkboxes (multiple answers)')], 'Question Type', default='char')
    answer_ids = fields.One2many('calendar.appointment.answer', 'question_id', string='Available Answers', copy=True)

    @api.constrains('question_type', 'answer_ids')
    def _check_question_type(self):
        incomplete_questions = self.filtered(lambda question: question.question_type in ['select', 'radio', 'checkbox'] and not question.answer_ids)
        if incomplete_questions:
            raise ValidationError(
                _('The following question(s) do not have any selectable answers : %s',
                  ', '.join(incomplete_questions.mapped('name'))
                  )
            )

class CalendarAppointmentAnswer(models.Model):
    _name = "calendar.appointment.answer"
    _description = "Online Appointment : Answers"

    question_id = fields.Many2one('calendar.appointment.question', 'Question', required=True, ondelete="cascade")
    name = fields.Char('Answer', translate=True, required=True)
