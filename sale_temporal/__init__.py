# -*- coding: utf-8 -*-

from . import models


def _pre_init_temporal(cr):
    """ Allow installing sale_temporal in databases with large sale.order / sale.order.line tables.
    The different temporal fields are all NULL (falsy) for existing sale orders,
    the computation is way more efficient in SQL than in Python.
    """
    cr.execute("""
        ALTER TABLE "sale_order_line"
        ADD COLUMN "start_date" timestamp without time zone,
        ADD COLUMN "next_invoice_date" timestamp without time zone,
        ADD COLUMN "pricing_id" int4
    """)
