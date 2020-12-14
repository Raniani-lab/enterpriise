/** @odoo-module alias=documents_spreadsheet.TestData default=0 */

/**
 * Get a basic arch for a pivot, which is compatible with the data given by
 * getTestData().
 *
 * Here is the pivot created:
 *     A      B      C      D      E      F
 * 1          1      2      12     17     Total
 * 2          Proba  Proba  Proba  Proba  Proba
 * 3  false          15                    15
 * 4  true    11            10     95     116
 * 5  Total   11     15     10     95     131
 */
export function getBasicArch() {
    return `
        <pivot string="Partners">
            <field name="foo" type="col"/>
            <field name="bar" type="row"/>
            <field name="probability" type="measure"/>
        </pivot>`
}

export function getTestData() {
    return {
        "documents.document": {
            fields: {
                name: { string: "Name", type: "char" },
                raw: { string: "Data", type: "text" },
                thumbnail: { string: "Thumbnail", type: "text" },
                favorited_ids: { string: "Name", type: "many2many" },
                is_favorited: { string: "Name", type: "boolean" },
            },
            records: [
                { id: 1, name: "My spreadsheet", raw: "{}", is_favorited: false },
                { id: 2, name: "", raw: "{}", is_favorited: true },
            ],
        },
        "ir.model": {
            fields: {
                name: { string: "Model Name", type: "char" },
                model: { string: "Model", type: "char" },
            },
            records: [{
                id: 37,
                name: "Product",
                model: "product",
            }, {
                id: 40,
                name: "partner",
                model: "partner",
            }],
        },
        partner: {
            fields: {
                foo: {
                    string: "Foo",
                    type: "integer",
                    searchable: true,
                    group_operator: "sum",
                },
                bar: { string: "bar", type: "boolean", store: true, sortable: true },
                name: { string: "name", type: "char", store: true, sortable: true },
                date: { string: "Date", type: "date", store: true, sortable: true },
                active: { string: "Active", type: "bool", default: true },
                product_id: {
                    string: "Product",
                    type: "many2one",
                    relation: "product",
                    store: true,
                },
                probability: {
                    string: "Probability",
                    type: "integer",
                    searchable: true,
                    group_operator: "avg",
                },
            },
            records: [{
                id: 1,
                foo: 12,
                bar: true,
                date: "2016-04-14",
                product_id: 37,
                probability: 10,
            }, {
                id: 2,
                foo: 1,
                bar: true,
                date: "2016-10-26",
                product_id: 41,
                probability: 11,
            }, {
                id: 3,
                foo: 17,
                bar: true,
                date: "2016-12-15",
                product_id: 41,
                probability: 95,
            }, {
                id: 4,
                foo: 2,
                bar: false,
                date: "2016-12-11",
                product_id: 41,
                probability: 15,
            }],
        },
        product: {
            fields: {
                name: { string: "Product Name", type: "char" },
                active: { string: "Active", type: "bool", default: true },
            },
            records: [{
                id: 37,
                display_name: "xphone",
            }, {
                id: 41,
                display_name: "xpad",
            }],
        },
    };
}
