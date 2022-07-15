# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from odoo.tests import common
import datetime

TYPE_SIZE = 8
TYPE = ['Type %s' % i for i in range(1,TYPE_SIZE + 1)]

NB_START_DAY = 15
NB_END_DAY = 30
START_DATE = datetime.datetime(2018,12,1,0,0,0)

class TestCohortCommon(common.TransactionCase):
    def setUp(self):
        super().setUp()
        self.CohortType = self.env['web.cohort.type']
        self.WebCohortSimpleModel = self.env['web.cohort.simple.model']
        self.type_ids = []
        for t in TYPE:
            self.type_ids.append(self.CohortType.create({'name': t}).id)

class TestCohortForward(TestCohortCommon):
    def setUp(self):
        super().setUp()
        start_date = START_DATE
        end_date = start_date
        data_list = []
        for i in range(0,NB_START_DAY): #Start date on 20 days
            for j in range(0,NB_END_DAY):
                data = {
                    'name': "[%s:%s]" % (i, j),
                    'type_id': self.type_ids[int(TYPE_SIZE * j / NB_END_DAY)],
                    'date_start': start_date,
                    'date_stop': end_date,
                    'revenue': j * 10,
                }
                data_list.append(data)
                end_date = end_date + datetime.timedelta(days=3)

            start_date = start_date + datetime.timedelta(days=5)
            end_date = start_date
        self.WebCohortSimpleModel.create(data_list)

    def test_forward(self):
        #Test interval
        result = self.WebCohortSimpleModel.get_cohort_data("date_start", "date_stop",
            '__count', 'year', [], 'retention', 'forward')['rows']
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]['columns'][0]['percentage'], 81)
        self.assertEqual(result[0]['columns'][1]['percentage'], 0)
        #Test when start date of column is > Today
        self.assertEqual(result[0]['columns'][14]['percentage'], '')
        #Since percentage is 0 at second year, churn value should be equal to total value
        self.assertEqual(result[0]['columns'][1]['churn_value'], result[0]['value'])
        #Total of value of each row should be equal to the number of data generated
        self.assertEqual(result[0]['value'] + result[1]['value'], NB_START_DAY * NB_END_DAY)

        result = self.WebCohortSimpleModel.get_cohort_data("date_start", "date_stop",
            '__count', 'month', [], 'retention', 'forward')['rows']
        self.assertEqual(len(result), 3)
        self.assertEqual(result[0]['columns'][0]['percentage'], 81)
        self.assertEqual(result[0]['columns'][1]['percentage'], 46.7)
        result = self.WebCohortSimpleModel.get_cohort_data("date_start", "date_stop",
            '__count', 'week', [], 'retention', 'forward')['rows']
        self.assertEqual(len(result), 11)
        self.assertEqual(result[0]['columns'][0]['percentage'], 96.7)
        self.assertEqual(result[0]['columns'][1]['percentage'], 90.0)
        result = self.WebCohortSimpleModel.get_cohort_data("date_start", "date_stop",
            '__count', 'day', [], 'retention', 'forward')['rows']
        self.assertEqual(len(result), NB_START_DAY)
        self.assertEqual(result[0]['columns'][0]['percentage'], 96.7)
        self.assertEqual(result[0]['columns'][1]['percentage'], 96.7)

        #Test measure
        result = self.WebCohortSimpleModel.get_cohort_data("date_start", "date_stop",
            'revenue', 'week', [], 'retention', 'forward')['rows']
        #Sum of value should be 0 + 10 + 20 + ... + 390 * 20, (gaussian sum 0 to 39) * 10 * 20
        self.assertEqual(sum(v['value'] for v in result), (29 * 30 / 2) * 10 * NB_START_DAY)
        #Percentage should be different from count measure and value as well
        self.assertEqual(result[0]['columns'][0]['percentage'], 100.0)
        self.assertEqual(result[0]['columns'][1]['percentage'], 99.3)
        result = self.WebCohortSimpleModel.get_cohort_data("date_start", "date_stop",
            'type_id', 'week', [], 'retention', 'forward')['rows']
        #There is 8 type so value should be 8
        self.assertEqual(result[0]['value'], TYPE_SIZE)
        #Test Churn mode
        result = self.WebCohortSimpleModel.get_cohort_data("date_start", "date_stop",
            '__count', 'year', [], 'churn', 'forward')['rows']
        #Percentage is 100 - rentention %
        self.assertEqual(result[0]['columns'][0]['percentage'], round(100 - 81, 2))
        self.assertEqual(result[0]['columns'][1]['percentage'], 100 - 0)

class TestCohortBackward(TestCohortCommon):
    def setUp(self):
        super().setUp()
        # activate an extra lang that uses ISO weeks
        self.env['res.lang']._activate_lang('en_GB')
        start_date = START_DATE
        end_date = start_date + datetime.timedelta(days=7) #Start in the future
        data_list = []
        for i in range(0,NB_START_DAY): #Start date on 20 days
            for j in range(0,NB_END_DAY):
                data = {
                    'name': "[%s:%s]" % (i, j),
                    'type_id': self.type_ids[int(TYPE_SIZE * j / NB_END_DAY)],
                    'date_start': start_date,
                    'date_stop': end_date,
                    'revenue': j * 10,
                }
                data_list.append(data)

                #Create record with date_stop empty
                data = {
                    'name': "[%s:%s] No Stop" % (i, j),
                    'type_id': self.type_ids[int(TYPE_SIZE * j / NB_END_DAY)],
                    'date_start': start_date,
                    'date_stop': False,
                    'revenue': j * 10,
                }
                data_list.append(data)
                end_date = end_date - datetime.timedelta(days=3)

            start_date = start_date + datetime.timedelta(days=5)
            end_date = start_date + datetime.timedelta(days=7)
        self.WebCohortSimpleModel.create(data_list)


    def test_backward(self):
        #Test interval
        result = self.WebCohortSimpleModel.get_cohort_data("date_start", "date_stop",
            '__count', 'year', [], 'retention', 'backward')['rows']
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0]['columns'][0]['percentage'], 100.0)
        self.assertEqual(result[0]['columns'][-1]['percentage'], 51)

        result = self.WebCohortSimpleModel.get_cohort_data("date_start", "date_stop",
            '__count', 'month', [], 'retention', 'backward')['rows']
        self.assertEqual(len(result), 3)
        self.assertEqual(result[0]['columns'][0]['percentage'], 100)
        self.assertEqual(result[0]['columns'][-2]['percentage'], 63.3)
        self.assertEqual(result[0]['columns'][-1]['percentage'], 51)

        # with ISO week
        result = self.WebCohortSimpleModel.with_context(lang='en_GB').get_cohort_data(
            "date_start", "date_stop", '__count', 'week', [], 'retention', 'backward')['rows']
        self.assertEqual(len(result), 11)
        self.assertEqual(result[0]['columns'][0]['percentage'], 100)
        self.assertEqual(result[0]['columns'][5]['percentage'], 93.3)
        self.assertEqual(result[0]['columns'][-2]['percentage'], 58.3)
        self.assertEqual(result[0]['columns'][-1]['percentage'], 53.3)

        # with en_US week
        result = self.WebCohortSimpleModel.get_cohort_data("date_start", "date_stop",
            '__count', 'week', [], 'retention', 'backward')['rows']
        self.assertEqual(len(result), 11)
        self.assertEqual(result[0]['columns'][0]['percentage'], 100)
        self.assertEqual(result[0]['columns'][5]['percentage'], 93.3)
        self.assertEqual(result[0]['columns'][-2]['percentage'], 58.3)
        self.assertEqual(result[0]['columns'][-1]['percentage'], 55)

        result = self.WebCohortSimpleModel.get_cohort_data("date_start", "date_stop",
            '__count', 'day', [], 'retention', 'backward')['rows']
        self.assertEqual(len(result), NB_START_DAY)
        self.assertEqual(result[0]['columns'][0]['percentage'], 63.3)
        self.assertEqual(result[0]['columns'][-2]['percentage'], 55)
        self.assertEqual(result[0]['columns'][-1]['percentage'], 55)

        #Test measure
        result = self.WebCohortSimpleModel.get_cohort_data("date_start", "date_stop",
            'revenue', 'week', [], 'retention', 'backward')['rows']
        result = self.WebCohortSimpleModel.get_cohort_data("date_start", "date_stop",
            'type_id', 'week', [], 'retention', 'backward')['rows']
        #There is 8 type so value should be 8
        self.assertEqual(result[0]['value'], TYPE_SIZE)
        #Test Churn mode
        result = self.WebCohortSimpleModel.get_cohort_data("date_start", "date_stop",
            '__count', 'month', [], 'churn', 'backward')['rows']
        self.assertEqual(result[0]['columns'][0]['percentage'], 100 - 100)
        self.assertEqual(result[0]['columns'][-2]['percentage'], 100 - 63.3)
        self.assertEqual(result[0]['columns'][-1]['percentage'], 100 - 51)


class TestCohortEmptyFuturBackward(TestCohortCommon):
    def setUp(self):
        super().setUp()
        start_date = START_DATE
        end_date = start_date - datetime.timedelta(days=10)
        data_list = []
        for j in range(0, 5):
            data = {
                'name': "[%s] backward" % (j),
                'type_id': self.type_ids[int(TYPE_SIZE * j / NB_END_DAY)],
                'date_start': start_date,
                'date_stop': end_date,
                'revenue': j * 10,
            }
            data_list.append(data)
            end_date = end_date + datetime.timedelta(days=1)

        self.WebCohortSimpleModel.create(data_list)

    def test_empty_backward(self):
        """
            Test when there is no data in the row 0 and in the future
        """
        result = self.WebCohortSimpleModel.get_cohort_data("date_start", "date_stop",
            'revenue', 'day', [], 'retention', 'backward')['rows']

        self.assertEqual(result[0]['columns'][0]['value'], 100)
        self.assertEqual(result[0]['columns'][-1]['value'], 0)

class TestCohortEmpty(TestCohortCommon):
    def test_empty_backward(self):
        """
            Test that view doesn't crash when there is no data
        """
        result = self.WebCohortSimpleModel.get_cohort_data("date_start", "date_stop",
            'revenue', 'day', [], 'retention', 'backward')['rows']
        self.assertEqual(result, [])
