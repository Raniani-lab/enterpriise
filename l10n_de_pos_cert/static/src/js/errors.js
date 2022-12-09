/** @odoo-module */
export class TaxError extends Error {
    constructor(product) {
        super(
            `The tax for the product '${product.display_name}' with id ${product.id} is not allowed.`
        );
    }
}
