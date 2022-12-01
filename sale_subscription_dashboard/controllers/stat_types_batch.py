# -*- coding: utf-8 -*-
# Part of Odoo. See LICENSE file for full copyright and licensing details.

from dateutil.relativedelta import relativedelta
from odoo.http import request


def get_dates_datapoints(dates):
    query = 'VALUES %s' % ','.join(f"(DATE '{date}')" for date in dates)
    return request.cr.mogrify(query).decode(request.env.cr.connection.encoding)



def get_churn_dates_datapoints(dates):
    query = 'VALUES %s' % ','.join(f"(DATE '{date + relativedelta(months=-1)}', DATE '{date}')" for date in dates)
    return request.cr.mogrify(query).decode(request.env.cr.connection.encoding)


def make_filters_query(filters):
    join = where = ""
    args = {}

    if filters.get('template_ids'):
        join += "\nJOIN sale_order so ON aml.subscription_id = so.id"
        where += "\nAND so.sale_order_template_id IN %(template_ids)s"
        args['template_ids'] = tuple(filters.get('template_ids'))

    if filters.get('sale_team_ids'):
        join += "\nJOIN crm_team crm ON am.team_id = crm.id"
        where += "\nAND crm.id IN %(team_ids)s"
        args['team_ids'] = tuple(filters.get('sale_team_ids'))

    if filters.get('company_ids'):
        where += """\nAND am.company_id IN %(company_ids)s
                 AND aml.company_id IN %(company_ids)s"""
        args['company_ids'] = tuple(filters.get('company_ids'))

    return join, where, args


def compute_nb_contracts_batch(dates, filters):
    dates_datapoints = get_dates_datapoints(dates)
    join, where, query_args = make_filters_query(filters)

    query = f"""
    WITH 
        dates(date) AS ({dates_datapoints}),
        subscription AS (
            SELECT 
                aml.subscription_id, 
                MIN(aml.subscription_start_date) AS start_date, 
                MAX(aml.subscription_end_date) AS end_date
    
            FROM account_move_line aml
            JOIN account_move am ON am.id = aml.move_id
            {join}
    
            WHERE   am.move_type IN ('out_invoice', 'out_refund')
            AND     am.state NOT IN ('draft', 'cancel')
            AND     aml.subscription_id IS NOT NULL
            AND NOT aml.subscription_start_date > %(end_date)s
            AND NOT aml.subscription_end_date < %(start_date)s
            {where}
            
            GROUP BY aml.subscription_id
        )

    SELECT date, running_value AS value
    FROM (
        SELECT SUM (value) OVER (ORDER BY date, value DESC) AS running_value, date, value 
        FROM (
            -- New Subscription count as +1
            SELECT start_date AS date, 1 AS value
            FROM subscription
            UNION ALL
            -- Expiring subscription count as -1
            SELECT end_date AS date, -1 AS value
            FROM subscription
            UNION ALL
            -- Interesting dates
            SELECT date, 0 as value 
            FROM dates
        ) a
    ) b    
    WHERE value = 0  
    """

    query_args.update({
        'start_date': dates[0],
        'end_date': dates[-1],
    })

    request.cr.execute(query, query_args)
    return request.cr.dictfetchall()
