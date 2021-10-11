/** @odoo-module alias=sign.utils **/

'use strict';

import ajax from "web.ajax";
import { _t } from 'web.core';

function getSelect2Options(placeholder) {
    return {
        placeholder: placeholder,
        allowClear: false,
        width: '100%',

        formatResult: function(data, resultElem, searchObj) {
            if(!data.text) {
                $(data.element[0]).data('create_name', searchObj.term);
                return $("<div/>", {text: _t("Create: \"") + searchObj.term + "\""});
            }
            return $("<div/>", {text: data.text});
        },

        formatSelection: function(data) {
            if(!data.text) {
                return $("<div/>", {text: $(data.element[0]).data('create_name')}).html();
            }
            return $("<div/>", {text: data.text}).html();
        },

        matcher: function(search, data) {
            if(!data) {
                return (search.length > 0);
            }
            return (data.toUpperCase().indexOf(search.toUpperCase()) > -1);
        }
    };
}

function getOptionsSelectConfiguration(item_id, select_options, selected) {
    if(getOptionsSelectConfiguration.configuration === undefined) {
        var data = [];
        for (var id in select_options) {
            data.push({id: parseInt(id), text: select_options[id].value});
        }
        var select2Options = {
            data: data,
            multiple: true,
            placeholder: _t("Select available options"),
            allowClear: true,
            width: '200px',
            createSearchChoice:function (term, data) {
                if ($(data).filter(function () { return this.text.localeCompare(term)===0; }).length===0) {
                    return {id:-1, text:term};
                }
            },
        };

        var selectChangeHandler = function(e) {
            var $select = $(e.target), option = e.added || e.removed;
            $select.data('item_options', $select.select2('val'));
            var option_id = option.id;
            var value = option.text || option.data('create_name');
            if (option_id >= 0 || !value) {
                return false;
            }
            ajax.rpc('/web/dataset/call_kw/sign.template/add_option', {
                model: 'sign.template',
                method: 'add_option',
                args: [value],
                kwargs: {}
            }).then(process_option);

            function process_option(optionId) {
                var option = {id: optionId, value: value};
                select_options[optionId] = option;
                selected = $select.select2('val');
                selected.pop(); // remove temp element (with id=-1)
                selected.push(optionId.toString());
                $select.data('item_options', selected);
                resetOptionsSelectConfiguration();
                setAsOptionsSelect($select, item_id, selected, select_options);
                $select.select2('focus');
            }
        };

        getOptionsSelectConfiguration.configuration = {
            options: select2Options,
            handler: selectChangeHandler,
            item_id: item_id,
        };
    }

    return getOptionsSelectConfiguration.configuration;
}

function getResponsibleSelectConfiguration(parties) {
    if(getResponsibleSelectConfiguration.configuration === undefined) {
        var select2Options = getSelect2Options(_t("Select the responsible"));

        var selectChangeHandler = function(e) {
            var $select = $(e.target), $option = $(e.added.element[0]);

            var resp = parseInt($option.val());
            var name = $option.text() || $option.data('create_name');

            if(resp >= 0 || !name) {
                return false;
            }

            ajax.rpc('/web/dataset/call_kw/sign.item.role/add', {
                model: 'sign.item.role',
                method: 'add',
                args: [name],
                kwargs: {}
            }).then(process_party);

            function process_party(partyID) {
                parties[partyID] = {id: partyID, name: name};
                getResponsibleSelectConfiguration.configuration = undefined;
                setAsResponsibleSelect($select, partyID, parties);
            }
        };

        var $responsibleSelect = $('<select/>').append($('<option/>'));
        for(var id in parties) {
            $responsibleSelect.append($('<option/>', {
                value: parseInt(id),
                text: parties[id].name,
            }));
        }
        $responsibleSelect.append($('<option/>', {value: -1}));

        getResponsibleSelectConfiguration.configuration = {
            html: $responsibleSelect.html(),
            options: select2Options,
            handler: selectChangeHandler,
        };
    }

    return getResponsibleSelectConfiguration.configuration;
}

function resetResponsibleSelectConfiguration() {
    getResponsibleSelectConfiguration.configuration = undefined;
}

function resetOptionsSelectConfiguration() {
    getOptionsSelectConfiguration.configuration = undefined;
}

function setAsResponsibleSelect($select, selected, parties) {
    var configuration = getResponsibleSelectConfiguration(parties);
    setAsSelect(configuration, $select, selected);
}

function setAsOptionsSelect($select, item_id, selected, select_options) {
    var configuration = getOptionsSelectConfiguration(item_id, select_options, selected);
    setAsSelect(configuration, $select, selected);
}

function setAsSelect(configuration, $select, selected) {
    $select.select2('destroy');
    if (configuration.html) {
        $select.empty().append(configuration.html).addClass('form-control');
    }
    $select.select2(configuration.options);
    if(selected !== undefined) {
        $select.select2('val', selected);
    }

    $select.off('change').on('change', configuration.handler);
}

export const sign_utils = {
    setAsResponsibleSelect,
    resetResponsibleSelectConfiguration,
    setAsOptionsSelect,
    resetOptionsSelectConfiguration,
}

export default sign_utils;
