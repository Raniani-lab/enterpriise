/** @odoo-module **/

import ajax from 'web.ajax';
import { qweb } from 'web.core';
import VariantMixin from 'website_sale_stock.VariantMixin';

const oldLoadStockXML = VariantMixin.loadStockXML;
VariantMixin.loadStockXML = async () => {
    await oldLoadStockXML.apply(this);
    return ajax.loadXML(
        '/website_sale_stock_renting/static/src/xml/website_sale_stock_renting_product_availability.xml', qweb
    );
};
