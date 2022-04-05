/** @odoo-module **/

import VariantMixin from 'sale.VariantMixin';
import RentingMixin from '@website_sale_renting/js/renting_mixin';

VariantMixin._isDurationWithHours = RentingMixin._isDurationWithHours;
VariantMixin._getRentingDates = RentingMixin._getRentingDates;

const oldGetOptionalCombinationInfoParam = VariantMixin._getOptionalCombinationInfoParam;
/**
 * Add the renting pickup and return dates to the optional combination info parameters.
 *
 * @param {$.Element} $product
 */
VariantMixin._getOptionalCombinationInfoParam = function ($product) {
    const result = oldGetOptionalCombinationInfoParam.apply(this, arguments);
    if (!this.isWebsite) {
        return result;
    }
    Object.assign(result, this._getRentingDates());

    return result;
};


const oldOnChangeCombination = VariantMixin._onChangeCombination;
/**
 * Update the renting text when the combination change.
 *
 * @param {Event} ev
 * @param {$.Element} $parent
 * @param {object} combination
 */
VariantMixin._onChangeCombination = function (ev, $parent, combination) {
    const result = oldOnChangeCombination.apply(this, arguments);
    if (!this.isWebsite || !combination.is_rental) {
        return result;
    }
    const $unitListPrice = $parent.find(".o_rental_product_price del .oe_currency_value");
    const $unitPrice = $parent.find(".o_rental_product_price strong .oe_currency_value");
    const $price = $parent.find(".o_renting_price .oe_currency_value");
    const $totalPrice = $parent.find(".o_renting_total_price .oe_currency_value");
    const $rentingDetails = $parent.find(".o_renting_details");
    const $duration = $rentingDetails.find(".o_renting_duration");
    const $unit = $rentingDetails.find(".o_renting_unit");
    $unitListPrice.text(this._priceToStr(combination.list_price));
    $unitPrice.text(this._priceToStr(combination.price));
    $price.text(this._priceToStr(combination.current_rental_price_per_unit));
    $totalPrice.text(this._priceToStr(combination.current_rental_price));
    $duration.text(combination.current_rental_duration);
    $unit.text(combination.current_rental_unit);

    return result;
};
